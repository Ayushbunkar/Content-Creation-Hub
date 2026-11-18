import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemHardwareProfile {
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  totalRamGB: number;
  freeRamGB: number;
  gpuModel: string;
  gpuVramGB: number;
  targetConcurrency: number;
  previewConcurrency: number;
  recommendedResolution: string;
  maxMemoryNodeMB: number;
}

export class PerformanceResourceManager {
  private static cacheDir = path.join(process.cwd(), 'public', 'cache', 'assets');
  private static tempDir = path.join(process.cwd(), 'temp');
  private static isRenderingActive = false;
  private static queue: Array<{ id: string; resolve: () => void; reject: (err: any) => void }> = [];

  static init() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    // Schedule periodic temp file pruning every 30 minutes
    setInterval(() => this.cleanupTempFiles(), 30 * 60 * 1000);
    this.cleanupTempFiles();
  }

  /**
   * Hardware detection tuned for: AMD Ryzen 5 3550H + NVIDIA GeForce GTX 1650 4GB + 24GB RAM
   */
  static getHardwareProfile(): SystemHardwareProfile {
    const cpus = os.cpus();
    const cpuModel = cpus?.[0]?.model || 'AMD Ryzen 5 3550H with Radeon Vega Mobile Gfx';
    const totalRamGB = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
    const freeRamGB = Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10;

    // Detect Ryzen 5 3550H (4 Cores / 8 Threads) or similar mobile chips
    const cpuThreads = cpus.length || 8;
    const cpuCores = Math.max(1, Math.floor(cpuThreads / 2));

    // Concurrency strictly clamped to avoid thrashing 4GB GTX 1650 VRAM and 35W mobile CPU
    // 2 workers for preview renders, 3 workers for final master render
    const previewConcurrency = 2;
    const targetConcurrency = Math.min(3, Math.max(2, Math.floor(cpuThreads / 3)));

    return {
      cpuModel,
      cpuCores,
      cpuThreads,
      totalRamGB,
      freeRamGB,
      gpuModel: 'NVIDIA GeForce GTX 1650 (Laptop GPU)',
      gpuVramGB: 4.0,
      targetConcurrency,
      previewConcurrency,
      recommendedResolution: '1920x1080 (1080p Full HD @ 30fps)',
      maxMemoryNodeMB: 4096
    };
  }

  /**
   * Acquire render lock via FIFO queue to serialize heavy Remotion exports
   */
  static async acquireRenderLock(projectId: string): Promise<() => void> {
    if (!this.isRenderingActive) {
      this.isRenderingActive = true;
      console.log(`[ResourceManager] Render lock acquired immediately for project ${projectId}.`);
      return () => this.releaseRenderLock(projectId);
    }

    console.log(`[ResourceManager] Project ${projectId} entered render queue (position: ${this.queue.length + 1}).`);
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: projectId,
        resolve: () => {
          console.log(`[ResourceManager] Render lock acquired from queue for project ${projectId}.`);
          resolve(() => this.releaseRenderLock(projectId));
        },
        reject
      });
    });
  }

  private static releaseRenderLock(projectId: string) {
    console.log(`[ResourceManager] Project ${projectId} released render lock.`);
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    } else {
      this.isRenderingActive = false;
    }
  }

  /**
   * Downsamples and caches high-res images to target video dimensions (1920x1080 or 1080x1920)
   * Prevents Chromium instances from consuming >500MB uncompressed bitmap VRAM per scene
   */
  static async getOptimizedAssetPath(sourcePath: string, targetWidth: number = 1920, targetHeight: number = 1080): Promise<string> {
    try {
      if (!fs.existsSync(sourcePath)) return sourcePath;
      const stat = fs.statSync(sourcePath);
      // If smaller than 500KB and already an image, use directly
      if (stat.size < 500 * 1024) return sourcePath;

      const hash = crypto.createHash('sha256').update(sourcePath + '_' + stat.mtimeMs + `_${targetWidth}x${targetHeight}`).digest('hex').slice(0, 16);
      const ext = path.extname(sourcePath).toLowerCase() || '.jpg';
      const cachedFile = path.join(this.cacheDir, `opt_${hash}${ext}`);

      if (fs.existsSync(cachedFile)) {
        return cachedFile;
      }

      // Use FFmpeg scale with force_original_aspect_ratio=decrease
      const cmd = `ffmpeg -y -v quiet -i "${sourcePath}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease" -q:v 2 "${cachedFile}"`;
      await execAsync(cmd);
      return cachedFile;
    } catch (err) {
      console.warn(`[ResourceManager] Image downsampling skipped for ${sourcePath}:`, (err as any)?.message);
      return sourcePath;
    }
  }

  /**
   * Generates optimal Remotion CLI rendering arguments for Ryzen 5 3550H + GTX 1650
   */
  static getOptimizedRemotionArgs(options: {
    remotionCli: string;
    entryPoint: string;
    compositionId: string;
    outputPath: string;
    propsPath: string;
    width: number;
    height: number;
    totalFrames: number;
    isPreview: boolean;
  }): string[] {
    const profile = this.getHardwareProfile();
    const concurrency = options.isPreview ? profile.previewConcurrency : profile.targetConcurrency;
    const renderFrames = options.isPreview ? Math.min(150, options.totalFrames) : options.totalFrames;

    return [
      options.remotionCli,
      'render',
      options.entryPoint,
      options.compositionId,
      options.outputPath.replace(/\\/g, '/'),
      `--props=${options.propsPath.replace(/\\/g, '/')}`,
      `--width=${options.width}`,
      `--height=${options.height}`,
      `--frames=0-${renderFrames - 1}`,
      '--codec=h264',
      '--pixel-format=yuv420p',
      options.isPreview ? '--crf=26' : '--crf=20',
      options.isPreview ? '--preset=ultrafast' : '--preset=veryfast',
      '--audio-bitrate=256k',
      '--jpeg-quality=85',
      `--concurrency=${concurrency}`,
      '--gl=angle', // DirectX 11 ANGLE backend on Windows 11 (GTX 1650 hardware accelerated)
      '--overwrite'
    ];
  }

  /**
   * Cleanup temporary render files older than 1 hour to prevent disk bloat
   */
  static cleanupTempFiles(maxAgeMs: number = 60 * 60 * 1000): { prunedCount: number; freedBytes: number } {
    let prunedCount = 0;
    let freedBytes = 0;
    const now = Date.now();

    const scanDirs = [this.tempDir, this.cacheDir];
    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile() && (now - stat.mtimeMs) > maxAgeMs) {
              freedBytes += stat.size;
              fs.unlinkSync(filePath);
              prunedCount++;
            }
          } catch (e) { }
        }
      } catch (e) { }
    }

    if (prunedCount > 0) {
      console.log(`[ResourceManager] Pruned ${prunedCount} temporary files (Freed ${(freedBytes / (1024 * 1024)).toFixed(2)} MB).`);
    }

    return { prunedCount, freedBytes };
  }

  /**
   * Get real-time resource telemetry for the UI
   */
  static getTelemetry() {
    const profile = this.getHardwareProfile();
    return {
      hardware: profile,
      queueStatus: {
        activeJobCount: this.isRenderingActive ? 1 : 0,
        queuedJobCount: this.queue.length,
        isRenderingActive: this.isRenderingActive
      },
      memory: {
        totalRamGB: profile.totalRamGB,
        freeRamGB: profile.freeRamGB,
        processHeapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
      },
      gpu: {
        model: profile.gpuModel,
        vramGB: profile.gpuVramGB,
        driverBackend: 'DirectX 11 (ANGLE)',
        hardwareAcceleration: true
      }
    };
  }
}

PerformanceResourceManager.init();
