import { SkillLoader } from './SkillLoader';
import { McpManager } from './McpManager';
import { SkillMetadata, SkillContent } from '../types/skill';
import { McpTool, McpToolCallResult } from '../types/mcp';
import { 
  MetadataResponse, 
  ExecuteRequest, 
  ExecuteResponse, 
  ExecuteResult,
  CapabilityDetailsRequest,
  CapabilityDetailsResponse,
  SkillDetail,
  ToolDetail,
  CodeDetail,
  CommandDetail
} from '../types';
import { createLogger, LogLevel } from '../utils/logger';

export class CapabilityRegistry {
  private skillLoader: SkillLoader;
  private mcpManager: McpManager;
  private logger = createLogger('CapabilityRegistry', LogLevel.INFO);
  private initialized: boolean = false;

  constructor(domainsPath: string = './domains') {
    this.skillLoader = new SkillLoader(domainsPath);
    this.mcpManager = new McpManager(domainsPath);
  }

  /**
   * 初始化注册表
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('CapabilityRegistry already initialized');
      return;
    }

    this.logger.info('Initializing CapabilityRegistry...');

    try {
      this.skillLoader.loadAllSkillMetadata();
      await this.mcpManager.loadMcpConfigs();
      await this.mcpManager.discoverTools();

      this.initialized = true;
      this.logger.info('CapabilityRegistry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CapabilityRegistry:', error);
      throw error;
    }
  }

  /**
   * 获取所有能力的元数据（Markdown + YAML 混合格式）
   */
  async getMetadata(): Promise<MetadataResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const skills = this.skillLoader.getAllCachedMetadata();
    const mcpTools = this.mcpManager.getAllTools();

    let markdown = '# Capability\n\n';
    markdown += '## Usage\n\n';
    markdown += 'When users ask you to perform tasks, check if any of available capabilities below can help complete task more effectively. Capabilities provide specialized capabilities and domain knowledge.\n\n';
    markdown += 'How to use capabilities:\n';
    markdown += '- Get details: POST /capability with { "capabilities": ["code-reviewer", "amap-search"] }\n';
    markdown += '- Execute: POST /execute with { "capabilities": [{"name": "code-reviewer", "input": {...}}, {"name": "amap-search", "input": {...}}] }\n\n';
    markdown += 'Usage notes:\n';
    markdown += '- Only use capabilities listed below\n';
    markdown += '- Each capability invocation is stateless\n\n';
    markdown += '## Available Capabilities\n\n';

    for (const skill of skills) {
      markdown += `- name: ${skill.name}\n`;
      markdown += `  description: ${skill.description}\n\n`;
    }

    for (const tool of mcpTools) {
      markdown += `- name: ${tool.name}\n`;
      markdown += `  description: ${tool.description}\n\n`;
    }

