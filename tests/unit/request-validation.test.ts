import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { schemaForRoute } from '../../src/presentation/http/swagger.js';

async function validationApp(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string) {
  const app = Fastify({ logger: false });
  let handlerCalled = false;
  app.route({
    method,
    url,
    schema: { ...schemaForRoute(method, url) },
    handler: async () => {
      handlerCalled = true;
      return { success: true };
    },
  });
  await app.ready();
  return { app, wasHandlerCalled: () => handlerCalled };
}

describe('legacy route request validation', () => {
  it.each([
    ['/organizations', {}],
    ['/organizations/00000000-0000-0000-0000-000000000001/branches', {}],
    ['/locations', {}],
    ['/rbac/roles', {}],
  ] as const)('rejects invalid create body for %s before the handler', async (url, payload) => {
    const { app, wasHandlerCalled } = await validationApp('POST', url);
    try {
      const response = await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
      expect(response.statusCode).toBe(400);
      expect(wasHandlerCalled()).toBe(false);
    } finally {
      await app.close();
    }
  });

  it.each([
    ['/organizations/invalid'],
    ['/locations/invalid'],
    ['/rbac/roles/invalid'],
  ] as const)('rejects malformed identifiers for %s before the handler', async (url) => {
    const routeUrl = url.replace(/\/[^/]+$/, '/:id');
    const { app, wasHandlerCalled } = await validationApp('PATCH', routeUrl);
    try {
      const response = await app.inject({ method: 'PATCH', url, headers: { 'content-type': 'application/json' }, payload: '{}' });
      expect(response.statusCode).toBe(400);
      expect(wasHandlerCalled()).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('rejects invalid permission assignment bodies', async () => {
    const url = '/rbac/roles/00000000-0000-0000-0000-000000000001/permissions';
    const { app, wasHandlerCalled } = await validationApp('POST', url);
    try {
      const response = await app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ permissionKeys: [] }) });
      expect(response.statusCode).toBe(400);
      expect(wasHandlerCalled()).toBe(false);
    } finally {
      await app.close();
    }
  });
});
