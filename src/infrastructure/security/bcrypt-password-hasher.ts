import { compare, hash } from 'bcryptjs';

import type { PasswordHasher } from '../../application/contracts/security.js';

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return hash(password, 10);
  }

  async verify(password: string, hashValue: string): Promise<boolean> {
    return compare(password, hashValue);
  }
}
