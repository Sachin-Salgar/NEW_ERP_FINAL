export interface TenantContext {
  tenantId: string;
  identityId?: string | null;
  userId?: string | null;
  roleIds?: string[];
  permissionKeys?: string[];
  branchAccess?: string[];
  sessionId?: string | null;
  resolvedAt?: Date | string | null;
}

export interface TenantContextProvider {
  getCurrentTenantId(): Promise<string | undefined>;
  getCurrentTenantContext?(): Promise<TenantContext | undefined>;
  setTenantContext(tenantId: string, context?: Partial<TenantContext>): Promise<void>;
  withTenantContext<T>(
    tenantId: string,
    callback: (client: unknown) => Promise<T>,
    context?: Partial<TenantContext>,
  ): Promise<T>;
  clearTenantContext(): Promise<void>;
}