    return {
      markdown,
    };
  }

  /**
   * 获取能力详情
   */
  async getCapabilityDetails(request: CapabilityDetailsRequest): Promise<CapabilityDetailsResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const capabilities: (SkillDetail | ToolDetail | CodeDetail | CommandDetail)[] = [];

    for (const name of request.capabilities) {
      const skillMetadata = this.skillLoader.getAllCachedMetadata().find(s => s.name === name);
      if (skillMetadata) {
        const skillContent = this.skillLoader.loadSkillContent(skillMetadata.id);
        if (skillContent) {
          capabilities.push({
            name: skillMetadata.name,
            description: skillMetadata.description,
            implementation: 'skill',
            content: skillContent.content,
            references: skillContent.references,
            scripts: skillContent.scripts,
            assets: skillContent.assets,
          });
        }
        continue;
      }

      const tool = this.mcpManager.getAllTools().find(t => t.name === name);
      if (tool) {
        capabilities.push({
          name: tool.name,
          description: tool.description,
          implementation: 'tool',
          inputSchema: tool.inputSchema,
          mcpId: tool.mcpId,
        });
        continue;
      }

      if (name === 'execute-python') {
        capabilities.push({
          name: 'execute-python',
          description: 'Execute Python code and return result',
          implementation: 'code',
          language: 'python',
        });
        continue;
      }

      if (name === 'execute-nodejs') {
        capabilities.push({
          name: 'execute-nodejs',
          description: 'Execute Node.js code and return result',
          implementation: 'code',
          language: 'nodejs',
        });
        continue;
      }
    }

    return {
      capabilities,
    };
  }

  /**
   * 批量执行能力
   */
  async executeBatch(request: ExecuteRequest): Promise<ExecuteResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: ExecuteResult[] = [];

    for (const capability of request) {
      const result = await this.executeSingle(capability.name, capability.input || {});
      results.push(result);
    }

    return {
      results,
    };
  }

  /**
   * 执行单个能力
   */
  private async executeSingle(name: string, input: Record<string, any>): Promise<ExecuteResult> {
    this.logger.info(`Executing capability: ${name}`);

    const tool = this.mcpManager.getAllTools().find(t => t.name === name);
    if (tool) {
      return await this.executeMcpTool(tool.id, input);
    }

    if (name === 'execute-python') {
      return await this.executeCode('python', input);
    }

    if (name === 'execute-nodejs') {
      return await this.executeCode('nodejs', input);
    }

    return {
      name,
      success: false,
      error: `Capability not found or not executable: ${name}`,
    };
  }

  /**
   * 执行 MCP Tool
   */
  private async executeMcpTool(toolId: string, input: Record<string, any>): Promise<ExecuteResult> {
    try {
      const tool = this.mcpManager.getAllTools().find(t => t.id === toolId);
      const result = await this.mcpManager.callTool(toolId, input);

      if (result.success) {
        this.logger.info(`Successfully executed MCP tool: ${toolId}`);
        return {
          name: tool?.name || toolId,
          success: true,
          result: result.result,
        };
      } else {
        return {
          name: tool?.name || toolId,
          success: false,
          error: result.error || 'Unknown MCP error',
        };
      }
    } catch (error) {
      this.logger.error(`Error executing MCP tool ${toolId}:`, error);
      return {
        name: toolId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 执行代码（Python 或 Node.js）
   */
  private async executeCode(language: 'python' | 'nodejs', input: Record<string, any>): Promise<ExecuteResult> {
    try {
      const { exec } = require('child_process');
      const fs = require('fs');
      const path = require('path');

      const tempDir = '/tmp/code-executor';
      const extension = language === 'python' ? '.py' : '.js';
      const command = language === 'python' ? 'python3' : 'node';
      const timestamp = Date.now();
      const tempFile = path.join(tempDir, `${language}_${timestamp}${extension}`);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const code = input.code || '';
      fs.writeFileSync(tempFile, code);

      return new Promise((resolve, reject) => {
        exec(`${command} ${tempFile}`, { timeout: 30000, cwd: tempDir }, (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject({ error: error.message, stderr });
          } else {
            resolve({ stdout, stderr, tempDir });
          }
        });
      }).then((result: any) => {
        this.logger.info(`Successfully executed ${language} code`);
        
        const files = this.scanGeneratedFiles(result.tempDir, timestamp);
        
        return {
          name: `execute-${language}`,
          success: true,
          result: {
            stdout: result.stdout,
            stderr: result.stderr,
            files: files,
            executionTime: new Date().toISOString(),
          },
        };
      }).catch((error: any) => {
        return {
          name: `execute-${language}`,
          success: false,
          error: error.error || error.message,
        };
      });
    } catch (error) {
      this.logger.error(`Error executing ${language} code:`, error);
      return {
        name: `execute-${language}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 扫描生成的文件
   */
  private scanGeneratedFiles(tempDir: string, timestamp: number): any[] {
    const fs = require('fs');
    const path = require('path');
    const files: any[] = [];

    try {
      if (!fs.existsSync(tempDir)) {
        return files;
      }

      const allFiles = fs.readdirSync(tempDir);
      
      for (const file of allFiles) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          files.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            downloadUrl: `/download/${encodeURIComponent(file)}`,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error scanning generated files:`, error);
    }

    return files;
  }

  /**
   * 刷新所有能力
   */
  async refresh(): Promise<void> {
    this.logger.info('Refreshing capabilities...');

    try {
      this.skillLoader.refreshMetadata();
      await this.mcpManager.refreshTools();

      this.logger.info('Capabilities refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh capabilities:', error);
      throw error;
    }
  }

  /**
   * 获取 Skill 元数据
   */
  getSkillMetadata(skillId: string): SkillMetadata | undefined {
    return this.skillLoader.getSkillMetadata(skillId);
  }

  /**
   * 获取 MCP Tool
   */
  getMcpTool(toolId: string): McpTool | undefined {
    return this.mcpManager.getAllTools().find(tool => tool.id === toolId);
  }

  /**
   * 检查能力是否存在
   */
  capabilityExists(name: string): boolean {
    const skill = this.skillLoader.getAllCachedMetadata().find(s => s.name === name);
    if (skill) return true;

    const tool = this.mcpManager.getAllTools().find(t => t.name === name);
    return tool !== undefined;
  }

  /**
   * 获取统计信息
   */
  getStats(): { skillCount: number; mcpToolCount: number; mcpCount: number } {
    return {
      skillCount: this.skillLoader.getAllCachedMetadata().length,
      mcpToolCount: this.mcpManager.getAllTools().length,
      mcpCount: this.mcpManager.getAllTools().length > 0 
        ? new Set(this.mcpManager.getAllTools().map(t => t.mcpId)).size 
        : 0,
    };
  }
}