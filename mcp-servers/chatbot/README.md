# Maritime Support Chatbot

AI-powered customer support chatbot for the Maritime Reservation Platform. Uses Claude to understand questions and the MCP PostgreSQL server to look up booking data.

## Features

- Natural language understanding with Claude
- Booking lookup by reference or email
- Route and pricing information
- FAQ knowledge base
- Conversation history
- Multi-session support

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend  │────▶│   Chatbot    │────▶│  Claude    │
│  Component  │     │   Server     │     │   API      │
└─────────────┘     └──────────────┘     └────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   Database   │
                    └──────────────┘
```

## Installation

```bash
cd mcp-servers/chatbot
npm install
npm run build
```

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maritime_reservations_dev

# Server port (default: 3100)
PORT=3100
```

### Frontend Integration

Add to your root `.env`:

```bash
REACT_APP_CHATBOT_URL=http://localhost:3100
```

Add the chatbot component to your app:

```tsx
// src/App.tsx
import SupportChatbot from './components/SupportChatbot';

function App() {
  return (
    <div>
      {/* Your existing app */}
      <SupportChatbot />
    </div>
  );
}
```

## API Endpoints

### POST /api/chat

Send a message and get a response.

**Request:**
```json
{
  "message": "I want to check my booking",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you check your booking! Could you please provide your booking reference (e.g., MR1234ABCD) or the email address you used for the booking?",
  "session_id": "session_1234567890"
}
```

### POST /api/chat/clear

Clear conversation history for a session.

**Request:**
```json
{
  "session_id": "session_1234567890"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "maritime-chatbot"
}
```

## Available Tools

The chatbot has access to these tools:

| Tool | Description |
|------|-------------|
| `lookup_booking` | Find booking by reference or email |
| `search_routes` | Get route information |
| `get_user_bookings` | List all bookings for an email |
| `get_price_alerts` | Get active price alerts |
| `get_faq_answer` | Search FAQ knowledge base |

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV NODE_ENV=production
EXPOSE 3100

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
services:
  chatbot:
    build: ./mcp-servers/chatbot
    ports:
      - "3100:3100"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/maritime_db
      - PORT=3100
    depends_on:
      - postgres
```

## Usage Examples

### Check Booking Status
User: "Can you check booking MR1234ABCD?"

### Route Information
User: "What ferries go from Marseille to Tunis?"

### Cancel Booking
User: "How do I cancel my booking?"

### Payment Help
User: "I was charged twice for my booking"

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Extending the Chatbot

### Adding New Tools

1. Add tool definition to the `tools` array
2. Add execution logic in `executeTool` function
3. Test with various queries

### Updating FAQ

Update the `FAQ_KNOWLEDGE` constant with new Q&A sections.

### Connecting Ferryhopper MCP

When Ferryhopper MCP is available:

1. Add MCP client dependency
2. Add tools for real-time route/price queries
3. Update `search_routes` to use real API

## Security Considerations

- Only read-only database access
- No sensitive data in responses
- Session isolation
- Rate limiting recommended for production
- Sanitize user inputs

## Troubleshooting

### "Failed to get response" Error
- Check ANTHROPIC_API_KEY is set
- Verify API quota/billing

### Database Connection Issues
- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify network connectivity

### Slow Responses
- Claude API latency is normal (1-3s)
- Consider caching FAQ responses
- Add loading indicators in UI
