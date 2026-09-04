import { v7 as uuidV7 } from 'uuid';

export interface TestIdentityFactoryOptions {
  tenantId?: string;
  organizationId?: string;
  branchId?: string;
  locationId?: string;
  userId?: string;
  username?: string;
  email?: string;
}

export function createTestIdentity(overrides: TestIdentityFactoryOptions = {}) {
  const suffix = uuidV7();
  return {
    tenantId: overrides.tenantId ?? uuidV7(),
    organizationId: overrides.organizationId ?? uuidV7(),
    branchId: overrides.branchId ?? uuidV7(),
    locationId: overrides.locationId ?? uuidV7(),
    userId: overrides.userId ?? uuidV7(),
    username: overrides.username ?? `user-${suffix}`,
    email: overrides.email ?? `user-${suffix}@example.com`,
  };
}

export function createTenantHeaders(tenantId: string, accessToken?: string) {
  return {
    'x-tenant-id': tenantId,
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

export function createPaginationQuery(overrides: Partial<{
  page: number;
  page_size: number;
  sort: string;
  order: 'asc' | 'desc';
  search: string;
}> = {}) {
  return {
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 20,
    sort: overrides.sort,
    order: overrides.order ?? 'asc',
    search: overrides.search,
  };
}

export async function expectRejectsWithCode(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    const candidate = error as { code?: unknown };
    if (candidate.code !== expectedCode) {
      throw error;
    }
    return;
  }

  throw new Error(`Expected operation to reject with code ${expectedCode}.`);
}
