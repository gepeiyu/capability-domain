# Capability-Domain
Capability-Domain：AI Agent 的能力中枢与统一网关

在构建功能强大的 AI Agent 时，集成多样化的工具（如本地脚本、云端服务或模型上下文协议工具）常面临协议不一、管理复杂与上下文臃肿的挑战。Capability-Domain 正是为此而生的解决方案。

它是一个轻量级的能力网关（Sidecar），运行在您的 Agent 之侧。其核心使命是将分散的、异构的能力——无论是本地的 Claude Skills，还是通过 Model Context Protocol (MCP) 接入的远程工具——统一抽象为标准的“原子能力”。通过简洁的 API 与 Unix Domain Socket，它为上层 Agent 提供了一个动态、可发现且高效的能力调用层，让 Agent 能够按需发现、理解并执行数百种功能，而无需关心底层的实现细节与集成复杂度。

## 特性

- **统一能力抽象**：将本地 Skills 和远程 MCP Tools 统一为能力接口
- **渐进式加载**：初始仅加载元数据（少量Tokens），按需加载完整内容
- **双模通信**：支持 HTTP 和 Unix Domain Socket 两种通信模式
- **多认证支持**：支持 App-Token 和 OAuth2 认证，自动刷新过期 Token
- **Docker 部署**：包含 Node.js 20+ 和 Python 3.11+ 环境，支持本地 Python MCP 脚本

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm start
```

### Docker 部署

```bash
# 构建镜像
docker build -t capability-domain .

# HTTP 模式运行
docker run -d \
  -p 5271:5271 \
  -v $(pwd)/domains:/app/domains \
  -e SERVER_MODE=http \
  capability-domain

# UDS 模式运行
docker run -d \
  -v $(pwd)/domains:/app/domains \
  -v /tmp:/tmp \
  -e SERVER_MODE=uds \
  capability-domain
```

## 目录结构

```
capability-domain/
├── src/
│   ├── modules/
│   │   ├── SkillLoader.ts          # Skill 加载器
│   │   ├── McpManager.ts           # MCP 管理器
│   │   ├── AuthManager.ts          # 认证管理器
│   │   └── CapabilityRegistry.ts   # 能力注册中心
│   ├── routes/
│   │   ├── metadata.ts             # 元数据接口
│   │   ├── capability.ts           # 能力详情接口
│   │   └── execute.ts              # 执行接口
│   ├── types/                     # 类型定义
│   ├── utils/                     # 工具函数
│   └── app.ts                     # 主应用入口
├── domains/
│   ├── skills/
│   │   └── [skill-folder]/
│   │       ├── SKILL.md        # 主技能文件
│   │       ├── references/     # 参考文档（可选）
│   │       ├── scripts/        # 可执行代码（可选）
│   │       └── assets/         # 模板、资源（可选）
│   └── mcps/
│       └── [config].json       # MCP 配置文件
└── Dockerfile
```

## API 接口

### GET /metadata
获取所有可用能力的元数据（Markdown + YAML 混合格式）。

### POST /capability
获取指定能力的详细信息。

**请求体：**
```json
{
  "capabilities": ["code-reviewer", "amap-search"]
}
```

### POST /execute
执行指定的能力（支持批量执行）。

**请求体：**
```json
[
  {
    "name": "execute-python", 
    "input": { 
        "code": ""
    } 
  },
  {
    "name": "amap-search",
    "input": { "keyword": "restaurant", "city": "QingDao" }
  }
]
```

### GET /health
健康检查接口，返回服务状态和统计信息。

### GET /files
列出所有生成的文件。

### GET /download/:filename
下载生成的文件。

**示例：**

```bash
curl -O http://localhost:5271/download/hello.pdf
```

**支持的文件类型：**
- PDF (.pdf)
- JSON (.json)
- TXT (.txt)
- CSV (.csv)
- PNG (.png)
- JPG/JPEG (.jpg, .jpeg)

### GET /refresh
刷新所有能力元数据。

## 使用流程

### 1. 获取能力列表
调用 `GET /metadata` 获取所有可用能力的 Markdown 格式列表：

返回的内容可以直接放入 LLM 上下文，帮助 LLM 理解可用的能力。

### 2. 获取能力详情
根据需要调用 `POST /capability` 获取特定能力的详细信息：

```bash
curl -X POST http://localhost:5271/capability \
  -H "Content-Type: application/json" \
  -d '{"capabilities": ["code-reviewer", "amap-search"]}'
```

### 3. 执行能力
调用 `POST /execute` 执行一个或多个能力：

```bash
curl -X POST http://localhost:5271/execute \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "code-reviewer", "input": {}},
    {"name": "amap-search", "input": {"keyword": "restaurant", "city": "Beijing"}}
  ]'
```

## MCP 配置指南

### App-Token 认证

```json
{
  "id": "mcp-id",
  "name": "MCP Name",
  "endpoint": "http://mcp-server:port/mcp",
  "auth": {
    "type": "app-token",
    "appToken": "your-app-token"
  }
}
```

### OAuth2 认证

```json
{
  "id": "mcp-id",
  "name": "MCP Name",
  "endpoint": "http://mcp-server:port/mcp",
  "auth": {
    "type": "oauth2",
    "oauth2": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://auth.example.com/oauth/token",
      "accessToken": "initial-access-token",
      "refreshToken": "initial-refresh-token",
      "expiresAt": 1234567890000
    }
  }
}
```

## 环境变量

- `SERVER_MODE`：服务器模式（`http` 或 `uds`，默认 `http`）
- `HTTP_HOST`：HTTP 监听地址（默认 `0.0.0.0`）
- `HTTP_PORT`：HTTP 监听端口（默认 `5271`）
- `UDS_SOCKET_PATH`：UDS socket 路径（默认 `/tmp/cdr.sock`）
- `DOMAINS_PATH`：domains 目录路径（默认 `./domains`）
- `LOG_LEVEL`：日志级别（`debug`、`info`、`warn`、`error`，默认 `info`）

## 渐进式加载

参考 OpenSkills 的设计，Capability-Domain 采用渐进式加载策略：

1. **轻量级发现**：初始仅加载 Skills 的 name 和 description
2. **按需加载**：当调用 `/execute` 接口时，才读取完整的 SKILL.md 内容
3. **高效索引**：快速定位和检索技能
4. **Token 优化**：避免浪费上下文

## 许可证

MIT
