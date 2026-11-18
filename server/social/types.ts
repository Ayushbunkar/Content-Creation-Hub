export interface StreamerIdentity {
  streamerName: string;         // Clean creator name (e.g. "CarryisLive", "Techno Gamerz")
  streamerHandle?: string;      // Social/platform handle (e.g. "@CarryisLive", "@carryminati")
  channelName?: string;         // Broadcast channel title (e.g. "CarryisLive")
  originalTitle?: string;       // Original stream/video title (e.g. "CARRYMINATI PLAYS GTA VI")
  gameOrTopic?: string;         // Game or niche topic (e.g. "GTA VI", "BGMI", "Podcast")
  sourcePlatform?: string;      // "youtube" | "twitch" | "local_upload"
  streamUrl?: string;           // Direct stream/VOD URL
  detectionSource: 'stream_metadata' | 'connected_platform' | 'user_input' | 'manual_override' | 'transcript_fallback';
  verified: boolean;            // True if confirmed by stream metadata, platform API, or user override
}

export interface SocialAccountProfile {
  id: string;                   // Internal DB ID
  platform: 'youtube' | 'instagram';
  accountId: string;            // YouTube Channel ID or Instagram Business User ID
  accountName: string;          // Display name (e.g. "CarryisLive Official")
  handle: string;               // "@carryislive"
  avatarUrl?: string;           // Profile picture
  subscribers?: string;         // Follower / Subscriber count formatted
  accountType?: string;         // "creator" | "business" | "standard"
  connected: boolean;
  authType: 'oauth' | 'token' | 'manual';
  scope?: string;
  tokenExpiry?: string;
  connectedAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any>;
}

export interface SocialAccountsState {
  youtube: SocialAccountProfile | null;
  instagram: SocialAccountProfile | null;
}

export interface GeneratedSocialMetadata {
  clipId: string;
  streamer: StreamerIdentity;
  youtube: {
    title: string;
    alternativeTitles: string[];
    description: string;
    tags: string[];             // Keyword tags for YouTube algorithm
    category: string;           // Category ID (e.g. "20" = Gaming)
    categoryName: string;
    suggestedPinnedComment?: string;
    callToAction?: string;
    suggestedThumbnailText?: string;
    attributionText?: string;
  };
  instagram: {
    caption: string;
    hashtags: string[];
    shortHook: string;
    creatorAttribution: string;
    callToAction?: string;
    suggestedFirstComment?: string;
    shareToFeed: boolean;
  };
  hashtags: {
    contentSpecific: string[];
    streamerSpecific: string[];
    gameOrTopic: string[];
    nicheCommunity: string[];
    platformRelevant: string[];
    verifiedTrends?: {
      tag: string;
      source: string;
      checkedAt: string;
      region: string;
    }[];
    allCombined: string[];
  };
  privacy: 'public' | 'unlisted' | 'private';
  generatedAt: string;
}

export interface VideoValidationResult {
  valid: boolean;
  format: string;
  aspectRatio: string;
  durationSec: number;
  fileSizeBytes: number;
  width: number;
  height: number;
  hasAudio: boolean;
  issues: string[];
  youtubeShortsEligible: boolean;
  instagramReelEligible: boolean;
}

export interface PublishRequest {
  clipId: string;
  sourcePage: 'stream_clipper' | 'clipper' | 'captions' | 'social_studio';
  projectId?: string;
  videoPath: string;
  platforms: ('youtube' | 'instagram')[];
  streamer: StreamerIdentity;
  metadata: {
    youtubeTitle?: string;
    youtubeDescription?: string;
    youtubeTags?: string[];
    youtubeCategory?: string;
    youtubePrivacy?: 'public' | 'unlisted' | 'private';
    instagramCaption?: string;
    instagramHashtags?: string[];
    instagramShareToFeed?: boolean;
  };
  idempotencyKey?: string;
}

export interface PlatformPublishResult {
  platform: 'youtube' | 'instagram';
  success: boolean;
  status: 'published' | 'failed' | 'processing';
  publishedUrl?: string;
  mediaId?: string;
  error?: string;
  publishedAt?: string;
  executionDurationMs?: number;
}

export interface PublishingRecord {
  id: string;
  clipId: string;
  sourcePage: string;
  projectId?: string;
  streamerName: string;
  streamerHandle?: string;
  gameOrTopic?: string;
  sourceStreamUrl?: string;
  videoPath: string;
  platform: 'youtube' | 'instagram';
  accountId?: string;
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  youtubeTags?: string[];
  privacy: 'public' | 'unlisted' | 'private';
  status: 'pending' | 'uploading' | 'processing' | 'published' | 'failed';
  progress: number;
  platformMediaId?: string;
  publishedUrl?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
}

export interface MediaHostingConfig {
  provider: 'local_tunnel' | 's3' | 'cloudinary' | 'custom_url';
  publicBaseUrl?: string;
  s3Bucket?: string;
  s3Region?: string;
  isConfigured: boolean;
  statusMessage: string;
}

export interface UploadJobState {
  jobId: string;
  clipId: string;
  overallStatus: 'queued' | 'running' | 'completed' | 'partial_failure' | 'failed';
  youtube: {
    status: 'idle' | 'uploading' | 'processing' | 'published' | 'failed';
    progress: number;
    result?: PlatformPublishResult;
    error?: string;
  };
  instagram: {
    status: 'idle' | 'preparing_media' | 'creating_container' | 'polling_status' | 'published' | 'failed';
    progress: number;
    result?: PlatformPublishResult;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}
