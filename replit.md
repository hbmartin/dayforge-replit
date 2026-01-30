# Structured Journal - Dayforge AI Application

## Overview

Structured Journal is a notebook-first journaling application built on top of the Dayforge AI chat foundation. It uses LLMs as protocol runners to guide users through evidence-based cognitive frameworks (CBT, Implementation Intentions, Gratitude). The system provides frictionless capture with optional guided sessions that produce tangible artifacts.

## Project Structure

- `app/` - Next.js app router with authentication, chat, and journal routes
  - `(auth)/` - Authentication routes and handlers
  - `(chat)/` - Original chat interface pages
  - `journal/` - Structured Journal application
    - `notebook/` - Notebook editor page
    - `timeline/` - Entry timeline page
- `components/` - React components
  - `ai-elements/` - AI-specific UI components
  - `journal/` - Journal components (sidebar, notebook-editor, timeline)
- `lib/` - Utility functions and configurations
  - `db/` - Drizzle ORM database schema and queries
    - `journal-schema.ts` - Journal-specific database schema
  - `ai/` - AI model configurations
  - `offline/` - IndexedDB offline storage layer
    - `db.ts` - Dexie database schema
    - `entries.ts` - Offline entry CRUD operations
    - `messages.ts` - Offline message CRUD operations
    - `sync.ts` - Sync queue management
  - `trpc/` - tRPC client and provider
- `server/` - Server-side code
  - `routers/` - tRPC routers (entries, messages, sync)
  - `trpc/` - tRPC context and initialization
- `artifacts/` - AI artifact generation (code, images, sheets, text)
- `hooks/` - Custom React hooks

## Technology Stack

- **Framework**: Next.js 16 with App Router and Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Drizzle ORM
- **Offline Storage**: Dexie (IndexedDB)
- **Authentication**: NextAuth.js with guest and credentials providers
- **AI**: AI SDK with OpenAI and Anthropic integrations
- **API**: tRPC for type-safe API calls
- **Editor**: TipTap for rich text editing
- **UI Components**: Radix UI, Lucide Icons

## Architecture

### Offline-First Design
- IndexedDB (Dexie) stores entries and messages locally
- Background sync queue pushes changes to PostgreSQL
- Local-generated IDs map to server UUIDs on sync
- Users can write without network connectivity

### Journal Schema
- **entries**: Journal entries with mode (notebook, plan, reflect, etc.)
- **messages**: Entry content with role (user, assistant, system)
- **artifacts**: Generated artifacts from sessions
- **entities**: Extracted entities (goals, tasks, insights)
- **syncQueue**: Pending sync operations

### Session Modes
1. **Notebook** - Free-form journaling
2. **Plan** - Implementation intentions
3. **Reflect** - Evening reflection
4. **Sleep** - Sleep hygiene prep
5. **Lift** - Gratitude and positive psychology
6. **Clarity** - CBT-style cognitive restructuring
7. **Unpack** - Process difficult situations
8. **Create** - Creative ideation

## Environment Variables

Required environment variables:
- `POSTGRES_URL` or `DATABASE_URL` - PostgreSQL database connection URL
- `AUTH_SECRET` - NextAuth.js secret key
- `AI_GATEWAY_API_KEY` - AI Gateway API key (optional for non-Vercel deployments)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token (optional)
- `REDIS_URL` - Redis connection URL (optional)

## Development

The application runs on port 5000 in development mode:
```
pnpm next dev --port 5000 --hostname 0.0.0.0
```

## Database

Database schema is managed with Drizzle ORM. 

### Original Chat Tables
- User - User accounts
- Chat - Chat conversations
- Message_v2 - Chat messages with parts and attachments
- Document - Generated documents
- Vote_v2 - Message votes
- Stream - Active streams
- Suggestion - Document suggestions

### Journal Tables
- entries - Journal entries with mode and status
- messages - Entry messages (user input, AI responses)
- artifacts - Generated artifacts from guided sessions
- entities - Extracted entities (goals, tasks, insights)
- sync_queue - Offline sync queue

To push schema changes:
```
pnpm db:push
```

## Recent Changes

- 2026-01-30: Phase 1 Implementation - Structured Journal Infrastructure
  - Created journal database schema (entries, messages, artifacts, entities, sync_queue)
  - Set up tRPC infrastructure with routers for entries, messages, and sync
  - Implemented IndexedDB offline storage layer using Dexie
  - Built journal UI shell with sidebar navigation
  - Created notebook editor with TipTap and "melting questions" feature
  - Created timeline view for entry history
  - Configured seven session modes (Plan, Reflect, Sleep, Lift, Clarity, Unpack, Create)

- 2026-01-30: Initial Replit setup
  - Configured Next.js to run on port 5000
  - Set up PostgreSQL database
  - Configured allowedDevOrigins for Replit proxy
  - Set NODE_ENV to development

## User Preferences

None recorded yet.
