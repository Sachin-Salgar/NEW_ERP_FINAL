export interface TenantContextProviderPort {
  getCurrentTenantId(): Promise<string | undefined>;
  setTenantContext(tenantId: string): Promise<void>;
  withTenantContext<T>(tenantId: string, callback: (client: unknown) => Promise<T>): Promise<T>;
  clearTenantContext(): Promise<void>;
}
