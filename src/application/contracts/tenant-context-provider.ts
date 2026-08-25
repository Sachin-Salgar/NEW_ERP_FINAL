export interface TenantContextProviderPort {
  getCurrentTenantId(): Promise<string | undefined>;
  getCurrentTenantContext?(): Promise<import('../../domain/contracts/tenant-context.js').TenantContext | undefined>;
  setTenantContext(tenantId: string, context?: Partial<import('../../domain/contracts/tenant-context.js').TenantContext>): Promise<void>;
  withTenantContext<T>(tenantId: string, callback: (client: unknown) => Promise<T>, context?: Partial<import('../../domain/contracts/tenant-context.js').TenantContext>): Promise<T>;
  clearTenantContext(): Promise<void>;
}
