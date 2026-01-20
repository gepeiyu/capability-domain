import * as fs from 'fs';
import { McpConfig, McpTool, McpToolCallResult } from '../types/mcp';
import { AuthManager } from './AuthManager';
import { FileScanner } from '../utils/fileScanner';
import { createLogger, LogLevel } from '../utils/logger';

export class McpManager {
  private authManager: AuthManager;
  private fileScanner: FileScanner;
  private logger = createLogger('McpManager', LogLevel.INFO);
  private mcpConfigs: Map<string, McpConfig> = new Map();
  private mcpTools: Map<string, McpTool> = new Map();

  constructor(domainsPath: string = './domains') {
    this.authManager = new AuthManager();
    this.fileScanner = new FileScanner(domainsPath);
  }

  /**
   * 加载所有 MCP 配置
   */
  async loadMcpConfigs(): Promise<void> {
    this.logger.info('Loading MCP configurations...');
    
    const configFiles = this.fileScanner.scanMcpConfigs();

    for (const configFile of configFiles) {
      try {
        const content = fs.readFileSync(configFile.fullPath, 'utf-8');
        const config: McpConfig = JSON.parse(content);

        if (!config.id || !config.endpoint) {
          this.logger.warn(`MCP config missing id or endpoint: ${configFile.fullPath}`);
          continue;
        }

        this.mcpConfigs.set(config.id, config);
        this.logger.info(`Loaded MCP config: ${config.id}`);
      } catch (error) {
        this.logger.error(`Error loading MCP config: ${configFile.fullPath}`, error);
      }
    }

    this.logger.info(`Loaded ${this.mcpConfigs.size} MCP configurations`);
  }

  /**
   * 发现所有 MCP 工具
   */
  async discoverTools(): Promise<McpTool[]> {
    this.logger.info('Discovering MCP tools...');
    const tools: McpTool[] = [];

    for (const [mcpId, config] of this.mcpConfigs) {
      try {
        const mcpTools = await this.listTools(config);
        tools.push(...mcpTools);
      } catch (error) {
        this.logger.error(`Error discovering tools for MCP ${mcpId}:`, error);
      }
    }

    this.logger.info(`Discovered ${tools.length} MCP tools`);
    return tools;
  }

  /**
   * 调用 MCP 的 list_tools 接口
   */
  private async listTools(config: McpConfig): Promise<McpTool[]> {
    const headers = await this.authManager.getAuthHeaders(config);

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    const tools: McpTool[] = (result.result?.tools || []).map((tool: any) => ({
      id: `${config.id}:${tool.name}`,
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
      mcpId: config.id,
      type: 'mcp-tool',
    }));

    for (const tool of tools) {
      this.mcpTools.set(tool.id, tool);
    }

    return tools;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolId: string, params: Record<string, any> = {}): Promise<McpToolCallResult> {
    this.logger.info(`Calling MCP tool: ${toolId}`);

    const tool = this.mcpTools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolId}`,
      };
    }

    const config = this.mcpConfigs.get(tool.mcpId);
    if (!config) {
      return {
        success: false,
        error: `MCP config not found: ${tool.mcpId}`,
      };
    }

    try {
      const headers = await this.authManager.getAuthHeaders(config);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: tool.name,
            arguments: params,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to call tool: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        return {
          success: false,
          error: result.error.message || 'Unknown MCP error',
        };
      }

      this.logger.info(`Successfully called MCP tool: ${toolId}`);
      return {
        success: true,
        result: result.result,
      };
    } catch (error) {
      this.logger.error(`Error calling MCP tool ${toolId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取所有 MCP 工具
   */
  getAllTools(): McpTool[] {
    return Array.from(this.mcpTools.values());
  }

  /**
   * 获取指定 MCP 的工具
   */
  getToolsByMcpId(mcpId: string): McpTool[] {
    return Array.from(this.mcpTools.values()).filter(tool => tool.mcpId === mcpId);
  }

  /**
   * 获取 MCP 配置
   */
  getMcpConfig(mcpId: string): McpConfig | undefined {
    return this.mcpConfigs.get(mcpId);
  }

  /**
   * 刷新所有 MCP 工具
   */
  async refreshTools(): Promise<McpTool[]> {
    this.logger.info('Refreshing MCP tools...');
    this.mcpTools.clear();
    return await this.discoverTools();
  }
}