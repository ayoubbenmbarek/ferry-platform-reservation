# MCP Servers

Model Context Protocol (MCP) servers for the Maritime Reservation Platform. These servers enable AI assistants to interact with the platform's data and services.

## Available Servers

### 1. PostgreSQL MCP Server (`/postgres`)

Provides read-only access to the database for AI assistants like Claude Desktop or Claude Code.

**Features:**
- Database schema exploration
- Booking lookup
- User information
- Platform statistics
- Custom SQL queries (SELECT only)

**Usage:**
```bash
cd mcp-servers/postgres
npm install && npm run build
```

Configure in Claude Desktop or Claude Code settings.

### 2. Support Chatbot (`/chatbot`)

AI-powered customer support chatbot that uses Claude with MCP tools.

**Features:**
- Natural language conversation
- Booking lookups
- Route information
- FAQ knowledge base
- Multi-session support

**Usage:**
```bash
cd mcp-servers/chatbot
npm install && npm run build
npm start
```

Or via Docker:
```bash
docker-compose -f docker-compose.dev.yml up chatbot
```

## Environment Variables

### Required for All Servers

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev
```

### Chatbot-Specific

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=3100
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    AI Assistants                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │Claude Desktop│  │ Claude Code │  │ Frontend Chatbot    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         │    MCP Protocol│                     │ HTTP         │
│         ▼                ▼                     ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL  │  │  PostgreSQL  │  │ Chatbot Server    │   │
│  │  MCP Server  │  │  MCP Server  │  │ (Claude + MCP)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│                          ▼                                    │
│                   ┌──────────────┐                           │
│                   │  PostgreSQL  │                           │
│                   │   Database   │                           │
│                   └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

## Development

### Running PostgreSQL MCP Locally

```bash
cd mcp-servers/postgres
npm run dev

# In another terminal, test with Claude Desktop
# Add to claude_desktop_config.json
```

### Running Chatbot Locally

```bash
cd mcp-servers/chatbot
npm run dev

# Test endpoint
curl -X POST http://localhost:3100/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What ferry routes are available?"}'
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "maritime-postgres": {
      "command": "node",
      "args": ["/path/to/maritime-reservation-website/mcp-servers/postgres/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5442/maritime_reservations_dev"
      }
    }
  }
}
```

## Claude Code Configuration

Add to `.claude/settings.json` in the project:

```json
{
  "mcpServers": {
    "maritime-postgres": {
      "command": "node",
      "args": ["./mcp-servers/postgres/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5442/maritime_reservations_dev"
      }
    }
  }
}
```

## Future Enhancements

### Ferryhopper MCP Integration

When Ferryhopper MCP becomes available:

1. Add as a dependency
2. Create wrapper server
3. Connect to chatbot tools

```javascript
// Example Ferryhopper tool
{
  name: "search_ferryhopper",
  description: "Search real-time ferry schedules from Ferryhopper",
  // ...
}
```

### Additional MCP Servers

Potential future servers:

- **Analytics MCP** - Business intelligence queries
- **Admin MCP** - Administrative operations (with auth)
- **Notifications MCP** - Email/push notification management

## Security Notes

- All database access is READ-ONLY
- No write operations allowed through MCP
- No sensitive data (passwords) exposed
- Session isolation in chatbot
- Rate limiting recommended for production

## Troubleshooting

### MCP Server Not Connecting

1. Check if built: `npm run build`
2. Verify DATABASE_URL
3. Check Claude Desktop/Code logs
4. Ensure PostgreSQL is running

### Chatbot Returns Errors

1. Check ANTHROPIC_API_KEY
2. Verify database connection
3. Check server logs
4. Test health endpoint: `GET /health`
