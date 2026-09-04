import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type { MfaSecretProtector } from '../../application/contracts/mfa.js';

/**
 * AES-256-GCM secret protection for persisted MFA material.
 * The constructor accepts arbitrary configured key material and derives a
 * fixed-width encryption key; deployments should source that material from a
 * dedicated secret-management mechanism rather than application source code.
 */
export class AesGcmSecretProtector implements MfaSecretProtector {
  private readonly key: Buffer;

  constructor(keyMaterial: string) {
    if (!keyMaterial || keyMaterial.trim().length < 32) {
      throw new Error('MFA encryption key material must be at least 32 characters');
    }
    this.key = createHash('sha256').update(keyMaterial, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(serialized: string): string {
    const [version, ivEncoded, tagEncoded, ciphertextEncoded] = serialized.split('.');
    if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
      throw new Error('Invalid encrypted MFA secret format');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivEncoded, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
