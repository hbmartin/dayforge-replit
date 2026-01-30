# Dayforge - AI Chat Application

## Overview

Dayforge is an AI-powered chat application built with Next.js 16, featuring multiple AI model support, guest authentication, and a modern chat interface.

## Project Structure

- `app/` - Next.js app router with authentication and chat routes
  - `(auth)/` - Authentication routes and handlers
  - `(chat)/` - Chat interface pages
- `components/` - React components
  - `ai-elements/` - AI-specific UI components
- `lib/` - Utility functions and configurations
  - `db/` - Drizzle ORM database schema and queries
  - `ai/` - AI model configurations
- `artifacts/` - AI artifact generation (code, images, sheets, text)
- `hooks/` - Custom React hooks

## Technology Stack

- **Framework**: Next.js 16 with App Router and Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js with guest and credentials providers
- **AI**: AI SDK with OpenAI and Anthropic integrations
- **UI Components**: Radix UI, Lucide Icons

## Environment Variables

Required environment variables:
- `POSTGRES_URL` - PostgreSQL database connection URL
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

Database schema is managed with Drizzle ORM. Tables include:
- User - User accounts
- Chat - Chat conversations
- Message_v2 - Chat messages with parts and attachments
- Document - Generated documents
- Vote_v2 - Message votes
- Stream - Active streams
- Suggestion - Document suggestions

To push schema changes:
```
pnpm db:push
```

## Recent Changes

- 2026-01-30: Initial Replit setup
  - Configured Next.js to run on port 5000
  - Set up PostgreSQL database
  - Configured allowedDevOrigins for Replit proxy
  - Set NODE_ENV to development

## User Preferences

None recorded yet.
