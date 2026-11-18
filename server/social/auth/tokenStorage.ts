import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Secure AES-256-GCM encryption for storing OAuth access and refresh tokens.
 * Key is stored in storage/.vault.key (chmod protected/gitignored) or APP_ENCRYPTION_KEY env var.
 */
export class TokenStorage {
  private static keyCache: Buffer | null = null;

  private static getMasterKey(): Buffer {
    if (this.keyCache) return this.keyCache;

    if (process.env.APP_ENCRYPTION_KEY && process.env.APP_ENCRYPTION_KEY.length >= 32) {
      this.keyCache = crypto.scryptSync(process.env.APP_ENCRYPTION_KEY, 'studio_salt_vault', 32);
      return this.keyCache;
    }

    const keyPath = path.join(process.cwd(), 'storage', '.vault.key');
    if (fs.existsSync(keyPath)) {
      try {
        const hex = fs.readFileSync(keyPath, 'utf-8').trim();
        if (hex.length === 64) {
          this.keyCache = Buffer.from(hex, 'hex');
          return this.keyCache;
        }
      } catch (e) {
        console.warn('[TokenStorage] Error reading vault key:', e);
      }
    }

    // Generate random 256-bit key
    const newKey = crypto.randomBytes(32);
    try {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
    } catch (e) {
      console.warn('[TokenStorage] Error writing vault key:', e);
    }
    this.keyCache = newKey;
    return this.keyCache;
  }

  /**
   * Encrypt a sensitive token string
   */
  static encrypt(plaintext: string): string {
    if (!plaintext) return '';
    try {
      const key = this.getMasterKey();
      const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      // Format: iv:tag:encrypted
      return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (e) {
      console.error('[TokenStorage] Encryption error:', e);
      throw new Error('Failed to encrypt secret token');
    }
  }

  /**
   * Decrypt an encrypted token string
   */
  static decrypt(ciphertext: string): string {
    if (!ciphertext) return '';
    if (!ciphertext.includes(':')) {
      // In case an unencrypted token was stored, return safely
      return ciphertext;
    }
    try {
      const key = this.getMasterKey();
      const [ivHex, tagHex, dataHex] = ciphertext.split(':');
      if (!ivHex || !tagHex || !dataHex) return '';
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const data = Buffer.from(dataHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted.toString('utf-8');
    } catch (e) {
      console.error('[TokenStorage] Decryption error:', e);
      return '';
    }
  }
}
