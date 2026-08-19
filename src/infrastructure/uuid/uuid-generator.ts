import { validate, v7 } from 'uuid';

import type { UuidGenerator } from '../../domain/contracts/uuid-generator.js';

export class UuidV7Generator implements UuidGenerator {
  generate(): string {
    return v7();
  }

  isValid(value: string): boolean {
    return validate(value);
  }
}
