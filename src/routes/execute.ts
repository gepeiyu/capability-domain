import { FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityRegistry } from '../modules/CapabilityRegistry';
import { ExecuteRequest } from '../types';
import { createLogger, LogLevel } from '../utils/logger';

const logger = createLogger('ExecuteRoute', LogLevel.INFO);

export async function executeRoute(
  request: FastifyRequest<{ Body: ExecuteRequest }>,
  reply: FastifyReply,
  registry: CapabilityRegistry
): Promise<void> {
  try {
    const capabilities = request.body;

    if (!Array.isArray(capabilities)) {
      reply.status(400).send({
        success: false,
        error: 'Request body must be an array',
      });
      return;
    }

    for (const cap of capabilities) {
      if (!cap.name) {
        reply.status(400).send({
          success: false,
          error: 'Each capability must have a name field',
        });
        return;
      }
    }

    logger.info(`Executing ${capabilities.length} capabilities`);
    const result = await registry.executeBatch(request.body);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error executing capabilities:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}