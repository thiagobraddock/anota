# notepad666

Collaborative note-taking app with real-time editing powered by Y.js CRDTs.

## Features

- 📝 Rich text editor (TipTap) with markdown, code blocks, and task lists
- 🤝 Real-time collaborative editing with conflict resolution (Y.js)
- 👥 Live cursors showing online users
- 🔒 Privacy-first: Notes are private by default
- 🔐 Optional Google OAuth authentication
- 🐳 Fully containerized with Docker
- 🎨 Dark/Light theme support

## Tech Stack

- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Express.js + WebSocket (ws)
- **Database**: PostgreSQL 16
- **Editor**: TipTap with Y.js collaboration extensions
- **CRDT**: Y.js for conflict-free replicated data

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)

### Development Mode

1. Clone the repository
```bash
git clone <your-repo-url>
cd notepad666
```

2. Start PostgreSQL and run the app locally:
```bash
npm run dev:docker
```

This starts:
- PostgreSQL in Docker (port 5432)
- Server with hot-reload (port 3000)
- Vite dev server (port 5173)

3. Access the app at `http://localhost:5173`

### Production Mode (Full Docker)

```bash
docker-compose -f docker-compose.prod.yml up --build
```

Access at `http://localhost:3000`

## Environment Variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notepad
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-session-secret-change-this
```

> Google OAuth is optional. The app works without authentication using anonymous creator tokens.

## How It Works

### Real-Time Collaboration

- **Private notes**: Only the creator can edit (default)
- **Open notes**: Multiple users can edit simultaneously with Y.js CRDT sync
- WebSocket server handles Y.js sync protocol on `/collaboration` endpoint
- No conflicts: Y.js automatically merges concurrent edits

### Database Schema

```sql
notes (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE,
  content TEXT,
  access_mode TEXT DEFAULT 'private' CHECK (access_mode IN ('open', 'private')),
  creator_token TEXT,
  owner_id INTEGER REFERENCES users(id)
)
```

## Architecture

```
Client (React + Y.js)
    ↓ WebSocket
Server (Express + ws)
    ↓ sync protocol (y-protocols)
Y.Doc (in-memory CRDT)
    ↓ persistence
PostgreSQL
```

## Deployment

Deploy to [Railway](https://railway.app), [Render](https://render.com), or any platform supporting Docker:

1. Set environment variables
2. Add PostgreSQL service
3. Deploy using `Dockerfile`

## License

MIT

## Contributing

Pull requests are welcome!
