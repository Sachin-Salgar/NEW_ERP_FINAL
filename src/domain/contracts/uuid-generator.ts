export interface UuidGenerator {
  generate(): string;
  isValid(value: string): boolean;
}
