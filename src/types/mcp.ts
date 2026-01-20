export interface McpConfig {
  id: string;
  name: string;
  endpoint: string;
  auth?: {
    type: 'app-token' | 'oauth2';
    appToken?: string;
    oauth2?: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  };
}

export interface McpTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  mcpId: string;
  type: 'mcp-tool';
}

export interface McpToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}