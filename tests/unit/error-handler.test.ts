import { describe, expect, it, vi } from 'vitest';

import { buildErrorHandler } from '../../src/infrastructure/http/error-handler.js';
import { NotFoundError } from '../../src/domain/errors.js';

const config = { NODE_ENV: 'test' } as Parameters<typeof buildErrorHandler>[0];

describe('error handler', () => {
  it('returns RFC 7807 when explicitly requested through Accept', () => {
    const send = vi.fn();
    const type = vi.fn().mockReturnValue({ code: vi.fn().mockReturnValue({ send }) });
    const reply = { type, code: vi.fn().mockReturnValue({ send }) };
    const request = {
      id: 'req-123',
      url: '/api/v1/example/missing',
      headers: { accept: 'application/problem+json' },
      log: { error: vi.fn() },
    };

    buildErrorHandler(config)(new NotFoundError('Record not found.'), request as never, reply as never);

    expect(type).toHaveBeenCalledWith('application/problem+json');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'https://httpstatuses.com/404',
        status: 404,
        detail: 'Record not found.',
        instance: '/api/v1/example/missing',
      }),
    );
  });

  it('keeps the existing error envelope by default', () => {
    const send = vi.fn();
    const code = vi.fn().mockReturnValue({ send });
    const reply = { code };
    const request = {
      id: 'req-456',
      url: '/api/v1/example/missing',
      headers: {},
      log: { error: vi.fn() },
    };

    buildErrorHandler(config)(new NotFoundError('Record not found.'), request as never, reply as never);

    expect(code).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Record not found.',
          requestId: 'req-456',
        }),
      }),
    );
  });

  it('keeps the existing error envelope for wildcard Accept to avoid changing legacy clients', () => {
    const send = vi.fn();
    const code = vi.fn().mockReturnValue({ send });
    const type = vi.fn();
    const reply = { code, type };
    const request = {
      id: 'req-789',
      url: '/api/v1/example/missing',
      headers: { accept: '*/*' },
      log: { error: vi.fn() },
    };

    buildErrorHandler(config)(new NotFoundError('Record not found.'), request as never, reply as never);

    expect(type).not.toHaveBeenCalled();
    expect(code).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          requestId: 'req-789',
        }),
      }),
    );
  });
});
