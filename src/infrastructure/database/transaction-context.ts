import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';

interface TransactionContext {
  client: PoolClient;
  tenantId?: string;
}

const storage = new AsyncLocalStorage<TransactionContext>();

export function getTransactionContext(): TransactionContext | undefined {
  return storage.getStore();
}

export function setTransactionTenant(tenantId: string): void {
  const context = storage.getStore();
  if (!context) {
    throw new Error('No active transaction context.');
  }

  if (context.tenantId && context.tenantId !== tenantId) {
    throw new Error('A transaction cannot be reused across tenant contexts.');
  }

  context.tenantId = tenantId;
}

export async function runInTransactionContext<T>(client: PoolClient, callback: () => Promise<T>): Promise<T> {
  return storage.run({ client }, callback);
}
