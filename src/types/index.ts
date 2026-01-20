export interface Capability {
  name: string;
  description: string;
  implementation: 'skill' | 'tool' | 'code' | 'command';
}

export interface CapabilityDetail {
  name: string;
  description: string;
  implementation: 'skill' | 'tool' | 'code' | 'command';
}

export interface SkillDetail extends CapabilityDetail {
  implementation: 'skill';
  content: string;
  references?: string[];
  scripts?: string[];
  assets?: string[];
}

export interface ToolDetail extends CapabilityDetail {
  implementation: 'tool';
  inputSchema: Record<string, any>;
  mcpId: string;
}

export interface CodeDetail extends CapabilityDetail {
  implementation: 'code';
  language: 'python' | 'nodejs';
  description: string;
}

export interface CommandDetail extends CapabilityDetail {
  implementation: 'command';
  command: string;
  description: string;
}

export interface MetadataResponse {
  markdown: string;
}

export interface CapabilityDetailsRequest {
  capabilities: string[];
}

export interface CapabilityDetailsResponse {
  capabilities: (SkillDetail | ToolDetail | CodeDetail | CommandDetail)[];
}

export interface ExecuteRequest extends Array<{
  name: string;
  input?: Record<string, any>;
}> {}

export interface ExecuteResult {
  name: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface ExecuteResponse {
  results: ExecuteResult[];
}

export * from './skill';
export * from './mcp';