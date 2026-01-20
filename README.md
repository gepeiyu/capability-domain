# Capability-Domain

A Node.js-based capability gateway (Sidecar) that unifies local Claude Skills and remote MCP Tools into "atomic capabilities", providing dynamic capability metadata and execution interfaces via API and Unix Domain Socket (UDS) for upper-layer Agents.

## Features

- **Unified Capability Abstraction**: Unifies local Skills and remote MCP Tools into a single capability interface
- **Progressive Loading**: Inspired by OpenSkills, initially loads only metadata (small amount of Tokens), loads full content on demand
- **Dual-Mode Communication**: Supports both HTTP and Unix Domain Socket communication modes
- **Multi-Authentication Support**: Supports App-Token and OAuth2 authentication with automatic token refresh
- **Docker Deployment**: Includes Node.js 20+ and Python 3.11+ environments, supports local Python MCP scripts

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build production version
npm run build

# Run production version
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t capability-domain .

# Run in HTTP mode
docker run -d \
  -p 5271:5271 \
  -v $(pwd)/domains:/app/domains \
  -e SERVER_MODE=http \
  capability-domain

# Run in UDS mode
docker run -d \
  -v $(pwd)/domains:/app/domains \
  -v /tmp:/tmp \
  -e SERVER_MODE=uds \
  capability-domain
```

## Directory Structure

```
capability-domain/
├── src/
│   ├── modules/
│   │   ├── SkillLoader.ts          # Skill loader
│   │   ├── McpManager.ts           # MCP manager
│   │   ├── AuthManager.ts          # Authentication manager
│   │   └── CapabilityRegistry.ts   # Capability registry
│   ├── routes/
│   │   ├── metadata.ts             # Metadata endpoint
│   │   ├── capability.ts           # Capability details endpoint
│   │   └── execute.ts              # Execution endpoint
│   ├── types/                     # Type definitions
│   ├── utils/                     # Utility functions
│   └── app.ts                     # Main application entry
├── domains/
│   ├── skills/
│   │   └── [skill-folder]/
│   │       ├── SKILL.md        # Main skill file
│   │       ├── references/     # Reference documents (optional)
│   │       ├── scripts/        # Executable code (optional)
│   │       └── assets/         # Templates, resources (optional)
│   └── mcps/
│       └── [config].json       # MCP configuration file
└── Dockerfile
```

## API Endpoints

### GET /metadata

Retrieves metadata for all available capabilities (Markdown + YAML mixed format).

### POST /capability

Retrieves detailed information for specified capabilities.

**Request Body:**

```json
{
  "capabilities": ["code-reviewer", "amap-search"]
}
```

### POST /execute

Executes specified capabilities (supports batch execution).

**Request Body:**

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

Health check endpoint that returns service status and statistics.

### GET /files

Lists all generated files.

**Response Example:**

```json
{
  "success": true,
  "files": [
    {
      "name": "hello.pdf",
      "size": 12345,
      "created": "2026-01-22T00:15:30.000Z",
      "downloadUrl": "/download/hello.pdf"
    }
  ]
}
```

### GET /download/:filename

Downloads generated files.

**Example:**

```bash
curl -O http://localhost:5271/download/hello.pdf
```

**Supported File Types:**
- PDF (.pdf)
- JSON (.json)
- TXT (.txt)
- CSV (.csv)
- PNG (.png)
- JPG/JPEG (.jpg, .jpeg)

### GET /refresh

Refreshes all capability metadata.

## Usage Workflow

### 1. Get Capability List

Call `GET /metadata` to retrieve a Markdown-formatted list of all available capabilities:

```bash
curl http://localhost:5271/metadata
```

The returned content can be directly placed in LLM context to help the LLM understand available capabilities.

### 2. Get Capability Details

Call `POST /capability` to retrieve detailed information for specific capabilities as needed:

```bash
curl -X POST http://localhost:5271/capability \
  -H "Content-Type: application/json" \
  -d '{"capabilities": ["code-reviewer", "amap-search"]}'
```

### 3. Execute Capabilities

Call `POST /execute` to execute one or more capabilities:

```bash
curl -X POST http://localhost:5271/execute \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "code-reviewer", "input": {}},
    {"name": "amap-search", "input": {"keyword": "restaurant", "city": "Beijing"}}
  ]'
```

## MCP Configuration Guide

### App-Token Authentication

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

### OAuth2 Authentication

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

## Environment Variables

- `SERVER_MODE`: Server mode (`http` or `uds`, default `http`)
- `HTTP_HOST`: HTTP listen address (default `0.0.0.0`)
- `HTTP_PORT`: HTTP listen port (default `5271`)
- `UDS_SOCKET_PATH`: UDS socket path (default `/tmp/cdr.sock`)
- `DOMAINS_PATH`: Domains directory path (default `./domains`)
- `LOG_LEVEL`: Log level (`debug`, `info`, `warn`, `error`, default `info`)

## Progressive Loading

Inspired by OpenSkills design, Capability-Domain adopts a progressive loading strategy:

1. **Lightweight Discovery**: Initially loads only Skills' name and description
2. **On-Demand Loading**: Reads complete SKILL.md content only when `/execute` endpoint is called
3. **Efficient Indexing**: Fast capability location and retrieval
4. **Token Optimization**: Avoids wasting context

## License

MIT
