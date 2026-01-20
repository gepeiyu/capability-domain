import Fastify from 'fastify';
import cors from '@fastify/cors';
import { CapabilityRegistry } from './modules/CapabilityRegistry';
import { metadataRoute } from './routes/metadata';
import { capabilityRoute } from './routes/capability';
import { executeRoute } from './routes/execute';
import { downloadRoute, listFilesRoute } from './routes/download';
import { ExecuteRequest, CapabilityDetailsRequest } from './types';
import { createLogger, LogLevel } from './utils/logger';

const logger = createLogger('App', LogLevel.INFO);

export async function createApp(domainsPath: string = './domains') {
  const fastify = Fastify({
    logger: false,
  });

  await fastify.register(cors, {
    origin: true,
  });

  const registry = new CapabilityRegistry(domainsPath);

  await registry.initialize();

  fastify.get('/metadata', async (request, reply) => {
    await metadataRoute(request, reply, registry);
  });

  fastify.post<{ Body: CapabilityDetailsRequest }>('/capability', async (request, reply) => {
    await capabilityRoute(request, reply, registry);
  });

  fastify.post<{ Body: ExecuteRequest }>('/execute', async (request, reply) => {
    await executeRoute(request, reply, registry);
  });

  fastify.get<{ Params: { filename: string } }>('/download/:filename', async (request, reply) => {
    await downloadRoute(request, reply);
  });

  fastify.get('/files', async (request, reply) => {
    await listFilesRoute(request, reply);
  });

  fastify.get('/health', async (request, reply) => {
    const stats = registry.getStats();
    reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      stats,
    });
  });

  fastify.get('/refresh', async (request, reply) => {
    try {
      await registry.refresh();
      reply.send({
        success: true,
        message: 'Capabilities refreshed successfully',
      });
    } catch (error) {
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return { fastify, registry };
}

export async function startHttpServer(
  host: string = '0.0.0.0',
  port: number = 5271,
  domainsPath: string = './domains'
) {
  const { fastify } = await createApp(domainsPath);

  try {
    await fastify.listen({ host, port });
    logger.info(`HTTP server listening on http://${host}:${port}`);
  } catch (err) {
    logger.error('Error starting HTTP server:', err);
    process.exit(1);
  }

  return fastify;
}

export async function startUdsServer(
  socketPath: string = '/tmp/cdr.sock',
  domainsPath: string = './domains'
) {
  const { fastify } = await createApp(domainsPath);

  try {
    await fastify.listen({ path: socketPath });
    logger.info(`UDS server listening on ${socketPath}`);
  } catch (err) {
    logger.error('Error starting UDS server:', err);
    process.exit(1);
  }

  return fastify;
}

async function main() {
  const mode = process.env.SERVER_MODE || 'http';
  const host = process.env.HTTP_HOST || '0.0.0.0';
  const port = parseInt(process.env.HTTP_PORT || '5271', 10);
  const socketPath = process.env.UDS_SOCKET_PATH || '/tmp/cdr.sock';
  const domainsPath = process.env.DOMAINS_PATH || './domains';

  logger.info(`Starting Capability-Domain server in ${mode} mode...`);

  if (mode === 'http') {
    await startHttpServer(host, port, domainsPath);
  } else if (mode === 'uds') {
    await startUdsServer(socketPath, domainsPath);
  } else {
    logger.error(`Invalid server mode: ${mode}. Must be 'http' or 'uds'`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('Fatal error:', err);
    process.exit(1);
  });
}