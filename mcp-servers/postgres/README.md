# Maritime PostgreSQL MCP Server

Model Context Protocol (MCP) server for the Maritime Reservation Platform database. This server allows AI assistants (like Claude) to query the database and answer questions about bookings, users, ferries, and platform statistics.

## Features

### Resources

- **Database Schema** - View all tables and their structures
- **Platform Statistics** - Overview of bookings, users, and revenue
- **Ferry Routes** - List of available ferry routes

### Tools

| Tool | Description |
|------|-------------|
| `query` | Execute read-only SQL SELECT queries |
| `lookup_booking` | Find booking by reference, email, or ID |
| `search_ferries` | Search bookings by route, date, or operator |
| `lookup_user` | Find user by email or ID |
| `get_statistics` | Get platform stats for today/week/month/year |
| `get_recent_bookings` | List recent bookings with optional status filter |
| `get_price_alerts` | View active price alerts |

## Installation

```bash
cd mcp-servers/postgres
npm install
npm run build
```

## Configuration

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/maritime_reservations_dev
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "maritime-postgres": {
      "command": "node",
      "args": ["/path/to/maritime-reservation-website/mcp-servers/postgres/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev"
      }
    }
  }
}
```

### Claude Code Configuration

Add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "maritime-postgres": {
      "command": "node",
      "args": ["./mcp-servers/postgres/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can ask the AI assistant questions like:

### Booking Queries
- "Look up booking MR1234ABCD"
- "Find all bookings for john@example.com"
- "Show me the last 10 bookings"
- "How many bookings were made today?"

### User Queries
- "Find user with email john@example.com"
- "How many users signed up this month?"

### Statistics
- "What are the platform statistics for this week?"
- "What's the total revenue for the year?"
- "What are the most popular routes?"

### Ferry Search
- "Find all bookings from Marseille to Tunis"
- "Show bookings for December 2024"
- "List all CTN operator bookings"

### Price Alerts
- "Show active price alerts for ayoubenmbarek@gmail.com"
- "What routes are being tracked?"

### Custom Queries
- "Run this query: SELECT departure_port, COUNT(*) FROM bookings GROUP BY departure_port"

## Security

- **Read-only access**: Only SELECT queries are allowed
- **Query validation**: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE are blocked
- **Row limits**: Query results are limited to 100 rows
- **No sensitive data**: Password hashes are never exposed

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### Connection Issues

1. Verify DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Check network connectivity

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### MCP Not Connecting

1. Rebuild the server: `npm run build`
2. Check Claude Desktop/Code logs
3. Verify the path in config is absolute

### Query Errors

- Only SELECT statements are allowed
- Check table/column names match schema
- Use `postgres://schema` resource to view available tables
