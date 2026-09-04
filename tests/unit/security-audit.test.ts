import { describe, expect, it, vi } from 'vitest';

import { recordSecurityEvent } from '../../src/presentation/http/security-audit.js';

describe('security audit event adapter', () => {
  it('preserves correlation IDs and never accepts sensitive material in the event contract', async () => {
    const record = vi.fn(async (_event: Record<string, unknown>) => undefined);
    const request = {
      headers: { 'x-correlation-id': 'corr-123' },
      server: { auditLogger: { record } },
    } as never;

    await recordSecurityEvent(request, {
      tenantId: '11111111-1111-4111-8111-111111111111',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      action: 'auth.login.success',
      resourceType: 'session',
      outcome: 'success',
      metadata: { sessionId: '33333333-3333-4333-8333-333333333333' },
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'corr-123',
        metadata: { sessionId: '33333333-3333-4333-8333-333333333333' },
      }),
    );
    expect(JSON.stringify(record.mock.calls[0]?.[0])).not.toMatch(/password|token|secret|credential/i);
  });
});
