import { FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityRegistry } from '../modules/CapabilityRegistry';
import { CapabilityDetailsRequest } from '../types';
import { createLogger, LogLevel } from '../utils/logger';

const logger = createLogger('CapabilityRoute', LogLevel.INFO);

export async function capabilityRoute(
  request: FastifyRequest<{ Body: CapabilityDetailsRequest }>,
  reply: FastifyReply,
  registry: CapabilityRegistry
): Promise<void> {
  try {
    const { capabilities } = request.body;

    if (!capabilities || !Array.isArray(capabilities)) {
      reply.status(400).send({
        success: false,
        error: 'Missing or invalid capabilities field',
      });
      return;
    }

    logger.info(`Getting capability details for: ${capabilities.join(', ')}`);
    const result = await registry.getCapabilityDetails({ capabilities });

    reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error getting capability details:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}