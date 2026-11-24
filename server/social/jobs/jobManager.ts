import { PublishRequest, PlatformPublishResult, UploadJobState } from '../types';
import { YouTubePublisher } from '../youtube/youtubePublisher';
import { InstagramPublisher } from '../instagram/instagramPublisher';
import { PublishingStore } from '../storage/publishingStore';
import { TokenStorage } from '../auth/tokenStorage';

export class JobManager {
  private static activeJobs: Map<string, UploadJobState> = new Map();
  private static idempotencyLocks: Set<string> = new Set();
  private static progressListeners: ((job: UploadJobState) => void)[] = [];

  static subscribe(fn: (job: UploadJobState) => void): () => void {
    this.progressListeners.push(fn);
    return () => {
      this.progressListeners = this.progressListeners.filter(l => l !== fn);
    };
  }

  private static notify(job: UploadJobState): void {
    for (const listener of this.progressListeners) {
      try { listener(job); } catch (e) {}
    }
  }

  /**
   * Execute or retry an independent publishing job
   */
  static async executePublishJob(request: PublishRequest): Promise<{
    jobId: string;
    results: PlatformPublishResult[];
    overallStatus: 'completed' | 'partial_failure' | 'failed';
  }> {
    const lockKey = `${request.clipId}_${request.platforms.sort().join('_')}`;

    // Prevent duplicate publishing attempts
    if (this.idempotencyLocks.has(lockKey)) {
      throw new Error(`A publishing job for this clip on platform(s) ${request.platforms.join(', ')} is already in progress.`);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.idempotencyLocks.add(lockKey);

    const jobState: UploadJobState = {
      jobId,
      clipId: request.clipId,
      overallStatus: 'running',
      youtube: { status: 'idle', progress: 0 },
      instagram: { status: 'idle', progress: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.activeJobs.set(jobId, jobState);
    this.notify(jobState);

    const results: PlatformPublishResult[] = [];
    const accounts = await PublishingStore.getAccounts();

    try {
      // Platform 1: YouTube Shorts (if requested)
      if (request.platforms.includes('youtube')) {
        jobState.youtube.status = 'uploading';
        this.notify(jobState);

        // Record pending in DB
        const pubRecord = await PublishingStore.recordPublication({
          clipId: request.clipId,
          sourcePage: request.sourcePage,
          projectId: request.projectId,
          streamerName: request.streamer.streamerName,
          streamerHandle: request.streamer.streamerHandle,
          gameOrTopic: request.streamer.gameOrTopic,
          sourceStreamUrl: request.streamer.streamUrl,
          videoPath: request.videoPath,
          platform: 'youtube',
          accountId: accounts.youtube?.accountId,
          title: request.metadata.youtubeTitle,
          description: request.metadata.youtubeDescription,
          youtubeTags: request.metadata.youtubeTags,
          privacy: request.metadata.youtubePrivacy || 'public',
          status: 'uploading',
          progress: 10
        });

        try {
          const isShort = request.metadata.isShort;
          const defaultYtTitle = isShort === false ? 'Viral Gaming Video' : 'Viral Reel #shorts';
          const ytResult = await YouTubePublisher.publishVideo({
            videoPath: request.videoPath,
            title: request.metadata.youtubeTitle || defaultYtTitle,
            description: request.metadata.youtubeDescription || '',
            tags: request.metadata.youtubeTags,
            category: request.metadata.youtubeCategory || '20',
            privacy: request.metadata.youtubePrivacy || 'public',
            isShort,
            encryptedAccessToken: accounts.youtube?.metadata?.accessTokenEncrypted,
            encryptedRefreshToken: accounts.youtube?.metadata?.refreshTokenEncrypted,
            onProgress: (p) => {
              jobState.youtube.progress = p;
              this.notify(jobState);
            }
          });

          results.push(ytResult);
          jobState.youtube.status = ytResult.success ? 'published' : 'failed';
          jobState.youtube.result = ytResult;
          jobState.youtube.error = ytResult.error;

          // Update DB record
          await PublishingStore.recordPublication({
            id: pubRecord.id,
            clipId: request.clipId,
            videoPath: request.videoPath,
            platform: 'youtube',
            title: request.metadata.youtubeTitle,
            description: request.metadata.youtubeDescription,
            status: ytResult.success ? 'published' : 'failed',
            progress: ytResult.success ? 100 : jobState.youtube.progress,
            platformMediaId: ytResult.mediaId,
            publishedUrl: ytResult.publishedUrl,
            errorMessage: ytResult.error,
            publishedAt: ytResult.success ? ytResult.publishedAt : undefined
          });
        } catch (ytErr: any) {
          const errRes: PlatformPublishResult = {
            platform: 'youtube',
            success: false,
            status: 'failed',
            error: ytErr.message || 'YouTube upload exception'
          };
          results.push(errRes);
          jobState.youtube.status = 'failed';
          jobState.youtube.error = ytErr.message;
        }

        this.notify(jobState);
      }

      // Platform 2: Instagram Reels (if requested)
      if (request.platforms.includes('instagram')) {
        jobState.instagram.status = 'creating_container';
        this.notify(jobState);

        const pubRecord = await PublishingStore.recordPublication({
          clipId: request.clipId,
          sourcePage: request.sourcePage,
          projectId: request.projectId,
          streamerName: request.streamer.streamerName,
          streamerHandle: request.streamer.streamerHandle,
          gameOrTopic: request.streamer.gameOrTopic,
          sourceStreamUrl: request.streamer.streamUrl,
          videoPath: request.videoPath,
          platform: 'instagram',
          accountId: accounts.instagram?.accountId,
          caption: request.metadata.instagramCaption,
          hashtags: request.metadata.instagramHashtags,
          status: 'uploading',
          progress: 10
        });

        try {
          const igResult = await InstagramPublisher.publishReel({
            videoPath: request.videoPath,
            caption: request.metadata.instagramCaption || 'Viral Reel 🔥',
            hashtags: request.metadata.instagramHashtags,
            shareToFeed: request.metadata.instagramShareToFeed !== false,
            encryptedAccessToken: accounts.instagram?.metadata?.accessTokenEncrypted,
            igAccountId: accounts.instagram?.accountId,
            onProgress: (p) => {
              jobState.instagram.progress = p;
              this.notify(jobState);
            }
          });

          results.push(igResult);
          jobState.instagram.status = igResult.success ? 'published' : 'failed';
          jobState.instagram.result = igResult;
          jobState.instagram.error = igResult.error;

          await PublishingStore.recordPublication({
            id: pubRecord.id,
            clipId: request.clipId,
            videoPath: request.videoPath,
            platform: 'instagram',
            caption: request.metadata.instagramCaption,
            status: igResult.success ? 'published' : 'failed',
            progress: igResult.success ? 100 : jobState.instagram.progress,
            platformMediaId: igResult.mediaId,
            publishedUrl: igResult.publishedUrl,
            errorMessage: igResult.error,
            publishedAt: igResult.success ? igResult.publishedAt : undefined
          });
        } catch (igErr: any) {
          const errRes: PlatformPublishResult = {
            platform: 'instagram',
            success: false,
            status: 'failed',
            error: igErr.message || 'Instagram publishing exception'
          };
          results.push(errRes);
          jobState.instagram.status = 'failed';
          jobState.instagram.error = igErr.message;
        }

        this.notify(jobState);
      }

      const allSuccess = results.every(r => r.success);
      const someSuccess = results.some(r => r.success);
      const overallStatus = allSuccess ? 'completed' : someSuccess ? 'partial_failure' : 'failed';

      jobState.overallStatus = overallStatus;
      jobState.updatedAt = new Date().toISOString();
      this.notify(jobState);

      return {
        jobId,
        results,
        overallStatus
      };
    } finally {
      this.idempotencyLocks.delete(lockKey);
    }
  }

  static getJob(jobId: string): UploadJobState | undefined {
    return this.activeJobs.get(jobId);
  }
}
