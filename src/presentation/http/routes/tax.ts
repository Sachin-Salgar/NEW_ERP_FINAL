import type { FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/auth.js';
const ctx = (r: any) => ({ tenantId: r.tenantId, organizationId: r.user.organizationId, userId: r.user.id });
const routes: FastifyPluginAsync = async f => {
  f.post('/tax/rules', { preHandler: [requireAuth, requirePermission('tax.configuration.create')] }, async (r: any, h) => { h.code(201); return { success: true, rule: await f.taxService.create(ctx(r), r.body) }; });
  f.get('/tax/rules', { preHandler: [requireAuth, requirePermission('tax.configuration.read')] }, async (r: any) => ({ success: true, rules: await f.taxService.list(ctx(r)) }));
  f.patch('/tax/rules/:id', { preHandler: [requireAuth, requirePermission('tax.configuration.update')] }, async (r: any) => ({ success: true, rule: await f.taxService.update(ctx(r), r.params.id, r.body) }));
  for (const status of ['activate', 'deactivate'] as const) f.post(`/tax/rules/:id/${status}`, { preHandler: [requireAuth, requirePermission(`tax.configuration.${status}`)] }, async (r: any) => ({ success: true, rule: await f.taxService.transition(ctx(r), r.params.id, status === 'activate' ? 'ACTIVE' : 'INACTIVE', r.body.expectedVersion) }));
};
export default routes;
