import { FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger, LogLevel } from '../utils/logger';

const logger = createLogger('DownloadRoute', LogLevel.INFO);
const TEMP_DIR = '/tmp/code-executor';

export async function downloadRoute(
  request: FastifyRequest<{ Params: { filename: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { filename } = request.params;
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(TEMP_DIR, decodedFilename);

    if (!fs.existsSync(filePath)) {
      reply.status(404).send({
        success: false,
        error: 'File not found',
      });
      return;
    }

    const stats = fs.statSync(filePath);
    
    if (!stats.isFile()) {
      reply.status(400).send({
        success: false,
        error: 'Not a file',
      });
      return;
    }

    const fileStream = fs.createReadStream(filePath);
    const ext = path.extname(decodedFilename).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.txt') {
      contentType = 'text/plain';
    } else if (ext === '.csv') {
      contentType = 'text/csv';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    }

    reply.type(contentType);
    reply.header('Content-Disposition', `attachment; filename="${decodedFilename}"`);
    reply.header('Cache-Control', 'no-cache');
    
    reply.send(fileStream);
    
    logger.info(`File downloaded: ${decodedFilename}`);
  } catch (error) {
    logger.error('Error downloading file:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function listFilesRoute(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    if (!fs.existsSync(TEMP_DIR)) {
      reply.send({
        success: true,
        files: [],
      });
      return;
    }

    const allFiles = fs.readdirSync(TEMP_DIR);
    const files: any[] = [];

    for (const file of allFiles) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        files.push({
          name: file,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          downloadUrl: `/download/${encodeURIComponent(file)}`,
        });
      }
    }

    files.sort((a, b) => b.created.localeCompare(a.created));

    reply.send({
      success: true,
      files,
    });
  } catch (error) {
    logger.error('Error listing files:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}