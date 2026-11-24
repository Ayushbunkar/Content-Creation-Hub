import { TokenStorage } from './tokenStorage';
import { SocialAccountProfile } from '../types';

export interface OAuthCredentialsConfig {
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  meta: {
    appId: string;
    appSecret: string;
    redirectUri: string;
  };
}

export class OAuthService {
  /**
   * Load OAuth environment credentials
   */
  static getCredentials(): OAuthCredentialsConfig {
    const port = process.env.PORT || '3000';
    const baseUrl = process.env.APP_BASE_URL || `http://127.0.0.1:${port}`;
    return {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/social/oauth/google/callback`
      },
      meta: {
        appId: process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || '',
        appSecret: process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || '',
        redirectUri: process.env.META_REDIRECT_URI || `${baseUrl}/api/social/oauth/meta/callback`
      }
    };
  }

  // ==========================================
  // GOOGLE / YOUTUBE OAUTH FLOW
  // ==========================================

  /**
   * Generate Google OAuth 2.0 Consent URL
   */
  static getGoogleAuthUrl(state?: string): { url: string; error?: string } {
    const creds = this.getCredentials().google;
    if (!creds.clientId) {
      return {
        url: '',
        error: 'Google Client ID is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
      };
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: creds.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline', // Requests refresh_token
      prompt: 'consent',      // Forces prompt so refresh_token is always returned
      state: state || 'youtube_connect'
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  /**
   * Exchange Google authorization code for access & refresh tokens and fetch channel profile
   */
  static async handleGoogleCallback(code: string): Promise<{ profile: Partial<SocialAccountProfile>; error?: string }> {
    const creds = this.getCredentials().google;
    if (!creds.clientId || !creds.clientSecret) {
      return { profile: {}, error: 'Google OAuth credentials missing on server.' };
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: creds.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        return {
          profile: {},
          error: `Google Token Exchange Failed: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
        };
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;
      const expiryDate = new Date(Date.now() + expiresIn * 1000).toISOString();

      // 2. Fetch YouTube Channel details
      const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const channelData = await channelRes.json();
      let channelName = 'YouTube Shorts Channel';
      let handle = '@channel';
      let avatarUrl = '';
      let subscribers = '0';
      let channelId = '';

      if (channelData.items && channelData.items.length > 0) {
        const item = channelData.items[0];
        channelId = item.id;
        channelName = item.snippet?.title || channelName;
        handle = item.snippet?.customUrl ? `@${item.snippet.customUrl.replace(/^@/, '')}` : `@${channelName.toLowerCase().replace(/\s+/g, '')}`;
        avatarUrl = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '';
        const subCount = parseInt(item.statistics?.subscriberCount || '0', 10);
        subscribers = subCount >= 1000000 ? `${(subCount / 1000000).toFixed(1)}M` : subCount >= 1000 ? `${(subCount / 1000).toFixed(1)}K` : `${subCount}`;
      }

      return {
        profile: {
          platform: 'youtube',
          accountId: channelId,
          accountName: channelName,
          handle,
          avatarUrl,
          subscribers,
          accountType: 'creator',
          connected: true,
          authType: 'oauth',
          tokenExpiry: expiryDate,
          metadata: {
            accessTokenEncrypted: TokenStorage.encrypt(accessToken),
            refreshTokenEncrypted: refreshToken ? TokenStorage.encrypt(refreshToken) : undefined
          }
        }
      };
    } catch (err: any) {
      console.error('[OAuthService] Google callback error:', err);
      return { profile: {}, error: err.message || 'Network error communicating with Google OAuth.' };
    }
  }

  /**
   * Refresh Google access token if expired
   */
  static async refreshGoogleToken(refreshTokenEncrypted: string): Promise<{ accessToken: string; error?: string }> {
    const creds = this.getCredentials().google;
    const refreshToken = TokenStorage.decrypt(refreshTokenEncrypted);
    if (!refreshToken) {
      return { accessToken: '', error: 'No valid refresh token stored.' };
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { accessToken: '', error: `Refresh token failed: ${data.error_description || data.error}` };
      }

      return { accessToken: data.access_token };
    } catch (e: any) {
      return { accessToken: '', error: e.message };
    }
  }

  // ==========================================
  // META / INSTAGRAM GRAPH OAUTH FLOW
  // ==========================================

  /**
   * Generate Meta OAuth Consent URL for Instagram Content Publishing API
   */
  static getMetaAuthUrl(state?: string): { url: string; error?: string } {
    const creds = this.getCredentials().meta;
    if (!creds.appId) {
      return {
        url: '',
        error: 'Meta App ID is not configured. Set META_APP_ID and META_APP_SECRET in .env'
      };
    }

    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement'
    ];

    const params = new URLSearchParams({
      client_id: creds.appId,
      redirect_uri: creds.redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      auth_type: 'rerequest',
      state: state || 'instagram_connect'
    });

    return { url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}` };
  }

  /**
   * Exchange Meta code for Instagram Creator/Business account
   */
  static async handleMetaCallback(code: string): Promise<{ profile: Partial<SocialAccountProfile>; error?: string }> {
    const creds = this.getCredentials().meta;
    if (!creds.appId || !creds.appSecret) {
      return { profile: {}, error: 'Meta App credentials missing on server.' };
    }

    try {
      // 1. Exchange code for short-lived access token
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${creds.appId}&redirect_uri=${encodeURIComponent(creds.redirectUri)}&client_secret=${creds.appSecret}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || tokenData.error) {
        return {
          profile: {},
          error: `Meta Token Exchange Failed: ${tokenData.error?.message || tokenRes.statusText}`
        };
      }

      const shortToken = tokenData.access_token;

      // 2. Exchange for 60-day Long-Lived User Access Token
      const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${creds.appId}&client_secret=${creds.appSecret}&fb_exchange_token=${shortToken}`;
      const longRes = await fetch(longUrl);
      const longData = await longRes.json();
      const userAccessToken = longData.access_token || shortToken;

      // 3. Get connected Facebook Pages and their linked Instagram Business / Creator accounts
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`);
      const pagesData = await pagesRes.json();
      console.log('[OAuthService] Meta /me/accounts response:', JSON.stringify(pagesData, null, 2));

      let igAccountId = '';
      let pageAccessToken = userAccessToken;

      if (pagesData.data && pagesData.data.length > 0) {
        for (const page of pagesData.data) {
          if (page.instagram_business_account?.id) {
            igAccountId = page.instagram_business_account.id;
            pageAccessToken = page.access_token || userAccessToken;
            break;
          }
        }
      }

      if (!igAccountId) {
        const pagesList = pagesData.data || [];
        const pageNames = pagesList.map((p: any) => `${p.name} (IG Linked: ${p.instagram_business_account?.id ? 'YES' : 'NO'})`).join(', ') || 'None (No pages authorized)';
        console.error('[OAuthService] No linked IG account found. Pages status:', pageNames);
        return {
          profile: {},
          error: `No Instagram Professional Account linked to your Facebook Pages. (Pages detected: ${pageNames}). If your page is not listed, remove Video Studio from facebook.com/settings?tab=business_tools and re-connect so Facebook asks to select your new page.`
        };
      }

      // 4. Fetch Instagram Account Profile
      const igRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}?fields=username,name,profile_picture_url,followers_count,media_count&access_token=${pageAccessToken}`);
      const igData = await igRes.json();

      const username = igData.username || 'instagram_creator';
      const name = igData.name || username;
      const avatarUrl = igData.profile_picture_url || '';
      const followers = igData.followers_count !== undefined
        ? (igData.followers_count >= 1000 ? `${(igData.followers_count / 1000).toFixed(1)}K` : `${igData.followers_count}`)
        : '0';

      return {
        profile: {
          platform: 'instagram',
          accountId: igAccountId,
          accountName: name,
          handle: `@${username}`,
          avatarUrl,
          subscribers: followers,
          accountType: 'business',
          connected: true,
          authType: 'oauth',
          tokenExpiry: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
          metadata: {
            accessTokenEncrypted: TokenStorage.encrypt(pageAccessToken),
            userAccessTokenEncrypted: TokenStorage.encrypt(userAccessToken)
          }
        }
      };
    } catch (err: any) {
      console.error('[OAuthService] Meta callback error:', err);
      return { profile: {}, error: err.message || 'Error communicating with Meta Graph API.' };
    }
  }
}
