import type { FastifyPluginAsync } from 'fastify';

import { NotFoundError } from '../../../domain/errors.js';

const jwksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/.well-known/jwks.json',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Get JWT public signing keys',
        description:
          'Returns non-retired public RS256 signing keys. Available only when asymmetric JWT signing is configured.',
        response: {
          200: {
            type: 'object',
            required: ['keys'],
            properties: {
              keys: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['kty', 'use', 'alg', 'kid', 'n', 'e'],
                  properties: {
                    kty: { type: 'string', const: 'RSA' },
                    use: { type: 'string', const: 'sig' },
                    alg: { type: 'string', const: 'RS256' },
                    kid: { type: 'string' },
                    n: { type: 'string' },
                    e: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
            },
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      const jwks = request.server.jwtTokenService.getJwks();
      if (!jwks) {
        throw new NotFoundError('JWKS is unavailable while asymmetric JWT signing is disabled.');
      }
      reply.header('Cache-Control', 'public, max-age=300');
      return jwks;
    },
  );
};

export default jwksRoutes;
