import { McpConfig, OAuth2TokenResponse } from '../types/mcp';
import { createLogger, LogLevel } from '../utils/logger';

export class AuthManager {
  private logger = createLogger('AuthManager', LogLevel.INFO);
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  /**
   * 获取认证头
   */
  async getAuthHeaders(config: McpConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!config.auth) {
      this.logger.debug(`No auth configured for ${config.id}`);
      return headers;
    }

    if (config.auth.type === 'app-token') {
      if (!config.auth.appToken) {
        throw new Error('App token is required for app-token authentication');
      }
      headers['Authorization'] = `Bearer ${config.auth.appToken}`;
      this.logger.debug(`Using app-token for ${config.id}`);
    } else if (config.auth.type === 'oauth2') {
      const token = await this.getOAuth2Token(config);
      headers['Authorization'] = `Bearer ${token}`;
      this.logger.debug(`Using OAuth2 token for ${config.id}`);
    }

    return headers;
  }

  /**
   * 获取 OAuth2 Token
   */
  private async getOAuth2Token(config: McpConfig): Promise<string> {
    const oauth2 = config.auth?.oauth2;
    if (!oauth2) {
      throw new Error('OAuth2 configuration is required');
    }

    const cacheKey = `${config.id}:access_token`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Using cached OAuth2 token for ${config.id}`);
      return cached.token;
    }

    if (oauth2.refreshToken) {
      try {
        const token = await this.refreshOAuth2Token(config);
        return token;
      } catch (error) {
        this.logger.warn(`Failed to refresh OAuth2 token for ${config.id}, trying to get new token`, error);
      }
    }

    if (oauth2.accessToken && oauth2.expiresAt && oauth2.expiresAt > Date.now()) {
      this.logger.debug(`Using existing OAuth2 access token for ${config.id}`);
      return oauth2.accessToken;
    }

    throw new Error(`No valid OAuth2 token available for ${config.id}`);
  }

  /**
   * 刷新 OAuth2 Token
   */
  private async refreshOAuth2Token(config: McpConfig): Promise<string> {
    const oauth2 = config.auth?.oauth2;
    if (!oauth2 || !oauth2.refreshToken) {
      throw new Error('Refresh token is required');
    }

    this.logger.info(`Refreshing OAuth2 token for ${config.id}`);

    const response = await fetch(oauth2.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: oauth2.refreshToken,
        client_id: oauth2.clientId,
        client_secret: oauth2.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh OAuth2 token: ${response.status} ${errorText}`);
    }

    const tokenResponse: OAuth2TokenResponse = await response.json();
    const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

    const cacheKey = `${config.id}:access_token`;
    this.tokenCache.set(cacheKey, {
      token: tokenResponse.access_token,
      expiresAt,
    });

    this.logger.info(`Successfully refreshed OAuth2 token for ${config.id}, expires at ${new Date(expiresAt).toISOString()}`);

    return tokenResponse.access_token;
  }

  /**
   * 清除缓存的 Token
   */
  clearTokenCache(configId?: string): void {
    if (configId) {
      const cacheKey = `${configId}:access_token`;
      this.tokenCache.delete(cacheKey);
      this.logger.info(`Cleared token cache for ${configId}`);
    } else {
      this.tokenCache.clear();
      this.logger.info('Cleared all token cache');
    }
  }

  /**
   * 检查 Token 是否即将过期
   */
  isTokenExpiringSoon(configId: string, bufferSeconds: number = 300): boolean {
    const cacheKey = `${configId}:access_token`;
    const cached = this.tokenCache.get(cacheKey);

    if (!cached) {
      return true;
    }

    const bufferMs = bufferSeconds * 1000;
    return cached.expiresAt - Date.now() < bufferMs;
  }
}