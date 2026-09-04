import { v7 as uuidV7 } from 'uuid';

export function createTenantBootstrapInput(overrides: Record<string, unknown> = {}) {
  const suffix = uuidV7();
  return {
    tenant: {
      name: `Test Tenant ${suffix}`,
      displayName: `Test Tenant ${suffix}`,
      subdomain: `test-${suffix}`,
      slug: `test-${suffix}`,
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en_US',
    },
    organization: {
      code: `TEST${suffix}`.slice(0, 18),
      name: `Test Organization ${suffix}`,
      fiscalCalendar: 'standard',
    },
    branch: {
      code: `BR-${suffix}`.slice(0, 15),
      name: `Test Branch ${suffix}`,
      city: 'Pune',
      state: 'Maharashtra',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
    administrator: {
      username: `admin-${suffix}`,
      email: `admin-${suffix}@example.com`,
      password: 'Password123!',
    },
    role: {
      code: `admin-${suffix}`.slice(0, 20),
      name: 'Administrator',
    },
    permissions: [],
    subscriptionPlanName: 'Starter',
    initialFinancialYear: {
      name: `FY-${suffix}`,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    },
    ...overrides,
  };
}
