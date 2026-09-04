import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { TotpProvider } from '../../application/contracts/mfa.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TotpOptions {
  digits?: number;
  periodSeconds?: number;
  window?: number;
}

export class Rfc6238TotpProvider implements TotpProvider {
  private readonly digits: number;
  private readonly periodSeconds: number;
  private readonly window: number;

  constructor(options: TotpOptions = {}) {
    this.digits = options.digits ?? 6;
    this.periodSeconds = options.periodSeconds ?? 30;
    this.window = options.window ?? 1;
  }

  generateSecret(): string {
    return encodeBase32(randomBytes(20));
  }

  verify(secret: string, token: string, at = new Date()): boolean {
    if (!/^\d+$/.test(token) || token.length !== this.digits) return false;

    const counter = Math.floor(at.getTime() / 1000 / this.periodSeconds);
    const candidate = Buffer.from(token, 'utf8');

    for (let offset = -this.window; offset <= this.window; offset += 1) {
      const expected = Buffer.from(generateTotp(secret, counter + offset, this.digits), 'utf8');
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
    }

    return false;
  }
}

export function generateTotp(secret: string, counter: number, digits = 6): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
