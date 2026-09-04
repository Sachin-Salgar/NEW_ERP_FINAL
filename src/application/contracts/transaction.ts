export interface TransactionRunner {
  runInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}
