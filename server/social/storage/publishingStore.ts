import { runQuery, getQuery, allQuery } from '../../db';
import { SocialAccountProfile, SocialAccountsState, PublishingRecord } from '../types';

export class PublishingStore {
  /**
   * Initialize social database tables in SQLite
   */
  static async initTables(): Promise<void> {
    // 1. Social Accounts table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL UNIQUE,
        account_id TEXT,
        account_name TEXT NOT NULL,
        handle TEXT NOT NULL,
        avatar_url TEXT,
        subscribers TEXT DEFAULT '0',
        account_type TEXT DEFAULT 'creator',
        connected INTEGER DEFAULT 0,
        auth_type TEXT DEFAULT 'manual',
        access_token_encrypted TEXT,
        refresh_token_encrypted TEXT,
        token_expiry TEXT,
        scope TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Social Publications history table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS social_publications (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL,
        source_page TEXT NOT NULL,
        project_id TEXT,
        streamer_name TEXT NOT NULL,
        streamer_handle TEXT,
        game_or_topic TEXT,
        source_stream_url TEXT,
        video_path TEXT NOT NULL,
        platform TEXT NOT NULL,
        account_id TEXT,
        title TEXT,
        description TEXT,
        caption TEXT,
        hashtags TEXT,
        youtube_tags TEXT,
        privacy TEXT DEFAULT 'public',
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        platform_media_id TEXT,
        published_url TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        published_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pub_clip_id ON social_publications(clip_id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pub_platform ON social_publications(platform)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pub_status ON social_publications(status)`);

    // 3. Social upload jobs table (for asynchronous execution and idempotency)
    await runQuery(`
      CREATE TABLE IF NOT EXISTS social_jobs (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL,
        overall_status TEXT DEFAULT 'queued',
        youtube_status TEXT DEFAULT 'idle',
        instagram_status TEXT DEFAULT 'idle',
        youtube_result TEXT,
        instagram_result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runQuery(`CREATE INDEX IF NOT EXISTS idx_jobs_clip_id ON social_jobs(clip_id)`);
  }

  /**
   * Load accounts from database
   */
  static async getAccounts(): Promise<SocialAccountsState> {
    try {
      const rows = await allQuery<any>(`SELECT * FROM social_accounts`);
      let yt: SocialAccountProfile | null = null;
      let ig: SocialAccountProfile | null = null;

      for (const row of rows) {
        const profile: SocialAccountProfile = {
          id: row.id,
          platform: row.platform,
          accountId: row.account_id || '',
          accountName: row.account_name,
          handle: row.handle,
          avatarUrl: row.avatar_url || '',
          subscribers: row.subscribers || '0',
          accountType: row.account_type || 'creator',
          connected: Boolean(row.connected),
          authType: row.auth_type || 'manual',
          tokenExpiry: row.token_expiry,
          connectedAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: {
            accessTokenEncrypted: row.access_token_encrypted,
            refreshTokenEncrypted: row.refresh_token_encrypted
          }
        };

        if (row.platform === 'youtube') yt = profile;
        if (row.platform === 'instagram') ig = profile;
      }

      return {
        youtube: yt || {
          id: 'acc_yt',
          platform: 'youtube',
          accountId: '',
          accountName: 'My YouTube Channel',
          handle: '@mychannel',
          avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
          subscribers: '0',
          connected: false,
          authType: 'manual'
        },
        instagram: ig || {
          id: 'acc_ig',
          platform: 'instagram',
          accountId: '',
          accountName: 'My Instagram Profile',
          handle: '@myprofile',
          avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
          subscribers: '0',
          connected: false,
          authType: 'manual'
        }
      };
    } catch (e) {
      console.warn('[PublishingStore] getAccounts fallback:', e);
      return {
        youtube: null,
        instagram: null
      };
    }
  }

  /**
   * Save or update an account in SQLite
   */
  static async saveAccount(profile: Partial<SocialAccountProfile> & { platform: 'youtube' | 'instagram' }): Promise<void> {
    const existing = await getQuery<any>(`SELECT id FROM social_accounts WHERE platform = ?`, [profile.platform]);
    const id = existing?.id || `acc_${profile.platform}_${Date.now()}`;
    const now = new Date().toISOString();

    const accessTokenEncrypted = profile.metadata?.accessTokenEncrypted || '';
    const refreshTokenEncrypted = profile.metadata?.refreshTokenEncrypted || '';

    await runQuery(`
      INSERT INTO social_accounts (
        id, platform, account_id, account_name, handle, avatar_url, subscribers,
        account_type, connected, auth_type, access_token_encrypted, refresh_token_encrypted,
        token_expiry, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform) DO UPDATE SET
        account_id = excluded.account_id,
        account_name = excluded.account_name,
        handle = excluded.handle,
        avatar_url = excluded.avatar_url,
        subscribers = excluded.subscribers,
        account_type = excluded.account_type,
        connected = excluded.connected,
        auth_type = excluded.auth_type,
        access_token_encrypted = CASE WHEN excluded.access_token_encrypted != '' THEN excluded.access_token_encrypted ELSE social_accounts.access_token_encrypted END,
        refresh_token_encrypted = CASE WHEN excluded.refresh_token_encrypted != '' THEN excluded.refresh_token_encrypted ELSE social_accounts.refresh_token_encrypted END,
        token_expiry = excluded.token_expiry,
        updated_at = excluded.updated_at
    `, [
      id,
      profile.platform,
      profile.accountId || '',
      profile.accountName || (profile.platform === 'youtube' ? 'My YouTube Channel' : 'My Instagram Profile'),
      profile.handle || (profile.platform === 'youtube' ? '@mychannel' : '@myprofile'),
      profile.avatarUrl || '',
      profile.subscribers || '0',
      profile.accountType || 'creator',
      profile.connected ? 1 : 0,
      profile.authType || 'manual',
      accessTokenEncrypted,
      refreshTokenEncrypted,
      profile.tokenExpiry || null,
      now
    ]);
  }

  /**
   * Disconnect an account
   */
  static async disconnectAccount(platform: 'youtube' | 'instagram'): Promise<void> {
    await runQuery(`
      UPDATE social_accounts SET
        connected = 0,
        access_token_encrypted = NULL,
        refresh_token_encrypted = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE platform = ?
    `, [platform]);
  }

  /**
   * Record a new publishing action or update existing
   */
  static async recordPublication(record: Partial<PublishingRecord> & { clipId: string; platform: 'youtube' | 'instagram'; videoPath: string }): Promise<PublishingRecord> {
    const id = record.id || `pub_${record.platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await runQuery(`
      INSERT INTO social_publications (
        id, clip_id, source_page, project_id, streamer_name, streamer_handle,
        game_or_topic, source_stream_url, video_path, platform, account_id,
        title, description, caption, hashtags, youtube_tags, privacy, status,
        progress, platform_media_id, published_url, error_message, retry_count,
        created_at, published_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        progress = excluded.progress,
        platform_media_id = excluded.platform_media_id,
        published_url = excluded.published_url,
        error_message = excluded.error_message,
        retry_count = social_publications.retry_count + 1,
        title = CASE WHEN excluded.title IS NOT NULL AND excluded.title != '' THEN excluded.title ELSE social_publications.title END,
        description = CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE social_publications.description END,
        caption = CASE WHEN excluded.caption IS NOT NULL AND excluded.caption != '' THEN excluded.caption ELSE social_publications.caption END,
        published_at = excluded.published_at,
        updated_at = excluded.updated_at
    `, [
      id,
      record.clipId,
      record.sourcePage || 'studio',
      record.projectId || null,
      record.streamerName || 'Creator',
      record.streamerHandle || null,
      record.gameOrTopic || null,
      record.sourceStreamUrl || null,
      record.videoPath,
      record.platform,
      record.accountId || null,
      record.title || null,
      record.description || null,
      record.caption || null,
      record.hashtags ? JSON.stringify(record.hashtags) : null,
      record.youtubeTags ? JSON.stringify(record.youtubeTags) : null,
      record.privacy || 'public',
      record.status || 'pending',
      record.progress || 0,
      record.platformMediaId || null,
      record.publishedUrl || null,
      record.errorMessage || null,
      record.retryCount || 0,
      record.createdAt || now,
      record.publishedAt || null,
      now
    ]);

    return {
      id,
      clipId: record.clipId,
      sourcePage: record.sourcePage || 'studio',
      projectId: record.projectId,
      streamerName: record.streamerName || 'Creator',
      streamerHandle: record.streamerHandle,
      gameOrTopic: record.gameOrTopic,
      sourceStreamUrl: record.sourceStreamUrl,
      videoPath: record.videoPath,
      platform: record.platform,
      accountId: record.accountId,
      title: record.title,
      description: record.description,
      caption: record.caption,
      hashtags: record.hashtags || [],
      youtubeTags: record.youtubeTags || [],
      privacy: record.privacy || 'public',
      status: record.status || 'pending',
      progress: record.progress || 0,
      platformMediaId: record.platformMediaId,
      publishedUrl: record.publishedUrl,
      errorMessage: record.errorMessage,
      retryCount: record.retryCount || 0,
      createdAt: record.createdAt || now,
      publishedAt: record.publishedAt,
      updatedAt: now
    };
  }

  /**
   * Get all publications for a clip ID across all three pages
   */
  static async getPublicationsForClip(clipId: string): Promise<PublishingRecord[]> {
    const rows = await allQuery<any>(`
      SELECT * FROM social_publications WHERE clip_id = ? ORDER BY created_at DESC
    `, [clipId]);

    return rows.map(r => ({
      ...r,
      hashtags: r.hashtags ? JSON.parse(r.hashtags) : [],
      youtubeTags: r.youtube_tags ? JSON.parse(r.youtube_tags) : []
    }));
  }

  /**
   * Get filtered publishing history for Social Studio dashboard
   */
  static async getPublishingHistory(filter: 'all' | 'drafts' | 'ready' | 'publishing' | 'published' | 'failed' = 'all'): Promise<PublishingRecord[]> {
    let sql = `SELECT * FROM social_publications`;
    const params: any[] = [];

    if (filter === 'published') {
      sql += ` WHERE status = 'published'`;
    } else if (filter === 'failed') {
      sql += ` WHERE status = 'failed'`;
    } else if (filter === 'publishing') {
      sql += ` WHERE status IN ('uploading', 'processing')`;
    } else if (filter === 'drafts' || filter === 'ready') {
      sql += ` WHERE status = 'pending'`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const rows = await allQuery<any>(sql, params);
    return rows.map(r => ({
      ...r,
      hashtags: r.hashtags ? JSON.parse(r.hashtags) : [],
      youtubeTags: r.youtube_tags ? JSON.parse(r.youtube_tags) : []
    }));
  }
}
