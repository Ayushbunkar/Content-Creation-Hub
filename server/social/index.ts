import { PublishingStore } from './storage/publishingStore';
import { MetadataEngine } from './metadata/metadataEngine';
import { HashtagEngine } from './hashtags/hashtagEngine';
import { YouTubePublisher } from './youtube/youtubePublisher';
import { InstagramPublisher } from './instagram/instagramPublisher';
import { MediaHostingAdapter } from './instagram/mediaHosting';
import { OAuthService } from './auth/oauthService';
import { JobManager } from './jobs/jobManager';
import {
  StreamerIdentity,
  SocialAccountProfile,
  SocialAccountsState,
  GeneratedSocialMetadata,
  PublishRequest,
  PlatformPublishResult,
  PublishingRecord,
  MediaHostingConfig
} from './types';

export * from './types';

export class SocialPublishingService {
  /**
   * Initialize tables and service
   */
  static async init(): Promise<void> {
    await PublishingStore.initTables();
  }

  // ==========================================
  // ACCOUNTS & OAUTH
  // ==========================================

  static async getAccounts(): Promise<SocialAccountsState> {
    return PublishingStore.getAccounts();
  }

  static async saveAccount(platform: 'youtube' | 'instagram', details: Partial<SocialAccountProfile>): Promise<SocialAccountsState> {
    await PublishingStore.saveAccount({ ...details, platform });
    return PublishingStore.getAccounts();
  }

  static async disconnectAccount(platform: 'youtube' | 'instagram'): Promise<SocialAccountsState> {
    await PublishingStore.disconnectAccount(platform);
    return PublishingStore.getAccounts();
  }

  static getGoogleAuthUrl(state?: string) {
    return OAuthService.getGoogleAuthUrl(state);
  }

  static async handleGoogleCallback(code: string) {
    const res = await OAuthService.handleGoogleCallback(code);
    if (res.profile && res.profile.platform === 'youtube') {
      await PublishingStore.saveAccount(res.profile as any);
    }
    return res;
  }

  static getMetaAuthUrl(state?: string) {
    return OAuthService.getMetaAuthUrl(state);
  }

  static async handleMetaCallback(code: string) {
    const res = await OAuthService.handleMetaCallback(code);
    if (res.profile && res.profile.platform === 'instagram') {
      await PublishingStore.saveAccount(res.profile as any);
    }
    return res;
  }

  // ==========================================
  // STREAMER IDENTITY HIERARCHY
  // ==========================================

  static resolveStreamerIdentity(inputs: Parameters<typeof MetadataEngine.resolveStreamerIdentity>[0]): StreamerIdentity {
    return MetadataEngine.resolveStreamerIdentity(inputs);
  }

  // ==========================================
  // AI METADATA & HASHTAGS
  // ==========================================

  static generateMetadata(options: {
    clipId: string;
    streamer: StreamerIdentity;
    headlineHook?: string;
    transcript?: string;
    gameOrTopic?: string;
    duration?: number;
    privacy?: 'public' | 'unlisted' | 'private';
  }): GeneratedSocialMetadata {
    return MetadataEngine.generateClipMetadata(options);
  }

  static generateHashtags(options: Parameters<typeof HashtagEngine.generateHashtags>[0]) {
    return HashtagEngine.generateHashtags(options);
  }

  // ==========================================
  // VIDEO VALIDATION & HOSTING
  // ==========================================

  static validateVideo(filePath: string) {
    const yt = YouTubePublisher.validateVideo(filePath);
    const ig = InstagramPublisher.validateVideo(filePath);
    return {
      valid: yt.valid && ig.valid,
      youtube: yt,
      instagram: ig
    };
  }

  static getMediaHostingStatus(): MediaHostingConfig {
    return MediaHostingAdapter.getStatus();
  }

  // ==========================================
  // 1-CLICK PUBLISHING & RETRIES
  // ==========================================

  static async publishVideo(request: PublishRequest): Promise<{
    jobId: string;
    results: PlatformPublishResult[];
    overallStatus: 'completed' | 'partial_failure' | 'failed';
  }> {
    return JobManager.executePublishJob(request);
  }

  static async getPublicationsForClip(clipId: string): Promise<PublishingRecord[]> {
    return PublishingStore.getPublicationsForClip(clipId);
  }

  static async getPublishingHistory(filter: 'all' | 'drafts' | 'ready' | 'publishing' | 'published' | 'failed' = 'all'): Promise<PublishingRecord[]> {
    return PublishingStore.getPublishingHistory(filter);
  }
}
