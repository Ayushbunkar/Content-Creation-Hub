import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'storage', 'database');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'studio.db');
const db = new sqlite3.Database(DB_PATH);

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          topic TEXT NOT NULL,
          duration INTEGER NOT NULL,
          language TEXT NOT NULL,
          voice TEXT,
          aspect_ratio TEXT DEFAULT '16:9',
          resolution TEXT DEFAULT '1080p',
          fps INTEGER DEFAULT 30,
          visual_style TEXT,
          caption_template TEXT DEFAULT 'minimal-white',
          status TEXT DEFAULT 'draft',
          current_stage TEXT DEFAULT 'JOB_CREATED',
          progress INTEGER DEFAULT 0,
          script TEXT,
          scene_data TEXT,
          narration_file TEXT,
          subtitles_file TEXT,
          video_output TEXT,
          social_captions TEXT,
          research_summary TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);

        // Safe migrations for Documentary Studio features
        const docColumns = [
          `ALTER TABLE projects ADD COLUMN claim_ledger TEXT`,
          `ALTER TABLE projects ADD COLUMN timeline TEXT`,
          `ALTER TABLE projects ADD COLUMN entities TEXT`,
          `ALTER TABLE projects ADD COLUMN asset_manifest TEXT`,
          `ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'one_click'`,
          `ALTER TABLE projects ADD COLUMN review_approved INTEGER DEFAULT 0`,
          `ALTER TABLE projects ADD COLUMN documentary_chapters TEXT`
        ];
        docColumns.forEach(sql => db.run(sql, () => {}));
      });

      // Assets table
      db.run(`
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          file_path TEXT NOT NULL,
          source_url TEXT,
          license TEXT DEFAULT 'Local / Creative Commons',
          category TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);

        // Safe migrations for Documentary Studio features
        const docColumns = [
          `ALTER TABLE projects ADD COLUMN claim_ledger TEXT`,
          `ALTER TABLE projects ADD COLUMN timeline TEXT`,
          `ALTER TABLE projects ADD COLUMN entities TEXT`,
          `ALTER TABLE projects ADD COLUMN asset_manifest TEXT`,
          `ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'one_click'`,
          `ALTER TABLE projects ADD COLUMN review_approved INTEGER DEFAULT 0`,
          `ALTER TABLE projects ADD COLUMN documentary_chapters TEXT`
        ];
        docColumns.forEach(sql => db.run(sql, () => {}));
      });

      // Caption Studio Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS caption_projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          video_path TEXT NOT NULL,
          audio_path TEXT,
          file_info TEXT,
          language TEXT DEFAULT 'auto',
          model TEXT DEFAULT 'base',
          status TEXT DEFAULT 'uploaded',
          progress INTEGER DEFAULT 0,
          error_message TEXT,
          transcript_json TEXT,
          caption_template TEXT DEFAULT 'minimal-white',
          custom_style TEXT,
          video_settings TEXT,
          exported_video TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);

        // Safe migrations for Documentary Studio features
        const docColumns = [
          `ALTER TABLE projects ADD COLUMN claim_ledger TEXT`,
          `ALTER TABLE projects ADD COLUMN timeline TEXT`,
          `ALTER TABLE projects ADD COLUMN entities TEXT`,
          `ALTER TABLE projects ADD COLUMN asset_manifest TEXT`,
          `ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'one_click'`,
          `ALTER TABLE projects ADD COLUMN review_approved INTEGER DEFAULT 0`,
          `ALTER TABLE projects ADD COLUMN documentary_chapters TEXT`
        ];
        docColumns.forEach(sql => db.run(sql, () => {}));
      });

      // AI Viral Clipper Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS clipper_projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_url TEXT,
          video_path TEXT NOT NULL,
          audio_path TEXT,
          thumbnail_url TEXT,
          duration REAL DEFAULT 0,
          width INTEGER DEFAULT 1920,
          height INTEGER DEFAULT 1080,
          fps INTEGER DEFAULT 30,
          status TEXT DEFAULT 'ready',
          progress INTEGER DEFAULT 0,
          error_message TEXT,
          transcript_json TEXT,
          target_duration TEXT DEFAULT '30-60',
          clip_count_target INTEGER DEFAULT 5,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);

        // Safe migrations for Documentary Studio features
        const docColumns = [
          `ALTER TABLE projects ADD COLUMN claim_ledger TEXT`,
          `ALTER TABLE projects ADD COLUMN timeline TEXT`,
          `ALTER TABLE projects ADD COLUMN entities TEXT`,
          `ALTER TABLE projects ADD COLUMN asset_manifest TEXT`,
          `ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'one_click'`,
          `ALTER TABLE projects ADD COLUMN review_approved INTEGER DEFAULT 0`,
          `ALTER TABLE projects ADD COLUMN documentary_chapters TEXT`
        ];
        docColumns.forEach(sql => db.run(sql, () => {}));
      });

      // AI Viral Clipper Extracted Clips table
      db.run(`
        CREATE TABLE IF NOT EXISTS clipper_clips (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          hook TEXT,
          summary TEXT,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          duration REAL NOT NULL,
          engagement_score INTEGER DEFAULT 85,
          category TEXT DEFAULT 'Insight',
          reason TEXT,
          reframing_mode TEXT DEFAULT 'blur_background',
          caption_template TEXT DEFAULT 'word-pop',
          caption_language TEXT DEFAULT 'original',
          custom_style TEXT,
          transcript_segments TEXT,
          status TEXT DEFAULT 'detected',
          exported_video TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

export function runQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this as any);
    });
  });
}

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

export default db;
