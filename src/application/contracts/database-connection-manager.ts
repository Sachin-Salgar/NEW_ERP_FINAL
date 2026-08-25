export interface DatabaseConnectionManager {
  readonly isHealthy: boolean;
  ensureHealthy(): Promise<void>;
  close(): Promise<void>;
}
