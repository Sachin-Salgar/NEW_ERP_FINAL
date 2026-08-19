export interface TenantContext {
  tenantId: string;
}

export interface TenantContextProvider {
  getCurrentTenantId(): Promise<string | undefined>;
  setTenantContext(tenantId: string): Promise<void>;
  withTenantContext<T>(tenantId: string, callback: (client: unknown) => Promise<T>): Promise<T>;
  clearTenantContext(): Promise<void>;
}
