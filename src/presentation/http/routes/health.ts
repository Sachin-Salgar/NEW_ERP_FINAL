import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'new-erp-final',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/ready', async () => ({
    status: 'ready',
    service: 'new-erp-final',
    timestamp: new Date().toISOString(),
  }));
};

export default healthRoutes;
