import { FastifyRequest, FastifyReply } from 'fastify';
import { CapabilityRegistry } from '../modules/CapabilityRegistry';
import { MetadataResponse } from '../types';
import { createLogger, LogLevel } from '../utils/logger';

const logger = createLogger('MetadataRoute', LogLevel.INFO);

export async function metadataRoute(
  request: FastifyRequest,
  reply: FastifyReply,
  registry: CapabilityRegistry
): Promise<void> {
  try {
    logger.info('Getting metadata');
    const metadata: MetadataResponse = await registry.getMetadata();
    
    reply.type('text/markdown').send(metadata.markdown);
  } catch (error) {
    logger.error('Error getting metadata:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}