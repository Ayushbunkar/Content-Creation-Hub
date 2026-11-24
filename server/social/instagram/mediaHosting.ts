import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MediaHostingConfig } from '../types';

export class MediaHostingAdapter {
  /**
   * Get current media hosting status and configuration
   */
  static getStatus(): MediaHostingConfig {
    if (process.env.PUBLIC_APP_URL) {
      return {
        provider: 'local_tunnel',
        publicBaseUrl: process.env.PUBLIC_APP_URL,
        isConfigured: true,
        statusMessage: `Public URL active via ${process.env.PUBLIC_APP_URL}`
      };
    }

    if (process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID) {
      return {
        provider: 's3',
        s3Bucket: process.env.S3_BUCKET,
        s3Region: process.env.AWS_REGION || 'us-east-1',
        isConfigured: true,
        statusMessage: `S3 storage configured (${process.env.S3_BUCKET})`
      };
    }

    if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
      return {
        provider: 'cloudinary',
        isConfigured: true,
        statusMessage: 'Cloudinary storage configured'
      };
    }

    return {
      provider: 'custom_url',
      isConfigured: false,
      statusMessage: 'Public media hosting is not configured. Set PUBLIC_APP_URL (e.g. ngrok or domain), S3, or Cloudinary in .env'
    };
  }

  /**
   * Resolve publicly accessible HTTPS URL for Instagram container ingestion
   */
  static async getPublicVideoUrl(localFilePath: string): Promise<{ url: string; error?: string }> {
    const status = this.getStatus();

    if (!fs.existsSync(localFilePath)) {
      return { url: '', error: `Local video file does not exist: ${localFilePath}` };
    }

    const fileName = path.basename(localFilePath);

    // Option 1: PUBLIC_APP_URL (e.g. ngrok, localtunnel, Cloudflare Tunnel, or VPS domain)
    if (status.provider === 'local_tunnel' && status.publicBaseUrl) {
      const cleanBase = status.publicBaseUrl.replace(/\/+$/, '');
      const relative = localFilePath.includes('storage') 
        ? localFilePath.slice(localFilePath.indexOf('storage')).replace(/\\/g, '/')
        : `storage/${fileName}`;
      return { url: `${cleanBase}/${relative}` };
    }

    // Option 2: Cloudinary API (Signed Upload)
    if (status.provider === 'cloudinary' && process.env.CLOUDINARY_URL) {
      try {
        const matches = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/(\w+):([^@]+)@([\w-]+)/);
        if (matches) {
          const [, apiKey, apiSecret, cloudName] = matches;
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const toSign = `timestamp=${timestamp}${apiSecret}`;
          const signature = crypto.createHash('sha1').update(toSign).digest('hex');

          const formData = new FormData();
          const fileBlob = new Blob([fs.readFileSync(localFilePath)]);
          formData.append('file', fileBlob, fileName);
          formData.append('api_key', apiKey);
          formData.append('timestamp', timestamp);
          formData.append('signature', signature);
          formData.append('resource_type', 'video');

          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.secure_url) {
            return { url: uploadData.secure_url };
          }
          if (uploadData.error) {
            console.warn('[MediaHosting] Cloudinary error response:', uploadData.error.message);
            return { url: '', error: `Cloudinary upload failed: ${uploadData.error.message}` };
          }
        }
      } catch (err: any) {
        console.warn('[MediaHosting] Cloudinary upload error:', err);
      }
    }

    // If no public hosting is configured, report honest instruction
    return {
      url: '',
      error: 'Instagram Reels publishing requires Meta to fetch the video over HTTPS. Please set PUBLIC_APP_URL (e.g. https://xyz.ngrok-free.app), S3_BUCKET, or CLOUDINARY_URL in your .env file.'
    };
  }
}
