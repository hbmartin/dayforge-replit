# Technical Specification: Structured Journal

**Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Draft for Review

---

## 1. Executive Summary

This document specifies the technical architecture for **Structured Journal**, a protocol-driven journaling application that uses LLMs as active facilitators rather than passive chatbots. The system routes user input into evidence-based cognitive frameworks (CBT, Implementation Intentions, Gratitude) and produces tangible artifacts (plans, insights, to-dos).

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Web (PWA) | Offline support via service worker, single codebase |
| Framework | Next.js 14+ / TypeScript | Type safety, Vercel deployment, tRPC integration |
| LLM Strategy | Haiku (routing) + Sonnet (sessions) | Cost/latency optimization with quality where it matters |
| Data Architecture | Postgres (source of truth) → Zep/Mem0 (derived indexes) | Data portability, vendor flexibility, clean deletion |
| Offline | IndexedDB + service worker | Capture-first philosophy, sync when available |
| Streaming | Vercel AI SDK v6 | Native tool calling, streaming, React integration |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (PWA)                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Notebook   │  │  Sessions   │  │  Timeline   │  │  Memory/Settings    │ │
│  │   Editor    │  │    UI       │  │   View      │  │      Panel          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │            │
│  ┌──────┴────────────────┴────────────────┴─────────────────────┴──────────┐ │
│  │                    Offline Store (IndexedDB)                             │ │
│  │         Entries | Sync Queue | Cached Preferences | Pending Artifacts    │ │
│  └──────────────────────────────────┬──────────────────────────────────────┘ │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ tRPC / SSE
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js API Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   tRPC Router   │  │  Auth (NextAuth)│  │    Streaming Endpoints      │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│  ┌────────┴────────────────────┴──────────────────────────┴──────────────┐  │
│  │                      LLM Orchestration Layer                          │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │  Router  │  │  Specialist  │  │    Tool      │  │   Protocol    │  │  │
│  │  │ (Haiku)  │  │   (Sonnet)   │  │   Executor   │  │   Registry    │  │  │
│  │  └──────────┘  └──────────────┘  └──────────────┘  └───────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────┐           ┌─────────────────┐           ┌─────────────────┐
│   PostgreSQL  │           │   Zep (Cloud)   │           │  Mem0 (Cloud)   │
│               │           │                 │           │                 │
│ • Entries     │  ──sync── │ • Episodic mem  │           │ • Long-term     │
│ • Messages    │           │ • Entity graphs │           │   patterns      │
│ • Artifacts   │           │ • Temporal      │           │ • Preferences   │
│ • Users       │           │   retrieval     │           │ • Cognitive     │
│ • Protocols   │           │                 │           │   tendencies    │
└───────────────┘           └─────────────────┘           └─────────────────┘
```

### 2.2 Request Flow Examples

**Notebook Free-Write Flow:**
```
1. User types paragraph → saved to IndexedDB immediately
2. User stops typing (idle 3s) → client requests question from server
3. Server: Router (Haiku) generates contextual question based on:
   - Time of day
   - User preferences (from Mem0)
   - Recent context (from Zep)
4. Question returned → client delays 5s → "melts" onto page
5. Background: Entry synced to Postgres → Zep indexing (async)
```

**Guided Session Flow:**
```
1. User selects "Plan" mode → client sends mode + initial context
2. Server: Load protocol definition → inject user preferences
3. Server: Specialist (Sonnet) begins protocol with first question
4. Stream response to client
5. User responds → check 5s typing window → if no new typing, request next response
6. Specialist uses tools as needed (search_memories, create_artifact)
7. Session ends (user exits or 30min timeout) → finalize artifacts
8. Artifacts saved to Postgres, indexed to Zep/Mem0
```

---

## 3. Data Model

### 3.1 Core Entities

```typescript
// ============================================================
// USER & AUTHENTICATION
// ============================================================

interface User {
  id: string;                    // UUID
  email: string;
  createdAt: DateTime;
  updatedAt: DateTime;
  
  // Preferences stored in Mem0, but cached here for offline
  preferencesCacheJson: JSON;
  preferencesLastSync: DateTime;
}

// ============================================================
// ENTRIES & MESSAGES
// ============================================================

enum EntryMode {
  NOTEBOOK = 'notebook',         // Free-form capture
  PLAN = 'plan',                 // Implementation intentions
  REFLECT = 'reflect',           // Work reflection
  SLEEP = 'sleep',               // Cognitive offload
  LIFT = 'lift',                 // Gratitude + values
  CLARITY = 'clarity',           // Thought record (CBT)
  UNPACK = 'unpack',             // Expressive writing
  CREATE = 'create',             // Best possible self
}

enum EntryStatus {
  ACTIVE = 'active',             // In progress
  COMPLETED = 'completed',       // Finalized
  ABANDONED = 'abandoned',       // Timed out without completion
}

interface Entry {
  id: string;                    // UUID
  userId: string;                // FK → User
  mode: EntryMode;
  status: EntryStatus;
  
  createdAt: DateTime;
  updatedAt: DateTime;
  completedAt: DateTime | null;
  
  // Structured metadata (extracted by LLM)
  metadata: EntryMetadata;
  
  // Sync status for offline support
  syncStatus: SyncStatus;
  localId: string | null;        // Client-generated ID for offline entries
}

interface EntryMetadata {
  mood: MoodInference | null;
  sentiment: number | null;      // -1 to 1
  topics: string[];
  meaningMakingScore: number;    // 0-1, based on because/realize/understand
}

interface MoodInference {
  primary: string;               // e.g., "anxious", "hopeful", "frustrated"
  intensity: number;             // 0-100
  secondary: string[];
}

enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

enum MessageType {
  TEXT = 'text',                 // Regular message
  QUESTION = 'question',         // Router-generated prompt
  ARTIFACT = 'artifact',         // Artifact creation notification
  TOOL_CALL = 'tool_call',       // Tool invocation (for debugging)
  TOOL_RESULT = 'tool_result',   // Tool result (for debugging)
}

interface Message {
  id: string;                    // UUID
  entryId: string;               // FK → Entry
  
  role: MessageRole;
  type: MessageType;
  content: string;               // Markdown content
  
  createdAt: DateTime;
  
  // For tool calls, store the structured data
  toolData: JSON | null;
  
  // Sync status
  syncStatus: SyncStatus;
  localId: string | null;
}

// ============================================================
// ARTIFACTS
// ============================================================

enum ArtifactType {
  IF_THEN_PLAN = 'if_then_plan',
  TODO = 'todo',
  TODO_LIST = 'todo_list',
  BALANCED_THOUGHT = 'balanced_thought',
  INSIGHT = 'insight',
  OPEN_LOOP = 'open_loop',
  GRATITUDE_LIST = 'gratitude_list',
  VISION_NARRATIVE = 'vision_narrative',
  WEEKLY_REVIEW = 'weekly_review',
}

interface Artifact {
  id: string;                    // UUID
  userId: string;                // FK → User
  entryId: string | null;        // FK → Entry (null for scheduled artifacts)
  type: ArtifactType;
  
  createdAt: DateTime;
  updatedAt: DateTime;
  
  // Type-specific data (see below)
  data: ArtifactData;
  
  // For trackable artifacts
  status: ArtifactStatus | null;
  resolvedAt: DateTime | null;
  resolutionNotes: string | null;
}

enum ArtifactStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  EXPIRED = 'expired',
}

// ============================================================
// ARTIFACT DATA TYPES (Discriminated Union)
// ============================================================

type ArtifactData = 
  | IfThenPlanData
  | TodoData
  | TodoListData
  | BalancedThoughtData
  | InsightData
  | OpenLoopData
  | GratitudeListData
  | VisionNarrativeData
  | WeeklyReviewData;

interface IfThenPlanData {
  type: 'if_then_plan';
  goal: string;
  obstacle: string;
  trigger: string;
  action: string;
  backup: string | null;
  calendarText: string | null;   // Formatted for calendar
}

interface TodoData {
  type: 'todo';
  item: string;
  dueDate: DateTime | null;
  priority: 'high' | 'medium' | 'low' | null;
  context: string | null;        // Where this came from
}

interface TodoListData {
  type: 'todo_list';
  title: string;
  items: TodoData[];
}

interface BalancedThoughtData {
  type: 'balanced_thought';
  situation: string;
  automaticThought: string;
  emotion: string;
  emotionIntensityBefore: number;  // 0-100
  evidenceFor: string[];
  evidenceAgainst: string[];
  balancedThought: string;
  emotionIntensityAfter: number;   // 0-100
  nextStep: string | null;
}

interface InsightData {
  type: 'insight';
  content: string;
  tags: string[];
  sourceContext: string | null;
}

interface OpenLoopData {
  type: 'open_loop';
  description: string;
  category: 'worry' | 'goal' | 'anticipation';
  expectedResolutionDate: DateTime | null;
  actualOutcome: string | null;
}

interface GratitudeListData {
  type: 'gratitude_list';
  items: GratitudeItem[];
  promptVariant: string;         // Track which prompt style was used
}

interface GratitudeItem {
  item: string;
  why: string;                   // Causal attribution
}

interface VisionNarrativeData {
  type: 'vision_narrative';
  timeframe: string;             // e.g., "1 year", "5 years"
  narrative: string;
  nextStep: string;
}

interface WeeklyReviewData {
  type: 'weekly_review';
  weekStartDate: DateTime;
  weekEndDate: DateTime;
  
  themes: string[];
  wins: string[];
  obstacles: string[];
  
  moodTrend: {
    average: number;
    trend: 'improving' | 'stable' | 'declining';
    notes: string;
  };
  
  topicFrequency: Array<{
    topic: string;
    count: number;
  }>;
  
  openLoopsResolved: Array<{
    loopId: string;
    description: string;
    outcome: string;
  }>;
  
  openLoopsPending: Array<{
    loopId: string;
    description: string;
  }>;
  
  patternInsights: string[];
  suggestedExperiments: string[];
}

// ============================================================
// SYNC & OFFLINE SUPPORT
// ============================================================

enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed',
}

interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'entry' | 'message' | 'artifact';
  entityId: string;
  localId: string;
  payload: JSON;
  attempts: number;
  lastAttempt: DateTime | null;
  error: string | null;
  createdAt: DateTime;
}

// ============================================================
// PROTOCOL DEFINITIONS
// ============================================================

interface Protocol {
  id: string;
  mode: EntryMode;
  version: number;
  
  // Loaded from file system, cached in DB for consistency
  systemPrompt: string;
  questionSequence: ProtocolQuestion[];
  allowedTools: string[];
  stopConditions: string[];
  guardrails: string[];
  outputArtifacts: ArtifactType[];
  
  // Time estimates (for UI)
  estimatedMinutes: {
    min: number;
    max: number;
  };
  
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface ProtocolQuestion {
  id: string;
  order: number;
  prompt: string;
  variants: string[];            // Alternative phrasings
  isRequired: boolean;
  followUpConditions: string[];  // When to ask follow-ups
}

// ============================================================
// ENTITIES (for Zep sync tracking)
// ============================================================

enum EntityType {
  PERSON = 'person',
  PROJECT = 'project',
  TOPIC = 'topic',
  PLACE = 'place',
  CUSTOM = 'custom',
}

interface Entity {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  
  // User controls
  shouldRemember: boolean;       // User can opt out
  
  // Zep sync
  zepEntityId: string | null;
  lastSyncedAt: DateTime | null;
  
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface EntityRelationship {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;      // LLM-defined
  confidence: number;            // 0-1
  
  createdAt: DateTime;
}

// ============================================================
// SCHEDULED JOBS
// ============================================================

interface ScheduledJob {
  id: string;
  userId: string;
  
  type: 'session_finalization' | 'open_loop_followup' | 'weekly_review';
  
  scheduledFor: DateTime;
  status: 'pending' | 'completed' | 'cancelled';
  
  payload: JSON;                 // Type-specific data
  
  // For cancellation by user action
  cancelledBy: string | null;    // Entry ID that cancelled this
  
  createdAt: DateTime;
  completedAt: DateTime | null;
}

// ============================================================
// EVENT LOG (Analytics)
// ============================================================

interface EventLog {
  id: string;
  userId: string;
  
  eventType: string;             // e.g., 'session.started', 'artifact.created'
  eventData: JSON;
  
  // For debugging
  entryId: string | null;
  sessionId: string | null;
  
  createdAt: DateTime;
}
```

### 3.2 Database Schema (PostgreSQL) (Define in Drizzle)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  
  preferences_cache JSONB DEFAULT '{}',
  preferences_last_sync TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON users
  USING (id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- ENTRIES
-- ============================================================

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  mode TEXT NOT NULL CHECK (mode IN (
    'notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'abandoned'
  )),
  
  metadata JSONB DEFAULT '{}',
  
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN (
    'synced', 'pending', 'failed'
  )),
  local_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX entries_user_id_idx ON entries(user_id);
CREATE INDEX entries_user_created_idx ON entries(user_id, created_at DESC);
CREATE INDEX entries_mode_idx ON entries(user_id, mode);
CREATE INDEX entries_local_id_idx ON entries(local_id) WHERE local_id IS NOT NULL;

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY entries_isolation ON entries
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN (
    'text', 'question', 'artifact', 'tool_call', 'tool_result'
  )),
  content TEXT NOT NULL,
  
  tool_data JSONB,
  
  sync_status TEXT NOT NULL DEFAULT 'synced',
  local_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_entry_id_idx ON messages(entry_id);
CREATE INDEX messages_entry_created_idx ON messages(entry_id, created_at);

-- RLS via entry relationship
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_isolation ON messages
  USING (entry_id IN (
    SELECT id FROM entries WHERE user_id = current_setting('app.current_user_id')::UUID
  ));

-- ============================================================
-- ARTIFACTS
-- ============================================================

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  
  type TEXT NOT NULL CHECK (type IN (
    'if_then_plan', 'todo', 'todo_list', 'balanced_thought', 
    'insight', 'open_loop', 'gratitude_list', 'vision_narrative', 'weekly_review'
  )),
  
  data JSONB NOT NULL,
  
  status TEXT CHECK (status IN ('pending', 'completed', 'skipped', 'expired')),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX artifacts_user_id_idx ON artifacts(user_id);
CREATE INDEX artifacts_type_idx ON artifacts(user_id, type);
CREATE INDEX artifacts_status_idx ON artifacts(user_id, status) WHERE status IS NOT NULL;
CREATE INDEX artifacts_entry_id_idx ON artifacts(entry_id) WHERE entry_id IS NOT NULL;

-- GIN index for JSONB queries
CREATE INDEX artifacts_data_idx ON artifacts USING GIN (data);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifacts_isolation ON artifacts
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- ENTITIES
-- ============================================================

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('person', 'project', 'topic', 'place', 'custom')),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  
  should_remember BOOLEAN NOT NULL DEFAULT true,
  
  zep_entity_id TEXT,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, type, name)
);

CREATE INDEX entities_user_id_idx ON entities(user_id);
CREATE INDEX entities_name_idx ON entities(user_id, name);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY entities_isolation ON entities
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- ENTITY RELATIONSHIPS
-- ============================================================

CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  
  relationship_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_relationships_isolation ON entity_relationships
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- SCHEDULED JOBS
-- ============================================================

CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN (
    'session_finalization', 'open_loop_followup', 'weekly_review'
  )),
  
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'cancelled'
  )),
  
  payload JSONB NOT NULL DEFAULT '{}',
  
  cancelled_by UUID REFERENCES entries(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX scheduled_jobs_pending_idx ON scheduled_jobs(scheduled_for)
  WHERE status = 'pending';

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_jobs_isolation ON scheduled_jobs
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================
-- SYNC QUEUE (for offline support)
-- ============================================================

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('entry', 'message', 'artifact')),
  entity_id UUID NOT NULL,
  local_id TEXT NOT NULL,
  
  payload JSONB NOT NULL,
  
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sync_queue_user_pending_idx ON sync_queue(user_id, created_at)
  WHERE attempts < 5;

-- ============================================================
-- EVENT LOG
-- ============================================================

CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  
  entry_id UUID,
  session_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX event_log_user_type_idx ON event_log(user_id, event_type, created_at DESC);

-- Partition by month for large scale
-- (Implementation detail for production)

-- ============================================================
-- PROTOCOLS (cached from file system)
-- ============================================================

CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mode TEXT UNIQUE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  
  system_prompt TEXT NOT NULL,
  question_sequence JSONB NOT NULL DEFAULT '[]',
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  stop_conditions TEXT[] NOT NULL DEFAULT '{}',
  guardrails TEXT[] NOT NULL DEFAULT '{}',
  output_artifacts TEXT[] NOT NULL DEFAULT '{}',
  
  estimated_minutes JSONB NOT NULL DEFAULT '{"min": 5, "max": 15}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FULL TEXT SEARCH
-- ============================================================

-- Add tsvector column for full-text search on messages
ALTER TABLE messages ADD COLUMN content_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX messages_content_tsv_idx ON messages USING GIN (content_tsv);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Set current user for RLS
CREATE OR REPLACE FUNCTION set_current_user_id(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER artifacts_updated_at
  BEFORE UPDATE ON artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER protocols_updated_at
  BEFORE UPDATE ON protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. API Design (tRPC)

### 4.1 Router Structure

```typescript
// src/server/routers/_app.ts

import { router } from '../trpc';
import { entriesRouter } from './entries';
import { messagesRouter } from './messages';
import { artifactsRouter } from './artifacts';
import { sessionsRouter } from './sessions';
import { memoryRouter } from './memory';
import { syncRouter } from './sync';
import { protocolsRouter } from './protocols';
import { searchRouter } from './search';
import { reviewRouter } from './review';

export const appRouter = router({
  entries: entriesRouter,
  messages: messagesRouter,
  artifacts: artifactsRouter,
  sessions: sessionsRouter,      // Guided session orchestration
  memory: memoryRouter,          // Zep/Mem0 interactions
  sync: syncRouter,              // Offline sync
  protocols: protocolsRouter,    // Protocol definitions
  search: searchRouter,          // Full-text + semantic search
  review: reviewRouter,          // Weekly reviews
});

export type AppRouter = typeof appRouter;
```

### 4.2 Key Procedures

```typescript
// src/server/routers/entries.ts

export const entriesRouter = router({
  // Create a new entry (notebook or session start)
  create: protectedProcedure
    .input(z.object({
      mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']),
      localId: z.string().optional(),  // For offline entries
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),

  // Get entry with messages
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Implementation
    }),

  // List entries (timeline)
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().uuid().optional(),
      mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Implementation with cursor-based pagination
    }),

  // Finalize entry (mark complete, trigger artifact generation)
  finalize: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['completed', 'abandoned']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});

// src/server/routers/sessions.ts

export const sessionsRouter = router({
  // Get notebook question (Router LLM call)
  getNotebookQuestion: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      recentContent: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Call Router (Haiku) with:
      // - Time of day
      // - User preferences (from Mem0)
      // - Recent context (from Zep)
      // - Recent content from current entry
    }),

  // Start guided session (returns initial message stream)
  startSession: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      mode: z.enum(['plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']),
      initialContext: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Load protocol, inject preferences, start Specialist
      // Schedule session finalization job (30min timeout)
    }),

  // Continue session (streaming response)
  // This is handled via a separate streaming endpoint
});

// src/server/routers/memory.ts

export const memoryRouter = router({
  // Get entities for memory screen
  getEntities: protectedProcedure
    .input(z.object({
      type: z.enum(['person', 'project', 'topic', 'place', 'custom']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Fetch from local entities table
    }),

  // Toggle entity memory
  setEntityRemember: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
      shouldRemember: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update local + sync to Zep
    }),

  // Forget entity entirely
  forgetEntity: protectedProcedure
    .input(z.object({
      entityId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete from local + Zep + Mem0
    }),

  // Get patterns (from Mem0)
  getPatterns: protectedProcedure
    .query(async ({ ctx }) => {
      // Fetch compressed patterns from Mem0
    }),
});

// src/server/routers/sync.ts

export const syncRouter = router({
  // Push offline changes
  push: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        operation: z.enum(['create', 'update', 'delete']),
        entityType: z.enum(['entry', 'message', 'artifact']),
        localId: z.string(),
        payload: z.any(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Process each item, return mapping of localId → serverId
    }),

  // Pull changes since last sync
  pull: protectedProcedure
    .input(z.object({
      since: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // Return all changes since timestamp
    }),

  // Get current sync status
  status: protectedProcedure
    .query(async ({ ctx }) => {
      // Return pending sync items, last sync time, etc.
    }),
});

// src/server/routers/search.ts

export const searchRouter = router({
  // Combined search (full-text + semantic)
  search: protectedProcedure
    .input(z.object({
      query: z.string(),
      filters: z.object({
        mode: z.enum(['notebook', 'plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create']).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        entities: z.array(z.string()).optional(),
        mood: z.string().optional(),
      }).optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // 1. Full-text search in Postgres for exact matches
      // 2. Semantic search in Zep for conceptual matches
      // 3. Merge and rank results
    }),
});
```

### 4.3 Streaming Endpoint

```typescript
// src/app/api/session/stream/route.ts

import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { entryId, messages, mode } = await req.json();
  
  // Validate session ownership
  const session = await validateSession(entryId);
  
  // Load protocol
  const protocol = await loadProtocol(mode);
  
  // Build system prompt with injected context
  const systemPrompt = await buildSystemPrompt(protocol, session.userId);
  
  // Define tools
  const tools = buildTools(protocol.allowedTools, session.userId);
  
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 10,  // Allow multi-step tool use
    onFinish: async ({ text, toolCalls, toolResults }) => {
      // Save assistant message
      await saveMessage(entryId, 'assistant', text, toolCalls);
      
      // Log event
      await logEvent(session.userId, 'session.response', {
        entryId,
        mode,
        toolsUsed: toolCalls?.map(t => t.toolName),
      });
    },
  });
  
  return result.toDataStreamResponse();
}
```

---

## 5. LLM Orchestration Layer

### 5.1 Router (Intent Classification)

```typescript
// src/server/llm/router.ts

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const ROUTER_SYSTEM_PROMPT = `You are a journal routing assistant. Your job is to generate a helpful, contextual question or prompt for a user's journal entry.

Consider:
- Time of day: {timeOfDay}
- User preferences: {preferences}
- Recent topics/themes: {recentContext}
- Current entry content (if any): {currentContent}

Generate ONE short, open-ended question that:
1. Feels natural and non-intrusive
2. Matches the time of day (morning = intentions, evening = reflection)
3. Builds on recent themes when relevant
4. Avoids repetition of recent prompts

Output only the question, nothing else.`;

export async function generateNotebookQuestion(
  userId: string,
  entryId: string,
  currentContent?: string
): Promise<string> {
  // Gather context
  const timeOfDay = getTimeOfDay(); // 'morning' | 'midday' | 'evening' | 'night'
  const preferences = await getCompressedPreferences(userId); // From Mem0
  const recentContext = await getRecentContext(userId, 5); // From Zep
  
  const prompt = ROUTER_SYSTEM_PROMPT
    .replace('{timeOfDay}', timeOfDay)
    .replace('{preferences}', JSON.stringify(preferences))
    .replace('{recentContext}', recentContext)
    .replace('{currentContent}', currentContent || 'Empty');
  
  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-20241022'),
    system: prompt,
    messages: [{ role: 'user', content: 'Generate a journaling prompt.' }],
    maxTokens: 100,
  });
  
  return text.trim();
}

// Mode classification for routing freeform to guided
const MODE_CLASSIFIER_PROMPT = `Classify the user's journal entry into the most appropriate mode:

PASSIVE - User wants to vent, record, or write freely. No guidance needed.
PLAN - User wants to commit to action, stressed about tasks, or needs to organize.
REFLECT - User is reviewing their day or a recent experience.
LIFT - User seems low energy or could benefit from gratitude/values reset.
CLARITY - User expresses anxiety, cognitive distortion, or circular thinking.
UNPACK - User wants to deeply process something difficult or emotional.
CREATE - User wants to envision their future or set direction.

Entry: {content}

Output exactly one mode name, nothing else.`;

export async function classifyMode(content: string): Promise<EntryMode> {
  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-20241022'),
    system: MODE_CLASSIFIER_PROMPT.replace('{content}', content),
    messages: [{ role: 'user', content: 'Classify this entry.' }],
    maxTokens: 20,
  });
  
  const mode = text.trim().toLowerCase() as EntryMode;
  return isValidMode(mode) ? mode : 'notebook';
}
```

### 5.2 Specialist (Protocol Runner)

```typescript
// src/server/llm/specialist.ts

const BASE_SYSTEM_POLICY = `You are a guided journal assistant. Your core principles:

1. PROTOCOL-DRIVEN: Follow the session protocol strictly. Ask one question at a time. Wait for response before proceeding.

2. MEANING-MAKING: Push for "because/realize/understand" language—this is tied to better outcomes.

3. DOSING: Don't over-prescribe. Be concise. Respect the user's time.

4. SAFETY: Monitor for signs of rumination (circular thinking without new insight) or persistent distress. If detected, gently redirect.

5. OUTPUTS: Every guided session ends with a concrete artifact. Use the provided tools to create artifacts.

6. MEMORY: Use memory tools to access relevant context at session start and when relevant topics arise.

User preferences:
{preferences}

Session protocol:
{protocol}`;

export async function buildSystemPrompt(
  protocol: Protocol,
  userId: string
): Promise<string> {
  // Get compressed preferences from Mem0
  const preferences = await mem0.getPreferences(userId);
  
  // Build protocol section
  const protocolSection = `
Mode: ${protocol.mode}
Goal: ${protocol.questionSequence[0]?.prompt || 'Guide the user through structured journaling'}

Question sequence:
${protocol.questionSequence.map((q, i) => `${i + 1}. ${q.prompt}`).join('\n')}

Allowed follow-ups: ${protocol.stopConditions.join(', ')}

Output artifacts to create: ${protocol.outputArtifacts.join(', ')}

Guardrails:
${protocol.guardrails.map(g => `- ${g}`).join('\n')}
`;
  
  return BASE_SYSTEM_POLICY
    .replace('{preferences}', JSON.stringify(preferences, null, 2))
    .replace('{protocol}', protocolSection);
}
```

### 5.3 Tool Definitions

```typescript
// src/server/llm/tools.ts

import { tool } from 'ai';
import { z } from 'zod';

export function buildTools(allowedTools: string[], userId: string) {
  const allTools = {
    // ============================================================
    // MEMORY READ TOOLS
    // ============================================================
    
    search_memories: tool({
      description: 'Search for relevant memories, past entries, and context. Use at session start and when relevant topics are mentioned.',
      parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        const results = await zep.search(userId, query, limit);
        return results;
      },
    }),
    
    get_recent_entries: tool({
      description: 'Get the user\'s recent journal entries.',
      parameters: z.object({
        count: z.number().min(1).max(10).default(3),
        mode: z.string().optional().describe('Filter by mode'),
      }),
      execute: async ({ count, mode }) => {
        const entries = await getRecentEntries(userId, count, mode);
        return entries.map(e => ({
          date: e.createdAt,
          mode: e.mode,
          summary: e.metadata?.summary || truncate(e.messages[0]?.content, 200),
        }));
      },
    }),
    
    get_entity_context: tool({
      description: 'Get everything known about a specific person, project, or topic.',
      parameters: z.object({
        entityName: z.string(),
      }),
      execute: async ({ entityName }) => {
        return await zep.getEntityContext(userId, entityName);
      },
    }),
    
    get_open_loops: tool({
      description: 'Get unresolved worries, goals, or anticipated events that need follow-up.',
      parameters: z.object({
        status: z.enum(['pending', 'all']).default('pending'),
      }),
      execute: async ({ status }) => {
        return await getOpenLoops(userId, status);
      },
    }),
    
    get_user_preferences: tool({
      description: 'Get the user\'s journaling preferences and patterns.',
      parameters: z.object({}),
      execute: async () => {
        return await mem0.getPreferences(userId);
      },
    }),
    
    // ============================================================
    // ARTIFACT CREATION TOOLS
    // ============================================================
    
    create_if_then_plan: tool({
      description: 'Create an if-then implementation intention plan.',
      parameters: z.object({
        goal: z.string().describe('What the user wants to achieve'),
        obstacle: z.string().describe('What usually gets in the way'),
        trigger: z.string().describe('The specific moment/cue'),
        action: z.string().describe('The specific action to take'),
        backup: z.string().optional().describe('Backup plan if first action fails'),
      }),
      execute: async ({ goal, obstacle, trigger, action, backup }) => {
        const artifact = await createArtifact(userId, 'if_then_plan', {
          type: 'if_then_plan',
          goal,
          obstacle,
          trigger,
          action,
          backup: backup || null,
          calendarText: `If ${trigger}, then ${action}`,
        });
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    create_todo_list: tool({
      description: 'Create a structured to-do list from a brain dump.',
      parameters: z.object({
        title: z.string(),
        items: z.array(z.object({
          item: z.string(),
          priority: z.enum(['high', 'medium', 'low']).optional(),
          dueDate: z.string().optional(),
        })),
      }),
      execute: async ({ title, items }) => {
        const artifact = await createArtifact(userId, 'todo_list', {
          type: 'todo_list',
          title,
          items: items.map(i => ({
            type: 'todo',
            item: i.item,
            priority: i.priority || null,
            dueDate: i.dueDate ? new Date(i.dueDate) : null,
            context: null,
          })),
        });
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    create_balanced_thought: tool({
      description: 'Create a balanced thought record (CBT thought record).',
      parameters: z.object({
        situation: z.string(),
        automaticThought: z.string(),
        emotion: z.string(),
        emotionIntensityBefore: z.number().min(0).max(100),
        evidenceFor: z.array(z.string()),
        evidenceAgainst: z.array(z.string()),
        balancedThought: z.string(),
        emotionIntensityAfter: z.number().min(0).max(100),
        nextStep: z.string().optional(),
      }),
      execute: async (data) => {
        const artifact = await createArtifact(userId, 'balanced_thought', {
          type: 'balanced_thought',
          ...data,
          nextStep: data.nextStep || null,
        });
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    create_insight: tool({
      description: 'Record a key insight or realization.',
      parameters: z.object({
        content: z.string(),
        tags: z.array(z.string()).optional(),
      }),
      execute: async ({ content, tags }) => {
        const artifact = await createArtifact(userId, 'insight', {
          type: 'insight',
          content,
          tags: tags || [],
          sourceContext: null,
        });
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    create_open_loop: tool({
      description: 'Flag something for follow-up later (a worry, goal, or anticipated event).',
      parameters: z.object({
        description: z.string(),
        category: z.enum(['worry', 'goal', 'anticipation']),
        expectedResolutionDate: z.string().optional(),
      }),
      execute: async ({ description, category, expectedResolutionDate }) => {
        const artifact = await createArtifact(userId, 'open_loop', {
          type: 'open_loop',
          description,
          category,
          expectedResolutionDate: expectedResolutionDate 
            ? new Date(expectedResolutionDate) 
            : null,
          actualOutcome: null,
        });
        
        // Schedule follow-up if date provided
        if (expectedResolutionDate) {
          await scheduleJob(userId, 'open_loop_followup', {
            artifactId: artifact.id,
            description,
          }, new Date(expectedResolutionDate));
        }
        
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    create_gratitude_list: tool({
      description: 'Create a gratitude list with causal attributions.',
      parameters: z.object({
        items: z.array(z.object({
          item: z.string(),
          why: z.string().describe('Why this happened / why user is grateful'),
        })),
        promptVariant: z.string().describe('Which prompt style was used'),
      }),
      execute: async ({ items, promptVariant }) => {
        const artifact = await createArtifact(userId, 'gratitude_list', {
          type: 'gratitude_list',
          items,
          promptVariant,
        });
        return { success: true, artifactId: artifact.id };
      },
    }),
    
    // ============================================================
    // MOOD & SAFETY TOOLS
    // ============================================================
    
    log_mood: tool({
      description: 'Log the user\'s current mood state.',
      parameters: z.object({
        primary: z.string().describe('Primary emotion'),
        intensity: z.number().min(0).max(100),
        secondary: z.array(z.string()).optional(),
        context: z.string().optional(),
      }),
      execute: async ({ primary, intensity, secondary, context }) => {
        // Store in entry metadata
        return { success: true };
      },
    }),
    
    check_post_session_mood: tool({
      description: 'Ask the user how they\'re feeling after a processing session.',
      parameters: z.object({}),
      execute: async () => {
        // This triggers a UI prompt; result handled in next message
        return { 
          prompt: 'How are you feeling now compared to when we started?',
          options: ['Worse', 'Same', 'Better'],
        };
      },
    }),
  };
  
  // Filter to only allowed tools
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => allowedTools.includes(name))
  );
}
```

### 5.4 Protocol Definitions

```typescript
// src/server/protocols/plan.ts

export const planProtocol: Protocol = {
  id: 'plan-v1',
  mode: 'plan',
  version: 1,
  
  systemPrompt: `Guide the user through creating an implementation intention.
  
The goal is to help them move from vague intention to specific, actionable plan.
Keep it focused and practical. One good plan is better than many weak ones.`,
  
  questionSequence: [
    {
      id: 'outcome',
      order: 1,
      prompt: 'What\'s the one thing you want to make happen?',
      variants: [
        'What would make today feel successful?',
        'What\'s the most important thing to accomplish?',
      ],
      isRequired: true,
      followUpConditions: ['if vague, ask for specifics'],
    },
    {
      id: 'obstacle',
      order: 2,
      prompt: 'What usually gets in the way of this?',
      variants: [
        'What derails this kind of thing for you?',
        'What\'s the most likely reason this won\'t happen?',
      ],
      isRequired: true,
      followUpConditions: [],
    },
    {
      id: 'trigger',
      order: 3,
      prompt: 'What\'s a specific moment when you\'ll do this? (time, place, or preceding action)',
      variants: [
        'When exactly will you start?',
        'What will be your cue to begin?',
      ],
      isRequired: true,
      followUpConditions: ['if not specific enough, ask for concrete trigger'],
    },
    {
      id: 'action',
      order: 4,
      prompt: 'So when that moment comes, what exactly will you do?',
      variants: [
        'What\'s the first physical action you\'ll take?',
      ],
      isRequired: true,
      followUpConditions: [],
    },
    {
      id: 'backup',
      order: 5,
      prompt: 'And if that doesn\'t work, what\'s your backup?',
      variants: [
        'What will you do if you hit that obstacle?',
      ],
      isRequired: false,
      followUpConditions: [],
    },
  ],
  
  allowedTools: [
    'search_memories',
    'get_recent_entries',
    'get_open_loops',
    'get_user_preferences',
    'create_if_then_plan',
    'log_mood',
  ],
  
  stopConditions: [
    'User says they want to stop or switch to freewrite',
    'Plan has been created and confirmed',
    'User declines to provide required information after follow-up',
  ],
  
  guardrails: [
    'Keep questions focused; don\'t philosophize',
    'Accept imperfect answers; progress over perfection',
    'If user seems overwhelmed, suggest just one small plan',
  ],
  
  outputArtifacts: ['if_then_plan'],
  
  estimatedMinutes: { min: 2, max: 4 },
};

// Similar definitions for: reflect, sleep, lift, clarity, unpack, create
```

---

## 6. Memory System Integration

### 6.1 Zep Integration (Episodic Memory)

```typescript
// src/server/memory/zep.ts

import { ZepClient } from '@getzep/zep-js';

const zep = new ZepClient({ apiKey: process.env.ZEP_API_KEY });

// Namespace keys per user
function getUserSessionId(userId: string): string {
  return `journal_${userId}`;
}

export const zepMemory = {
  // Add entry to memory (called after Postgres write)
  async addEntry(userId: string, entry: Entry, messages: Message[]): Promise<void> {
    const sessionId = getUserSessionId(userId);
    
    // Format as memory
    const content = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');
    
    await zep.memory.add(sessionId, {
      messages: [{
        role: 'user',
        content,
        metadata: {
          entryId: entry.id,
          mode: entry.mode,
          timestamp: entry.createdAt.toISOString(),
        },
      }],
    });
    
    // Extract entities inline
    const entities = await this.extractEntities(userId, content, entry.id);
    
    return entities;
  },
  
  // Extract and store entities
  async extractEntities(
    userId: string, 
    content: string, 
    entryId: string
  ): Promise<Entity[]> {
    const sessionId = getUserSessionId(userId);
    
    // Zep extracts entities automatically; we sync to our DB
    const memory = await zep.memory.get(sessionId);
    const zepEntities = memory.relevantFacts || [];
    
    // Sync to local entities table
    const entities: Entity[] = [];
    for (const fact of zepEntities) {
      const entity = await upsertEntity(userId, {
        type: inferEntityType(fact),
        name: fact.name,
        zepEntityId: fact.id,
      });
      entities.push(entity);
    }
    
    return entities;
  },
  
  // Semantic search
  async search(
    userId: string, 
    query: string, 
    limit: number = 5
  ): Promise<MemorySearchResult[]> {
    const sessionId = getUserSessionId(userId);
    
    const results = await zep.memory.search(sessionId, {
      text: query,
      limit,
    });
    
    return results.map(r => ({
      content: r.message?.content || '',
      score: r.score,
      metadata: r.message?.metadata,
    }));
  },
  
  // Get context for specific entity
  async getEntityContext(
    userId: string, 
    entityName: string
  ): Promise<EntityContext> {
    const sessionId = getUserSessionId(userId);
    
    // Search for mentions of this entity
    const results = await zep.memory.search(sessionId, {
      text: entityName,
      limit: 10,
    });
    
    // Get entity facts
    const memory = await zep.memory.get(sessionId);
    const facts = memory.relevantFacts?.filter(
      f => f.name.toLowerCase() === entityName.toLowerCase()
    ) || [];
    
    return {
      entityName,
      facts,
      recentMentions: results,
    };
  },
  
  // Delete user's memory (GDPR)
  async deleteUser(userId: string): Promise<void> {
    const sessionId = getUserSessionId(userId);
    await zep.memory.delete(sessionId);
  },
};
```

### 6.2 Mem0 Integration (Long-term Patterns)

```typescript
// src/server/memory/mem0.ts

import { MemoryClient } from 'mem0ai';

const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

// Namespace per user
function getUserId(userId: string): string {
  return `journal_${userId}`;
}

export const mem0Memory = {
  // Get compressed preferences
  async getPreferences(userId: string): Promise<UserPreferences> {
    const mem0UserId = getUserId(userId);
    
    const memories = await mem0.search({
      query: 'user preferences journaling style',
      user_id: mem0UserId,
      limit: 20,
    });
    
    // Parse into structured preferences
    return parsePreferences(memories);
  },
  
  // Add/update preference
  async setPreference(
    userId: string, 
    key: string, 
    value: any
  ): Promise<void> {
    const mem0UserId = getUserId(userId);
    
    await mem0.add({
      messages: [{
        role: 'user',
        content: `User preference: ${key} = ${JSON.stringify(value)}`,
      }],
      user_id: mem0UserId,
      metadata: { type: 'preference', key },
    });
  },
  
  // Get cognitive patterns
  async getPatterns(userId: string): Promise<CognitivePattern[]> {
    const mem0UserId = getUserId(userId);
    
    const memories = await mem0.search({
      query: 'cognitive patterns tendencies behaviors',
      user_id: mem0UserId,
      limit: 10,
    });
    
    return memories.map(m => ({
      pattern: m.memory,
      confidence: m.score,
      lastObserved: m.metadata?.timestamp,
    }));
  },
  
  // Store weekly digest
  async storeDigest(
    userId: string, 
    digest: WeeklyDigest
  ): Promise<void> {
    const mem0UserId = getUserId(userId);
    
    // Compress into memory-friendly format
    const summary = `
Week of ${digest.weekStart}: 
Themes: ${digest.themes.join(', ')}
Mood trend: ${digest.moodTrend}
Key patterns: ${digest.patterns.join('; ')}
    `.trim();
    
    await mem0.add({
      messages: [{
        role: 'assistant',
        content: summary,
      }],
      user_id: mem0UserId,
      metadata: { 
        type: 'weekly_digest',
        weekStart: digest.weekStart,
      },
    });
  },
  
  // Delete user's memory (GDPR)
  async deleteUser(userId: string): Promise<void> {
    const mem0UserId = getUserId(userId);
    await mem0.deleteUser(mem0UserId);
  },
};
```

### 6.3 Memory Sync Service

```typescript
// src/server/services/memory-sync.ts

export class MemorySyncService {
  // Called after entry is saved to Postgres
  async syncEntry(entry: Entry, messages: Message[]): Promise<void> {
    try {
      // Sync to Zep (with inline entity extraction)
      await zepMemory.addEntry(entry.userId, entry, messages);
      
      // Update entry sync status
      await db.entry.update({
        where: { id: entry.id },
        data: { syncStatus: 'synced' },
      });
      
      // Log success
      await logEvent(entry.userId, 'memory.sync.success', {
        entryId: entry.id,
      });
    } catch (error) {
      // Mark as failed, will retry via cron
      await db.entry.update({
        where: { id: entry.id },
        data: { 
          syncStatus: 'failed',
          // Store error for debugging
        },
      });
      
      await logEvent(entry.userId, 'memory.sync.failed', {
        entryId: entry.id,
        error: error.message,
      });
    }
  }
  
  // Cron job to retry failed syncs
  async retryFailedSyncs(): Promise<void> {
    const failedEntries = await db.entry.findMany({
      where: { syncStatus: 'failed' },
      include: { messages: true },
      take: 100,
    });
    
    for (const entry of failedEntries) {
      await this.syncEntry(entry, entry.messages);
    }
  }
  
  // Cascade delete
  async deleteUserMemory(userId: string): Promise<void> {
    await Promise.all([
      zepMemory.deleteUser(userId),
      mem0Memory.deleteUser(userId),
    ]);
  }
}
```

---

## 7. Offline Architecture

### 7.1 Service Worker

```typescript
// public/sw.js

const CACHE_NAME = 'journal-v1';
const OFFLINE_CACHE = [
  '/',
  '/notebook',
  '/sessions',
  '/timeline',
  '/offline.html',
  // Static assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // API requests: network-first, queue if offline
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Queue for later sync
          return new Response(JSON.stringify({ 
            queued: true,
            offline: true 
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }
  
  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-entries') {
    event.waitUntil(syncPendingEntries());
  }
});
```

### 7.2 IndexedDB Schema

```typescript
// src/lib/offline/db.ts

import Dexie, { Table } from 'dexie';

export interface OfflineEntry {
  localId: string;
  serverId?: string;
  mode: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface OfflineMessage {
  localId: string;
  serverId?: string;
  entryLocalId: string;
  role: string;
  type: string;
  content: string;
  createdAt: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'entry' | 'message';
  localId: string;
  payload: any;
  attempts: number;
  createdAt: Date;
}

export interface CachedPreferences {
  userId: string;
  data: any;
  fetchedAt: Date;
}

class JournalDatabase extends Dexie {
  entries!: Table<OfflineEntry>;
  messages!: Table<OfflineMessage>;
  syncQueue!: Table<SyncQueueItem>;
  preferences!: Table<CachedPreferences>;
  
  constructor() {
    super('JournalDB');
    
    this.version(1).stores({
      entries: 'localId, serverId, mode, status, createdAt, syncStatus',
      messages: 'localId, serverId, entryLocalId, createdAt, syncStatus',
      syncQueue: 'id, entityType, createdAt',
      preferences: 'userId',
    });
  }
}

export const offlineDb = new JournalDatabase();
```

### 7.3 Sync Manager

```typescript
// src/lib/offline/sync-manager.ts

import { offlineDb } from './db';
import { trpc } from '../trpc';

export class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  
  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }
  
  private handleOnline() {
    this.isOnline = true;
    this.syncPending();
  }
  
  private handleOffline() {
    this.isOnline = false;
  }
  
  // Save entry locally (called for all writes)
  async saveEntry(entry: Partial<OfflineEntry>): Promise<string> {
    const localId = entry.localId || generateLocalId();
    
    await offlineDb.entries.put({
      localId,
      mode: entry.mode!,
      status: entry.status || 'active',
      createdAt: entry.createdAt || new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending',
    });
    
    // Queue for sync
    await this.queueSync('create', 'entry', localId, entry);
    
    // Try immediate sync if online
    if (this.isOnline) {
      this.syncPending();
    }
    
    return localId;
  }
  
  async saveMessage(message: Partial<OfflineMessage>): Promise<string> {
    const localId = message.localId || generateLocalId();
    
    await offlineDb.messages.put({
      localId,
      entryLocalId: message.entryLocalId!,
      role: message.role!,
      type: message.type || 'text',
      content: message.content!,
      createdAt: message.createdAt || new Date(),
      syncStatus: 'pending',
    });
    
    await this.queueSync('create', 'message', localId, message);
    
    if (this.isOnline) {
      this.syncPending();
    }
    
    return localId;
  }
  
  private async queueSync(
    operation: 'create' | 'update' | 'delete',
    entityType: 'entry' | 'message',
    localId: string,
    payload: any
  ): Promise<void> {
    await offlineDb.syncQueue.add({
      id: generateLocalId(),
      operation,
      entityType,
      localId,
      payload,
      attempts: 0,
      createdAt: new Date(),
    });
  }
  
  async syncPending(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;
    
    this.syncInProgress = true;
    
    try {
      const pendingItems = await offlineDb.syncQueue
        .where('attempts')
        .below(5)
        .toArray();
      
      if (pendingItems.length === 0) return;
      
      // Batch sync
      const result = await trpc.sync.push.mutate({
        items: pendingItems.map(item => ({
          operation: item.operation,
          entityType: item.entityType,
          localId: item.localId,
          payload: item.payload,
        })),
      });
      
      // Update local records with server IDs
      for (const mapping of result.mappings) {
        if (mapping.entityType === 'entry') {
          await offlineDb.entries.update(mapping.localId, {
            serverId: mapping.serverId,
            syncStatus: 'synced',
          });
        } else if (mapping.entityType === 'message') {
          await offlineDb.messages.update(mapping.localId, {
            serverId: mapping.serverId,
            syncStatus: 'synced',
          });
        }
        
        // Remove from queue
        await offlineDb.syncQueue
          .where('localId')
          .equals(mapping.localId)
          .delete();
      }
    } catch (error) {
      // Increment attempt counts
      const pendingItems = await offlineDb.syncQueue.toArray();
      for (const item of pendingItems) {
        await offlineDb.syncQueue.update(item.id, {
          attempts: item.attempts + 1,
        });
      }
    } finally {
      this.syncInProgress = false;
    }
  }
  
  // Get sync status for UI
  async getSyncStatus(): Promise<SyncStatus> {
    const pending = await offlineDb.syncQueue.count();
    const failed = await offlineDb.syncQueue
      .where('attempts')
      .aboveOrEqual(5)
      .count();
    
    return {
      isOnline: this.isOnline,
      pendingCount: pending,
      failedCount: failed,
    };
  }
}

export const syncManager = new SyncManager();
```

---

## 8. Background Jobs (Vercel Cron)

### 8.1 Job Definitions

```typescript
// src/app/api/cron/session-finalization/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Find sessions past timeout (30 min default)
  const timedOutSessions = await db.scheduledJob.findMany({
    where: {
      type: 'session_finalization',
      status: 'pending',
      scheduledFor: { lte: new Date() },
    },
    include: {
      entry: {
        include: { messages: true },
      },
    },
  });
  
  for (const job of timedOutSessions) {
    try {
      await finalizeSession(job.entry, job.payload);
      
      await db.scheduledJob.update({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    } catch (error) {
      await logEvent(job.userId, 'job.failed', {
        jobId: job.id,
        error: error.message,
      });
    }
  }
  
  return NextResponse.json({ processed: timedOutSessions.length });
}

// Finalize session: generate artifacts if needed
async function finalizeSession(entry: Entry, payload: any): Promise<void> {
  // Mark entry as completed or abandoned
  const hasUserMessages = entry.messages.some(m => m.role === 'user');
  const status = hasUserMessages ? 'completed' : 'abandoned';
  
  await db.entry.update({
    where: { id: entry.id },
    data: { status, completedAt: new Date() },
  });
  
  if (status === 'abandoned') return;
  
  // Generate artifacts based on mode
  const protocol = await loadProtocol(entry.mode);
  
  // Call LLM to extract artifacts if not already created
  const existingArtifacts = await db.artifact.findMany({
    where: { entryId: entry.id },
  });
  
  const missingTypes = protocol.outputArtifacts.filter(
    type => !existingArtifacts.some(a => a.type === type)
  );
  
  if (missingTypes.length > 0) {
    await generateMissingArtifacts(entry, missingTypes);
  }
  
  // Sync to memory
  await memorySyncService.syncEntry(entry, entry.messages);
}

// src/app/api/cron/open-loop-followup/route.ts

export async function GET(request: Request) {
  // Verify cron secret...
  
  const dueFollowups = await db.scheduledJob.findMany({
    where: {
      type: 'open_loop_followup',
      status: 'pending',
      scheduledFor: { lte: new Date() },
    },
  });
  
  for (const job of dueFollowups) {
    // These will be surfaced in the user's next session
    // via the Router's context injection
    await db.scheduledJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    
    // Mark the open loop as ready for follow-up
    await db.artifact.update({
      where: { id: job.payload.artifactId },
      data: { status: 'pending' },  // Ready for follow-up question
    });
  }
  
  return NextResponse.json({ processed: dueFollowups.length });
}

// src/app/api/cron/weekly-review/route.ts

export async function GET(request: Request) {
  // Verify cron secret...
  
  const dueReviews = await db.scheduledJob.findMany({
    where: {
      type: 'weekly_review',
      status: 'pending',
      scheduledFor: { lte: new Date() },
    },
  });
  
  for (const job of dueReviews) {
    await generateWeeklyReview(job.userId, job.payload);
    
    await db.scheduledJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    
    // Schedule next week's review
    await scheduleWeeklyReview(job.userId, job.payload.preferredDay);
  }
  
  return NextResponse.json({ processed: dueReviews.length });
}
```

### 8.2 Weekly Review Generation

```typescript
// src/server/services/weekly-review.ts

export async function generateWeeklyReview(
  userId: string,
  config: { weekStart: Date; weekEnd: Date }
): Promise<void> {
  // Gather week's data
  const entries = await db.entry.findMany({
    where: {
      userId,
      createdAt: {
        gte: config.weekStart,
        lte: config.weekEnd,
      },
    },
    include: { messages: true },
  });
  
  const artifacts = await db.artifact.findMany({
    where: {
      userId,
      createdAt: {
        gte: config.weekStart,
        lte: config.weekEnd,
      },
    },
  });
  
  // Multiple LLM calls for different aspects
  const [themes, moodAnalysis, patterns] = await Promise.all([
    analyzeThemes(entries),
    analyzeMood(entries),
    analyzePatterns(userId, entries),
  ]);
  
  // Get open loops
  const openLoops = await db.artifact.findMany({
    where: {
      userId,
      type: 'open_loop',
      OR: [
        { status: 'pending' },
        {
          resolvedAt: {
            gte: config.weekStart,
            lte: config.weekEnd,
          },
        },
      ],
    },
  });
  
  // Create review artifact
  const review: WeeklyReviewData = {
    type: 'weekly_review',
    weekStartDate: config.weekStart,
    weekEndDate: config.weekEnd,
    themes: themes.themes,
    wins: themes.wins,
    obstacles: themes.obstacles,
    moodTrend: moodAnalysis,
    topicFrequency: themes.topicFrequency,
    openLoopsResolved: openLoops
      .filter(l => l.status === 'completed')
      .map(l => ({
        loopId: l.id,
        description: l.data.description,
        outcome: l.resolutionNotes || '',
      })),
    openLoopsPending: openLoops
      .filter(l => l.status === 'pending')
      .map(l => ({
        loopId: l.id,
        description: l.data.description,
      })),
    patternInsights: patterns.insights,
    suggestedExperiments: patterns.experiments,
  };
  
  await db.artifact.create({
    data: {
      userId,
      type: 'weekly_review',
      data: review,
    },
  });
  
  // Store digest in Mem0
  await mem0Memory.storeDigest(userId, {
    weekStart: config.weekStart.toISOString(),
    themes: review.themes,
    moodTrend: review.moodTrend.trend,
    patterns: review.patternInsights,
  });
  
  // Send push notification
  await sendPushNotification(userId, {
    title: 'Your Weekly Review is Ready',
    body: `${review.wins.length} wins, ${review.themes.length} themes this week`,
    url: '/review',
  });
}
```

### 8.3 Vercel Cron Configuration

```json
// vercel.json

{
  "crons": [
    {
      "path": "/api/cron/session-finalization",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/open-loop-followup",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/weekly-review",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/memory-sync-retry",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## 9. Frontend Architecture

### 9.1 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/
│   │   ├── notebook/
│   │   ├── sessions/
│   │   │   └── [mode]/
│   │   ├── timeline/
│   │   ├── review/
│   │   ├── memory/
│   │   └── settings/
│   ├── api/
│   │   ├── trpc/[trpc]/
│   │   ├── session/stream/
│   │   └── cron/
│   └── layout.tsx
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── notebook/
│   │   ├── NotebookEditor.tsx
│   │   ├── MeltingQuestion.tsx
│   │   └── NotebookToolbar.tsx
│   ├── sessions/
│   │   ├── SessionView.tsx
│   │   ├── SessionMessages.tsx
│   │   ├── ModeSelector.tsx
│   │   └── ArtifactCard.tsx
│   ├── timeline/
│   │   ├── TimelineView.tsx
│   │   ├── EntryCard.tsx
│   │   └── SearchFilters.tsx
│   ├── review/
│   │   └── WeeklyReview.tsx
│   └── shared/
│       ├── MarkdownEditor.tsx
│       ├── SyncIndicator.tsx
│       └── OfflineBanner.tsx
├── hooks/
│   ├── useNotebook.ts
│   ├── useSession.ts
│   ├── useOffline.ts
│   ├── useSyncStatus.ts
│   └── useStreamingResponse.ts
├── lib/
│   ├── trpc.ts
│   ├── offline/
│   │   ├── db.ts
│   │   └── sync-manager.ts
│   └── utils.ts
├── stores/                       # Zustand stores
│   ├── notebook-store.ts
│   ├── session-store.ts
│   └── sync-store.ts
└── types/
    └── index.ts
```

### 9.2 Key Components

```typescript
// src/components/notebook/NotebookEditor.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotebook } from '@/hooks/useNotebook';
import { MeltingQuestion } from './MeltingQuestion';
import { MarkdownEditor } from '../shared/MarkdownEditor';

export function NotebookEditor() {
  const {
    entry,
    messages,
    saveMessage,
    requestQuestion,
    isQuestionLoading,
    currentQuestion,
  } = useNotebook();
  
  const [content, setContent] = useState('');
  const [showQuestion, setShowQuestion] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const questionDelayRef = useRef<NodeJS.Timeout>();
  
  // Handle content change
  const handleChange = useCallback((value: string) => {
    setContent(value);
    setShowQuestion(false);
    
    // Clear timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (questionDelayRef.current) clearTimeout(questionDelayRef.current);
    
    // Save on paragraph completion (double newline)
    if (value.endsWith('\n\n')) {
      saveMessage(value);
      
      // Request new question after paragraph
      requestQuestion(value);
    }
    
    // Start idle timer
    idleTimerRef.current = setTimeout(() => {
      // User stopped typing for 3s
      if (value.trim()) {
        saveMessage(value);
        requestQuestion(value);
      }
    }, 3000);
  }, [saveMessage, requestQuestion]);
  
  // Show question after 5s delay
  useEffect(() => {
    if (currentQuestion && !isQuestionLoading) {
      questionDelayRef.current = setTimeout(() => {
        setShowQuestion(true);
      }, 5000);
    }
    
    return () => {
      if (questionDelayRef.current) clearTimeout(questionDelayRef.current);
    };
  }, [currentQuestion, isQuestionLoading]);
  
  // Dismiss question on Escape or Delete
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'Escape' || e.key === 'Delete') && showQuestion) {
      setShowQuestion(false);
    }
  }, [showQuestion]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return (
    <div className="notebook-container">
      <MarkdownEditor
        value={content}
        onChange={handleChange}
        placeholder="What's on your mind?"
        className="notebook-editor"
      />
      
      {showQuestion && currentQuestion && (
        <MeltingQuestion
          question={currentQuestion}
          onDismiss={() => setShowQuestion(false)}
        />
      )}
    </div>
  );
}

// src/components/sessions/SessionView.tsx

'use client';

import { useSession } from '@/hooks/useSession';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import { SessionMessages } from './SessionMessages';
import { MarkdownEditor } from '../shared/MarkdownEditor';

interface SessionViewProps {
  mode: EntryMode;
}

export function SessionView({ mode }: SessionViewProps) {
  const {
    entry,
    messages,
    isLoading,
    sendMessage,
  } = useSession(mode);
  
  const {
    streamingContent,
    isStreaming,
  } = useStreamingResponse(entry?.id);
  
  const [input, setInput] = useState('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout>();
  
  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    
    sendMessage(input);
    setInput('');
  }, [input, isStreaming, sendMessage]);
  
  // 5-second typing delay before requesting response
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // If user stops typing, they're done with this message
    setTypingTimeout(setTimeout(() => {
      // Ready to send
    }, 5000));
  }, [typingTimeout]);
  
  return (
    <div className="session-container">
      <SessionMessages
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
      />
      
      <div className="session-input">
        <MarkdownEditor
          value={input}
          onChange={handleInputChange}
          placeholder="Type your response..."
          onSubmit={handleSend}
        />
        
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### 9.3 State Management

```typescript
// src/stores/notebook-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { offlineDb } from '@/lib/offline/db';

interface NotebookState {
  currentEntryLocalId: string | null;
  content: string;
  currentQuestion: string | null;
  isQuestionLoading: boolean;
  
  // Actions
  setContent: (content: string) => void;
  setCurrentQuestion: (question: string | null) => void;
  setQuestionLoading: (loading: boolean) => void;
  startNewEntry: () => Promise<string>;
  saveMessage: (content: string) => Promise<void>;
}

export const useNotebookStore = create<NotebookState>()(
  persist(
    (set, get) => ({
      currentEntryLocalId: null,
      content: '',
      currentQuestion: null,
      isQuestionLoading: false,
      
      setContent: (content) => set({ content }),
      setCurrentQuestion: (question) => set({ currentQuestion: question }),
      setQuestionLoading: (loading) => set({ isQuestionLoading: loading }),
      
      startNewEntry: async () => {
        const localId = generateLocalId();
        
        await offlineDb.entries.add({
          localId,
          mode: 'notebook',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          syncStatus: 'pending',
        });
        
        set({ currentEntryLocalId: localId, content: '' });
        
        return localId;
      },
      
      saveMessage: async (content) => {
        const { currentEntryLocalId } = get();
        if (!currentEntryLocalId || !content.trim()) return;
        
        const localId = generateLocalId();
        
        await offlineDb.messages.add({
          localId,
          entryLocalId: currentEntryLocalId,
          role: 'user',
          type: 'text',
          content,
          createdAt: new Date(),
          syncStatus: 'pending',
        });
        
        // Trigger sync
        syncManager.syncPending();
      },
    }),
    {
      name: 'notebook-store',
      partialize: (state) => ({
        currentEntryLocalId: state.currentEntryLocalId,
        content: state.content,
      }),
    }
  )
);

// src/stores/sync-store.ts

import { create } from 'zustand';
import { syncManager } from '@/lib/offline/sync-manager';

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  
  // Actions
  updateStatus: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  
  updateStatus: async () => {
    const status = await syncManager.getSyncStatus();
    set({
      isOnline: status.isOnline,
      pendingCount: status.pendingCount,
      failedCount: status.failedCount,
    });
  },
  
  triggerSync: async () => {
    await syncManager.syncPending();
    const status = await syncManager.getSyncStatus();
    set({
      pendingCount: status.pendingCount,
      failedCount: status.failedCount,
      lastSyncAt: new Date(),
    });
  },
}));
```

### 9.4 Streaming Hook

```typescript
// src/hooks/useStreamingResponse.ts

import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect, useRef } from 'react';

export function useStreamingResponse(entryId: string | undefined) {
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldRequestRef = useRef(true);
  
  const {
    messages,
    input,
    setInput,
    append,
    isLoading,
    error,
  } = useChat({
    api: '/api/session/stream',
    body: { entryId },
    onFinish: (message) => {
      // Save to offline store
      if (entryId) {
        offlineDb.messages.add({
          localId: generateLocalId(),
          entryLocalId: entryId,
          role: 'assistant',
          type: 'text',
          content: message.content,
          createdAt: new Date(),
          syncStatus: 'pending',
        });
      }
    },
  });
  
  // 5-second delay: if user starts typing, delay request
  const handleUserTyping = useCallback(() => {
    shouldRequestRef.current = false;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      shouldRequestRef.current = true;
    }, 5000);
  }, []);
  
  const sendMessage = useCallback(async (content: string) => {
    // Save user message to offline store
    if (entryId) {
      await offlineDb.messages.add({
        localId: generateLocalId(),
        entryLocalId: entryId,
        role: 'user',
        type: 'text',
        content,
        createdAt: new Date(),
        syncStatus: 'pending',
      });
    }
    
    // Check if we should request (5s typing delay)
    if (shouldRequestRef.current) {
      await append({ role: 'user', content });
    } else {
      // Queue for when typing stops
      typingTimeoutRef.current = setTimeout(() => {
        append({ role: 'user', content });
      }, 5000);
    }
  }, [entryId, append]);
  
  return {
    messages,
    streamingContent: messages[messages.length - 1]?.content || '',
    isStreaming: isLoading,
    error,
    sendMessage,
    handleUserTyping,
  };
}
```

---

## 10. Testing Strategy

### 10.1 Testing Pyramid

```
                    ┌─────────────┐
                    │   E2E Tests │  (Playwright)
                    │   ~10 tests │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │  Integration Tests  │  (Vitest + MSW)
                │     ~50 tests       │
                └──────────┬──────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │          Unit Tests               │  (Vitest)
         │          ~200 tests               │
         └───────────────────────────────────┘
```

### 10.2 Unit Tests

```typescript
// src/server/llm/__tests__/router.test.ts

import { describe, it, expect, vi } from 'vitest';
import { classifyMode, generateNotebookQuestion } from '../router';

describe('Router', () => {
  describe('classifyMode', () => {
    it('classifies planning intent', async () => {
      const result = await classifyMode(
        'I need to figure out how to tackle this presentation tomorrow'
      );
      expect(result).toBe('plan');
    });
    
    it('classifies emotional processing', async () => {
      const result = await classifyMode(
        'I can\'t stop thinking about what happened with my manager'
      );
      expect(['clarity', 'unpack']).toContain(result);
    });
    
    it('defaults to notebook for ambiguous content', async () => {
      const result = await classifyMode('Had lunch.');
      expect(result).toBe('notebook');
    });
  });
});

// src/server/services/__tests__/artifact-creation.test.ts

describe('Artifact Creation', () => {
  it('creates valid if-then plan', async () => {
    const artifact = await createArtifact('user-1', 'if_then_plan', {
      type: 'if_then_plan',
      goal: 'Exercise more',
      obstacle: 'Too tired after work',
      trigger: 'When I get home from work',
      action: 'Put on workout clothes immediately',
      backup: 'Do 10 minutes of stretching instead',
      calendarText: null,
    });
    
    expect(artifact.id).toBeDefined();
    expect(artifact.type).toBe('if_then_plan');
    expect(artifact.data.goal).toBe('Exercise more');
  });
  
  it('creates balanced thought with required fields', async () => {
    const artifact = await createArtifact('user-1', 'balanced_thought', {
      type: 'balanced_thought',
      situation: 'Meeting with boss',
      automaticThought: 'They think I\'m incompetent',
      emotion: 'anxiety',
      emotionIntensityBefore: 80,
      evidenceFor: ['Made a mistake last week'],
      evidenceAgainst: ['Got positive review', 'Boss asked for my input'],
      balancedThought: 'One mistake doesn\'t define my competence',
      emotionIntensityAfter: 40,
      nextStep: null,
    });
    
    expect(artifact.data.emotionIntensityAfter).toBeLessThan(
      artifact.data.emotionIntensityBefore
    );
  });
});
```

### 10.3 Integration Tests

```typescript
// src/server/__tests__/session-flow.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, teardownTestDb, createTestUser } from '../test-utils';

describe('Session Flow Integration', () => {
  let userId: string;
  
  beforeEach(async () => {
    await setupTestDb();
    userId = await createTestUser();
  });
  
  afterEach(async () => {
    await teardownTestDb();
  });
  
  it('completes a Plan session end-to-end', async () => {
    // Start session
    const entry = await trpc.sessions.startSession.mutate({
      mode: 'plan',
      initialContext: 'I want to start exercising',
    });
    
    expect(entry.mode).toBe('plan');
    expect(entry.status).toBe('active');
    
    // Simulate conversation
    const messages = [
      { role: 'user', content: 'I want to exercise 3 times a week' },
      { role: 'user', content: 'I usually get too tired after work' },
      { role: 'user', content: 'Right when I get home, before I sit down' },
      { role: 'user', content: 'I\'ll put on my workout clothes immediately' },
    ];
    
    for (const msg of messages) {
      await sendSessionMessage(entry.id, msg.content);
      // Wait for response
      await waitForResponse(entry.id);
    }
    
    // Finalize
    await trpc.entries.finalize.mutate({
      id: entry.id,
      status: 'completed',
    });
    
    // Check artifact was created
    const artifacts = await trpc.artifacts.list.query({
      entryId: entry.id,
    });
    
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].type).toBe('if_then_plan');
    expect(artifacts[0].data.goal).toContain('exercise');
  });
  
  it('handles offline entry sync', async () => {
    // Create entry offline
    const localId = await syncManager.saveEntry({
      mode: 'notebook',
      status: 'active',
    });
    
    await syncManager.saveMessage({
      entryLocalId: localId,
      role: 'user',
      content: 'Testing offline entry',
    });
    
    // Verify in IndexedDB
    const offlineEntry = await offlineDb.entries.get(localId);
    expect(offlineEntry?.syncStatus).toBe('pending');
    
    // Sync
    await syncManager.syncPending();
    
    // Verify synced
    const syncedEntry = await offlineDb.entries.get(localId);
    expect(syncedEntry?.syncStatus).toBe('synced');
    expect(syncedEntry?.serverId).toBeDefined();
    
    // Verify in Postgres
    const dbEntry = await db.entry.findUnique({
      where: { id: syncedEntry?.serverId },
    });
    expect(dbEntry).toBeDefined();
  });
});
```

### 10.4 LLM Eval Framework

```typescript
// src/server/evals/router-eval.ts

import { describe, it, expect } from 'vitest';
import { classifyMode } from '../llm/router';

interface EvalCase {
  input: string;
  expectedModes: EntryMode[];  // Acceptable answers
  description: string;
}

const ROUTER_EVAL_CASES: EvalCase[] = [
  {
    input: 'I need to prepare for my presentation tomorrow',
    expectedModes: ['plan'],
    description: 'Clear planning intent',
  },
  {
    input: 'I keep thinking about what my boss said and I can\'t let it go',
    expectedModes: ['clarity', 'unpack'],
    description: 'Rumination pattern',
  },
  {
    input: 'Had a great day today. Went for a walk.',
    expectedModes: ['notebook', 'reflect'],
    description: 'Neutral reflection',
  },
  {
    input: 'I feel so grateful for my family',
    expectedModes: ['lift', 'notebook'],
    description: 'Gratitude expression',
  },
  {
    input: 'Can\'t sleep. Too many things on my mind.',
    expectedModes: ['sleep', 'plan'],
    description: 'Sleep/offload trigger',
  },
  // Add more cases...
];

describe('Router Classification Eval', () => {
  for (const evalCase of ROUTER_EVAL_CASES) {
    it(evalCase.description, async () => {
      const result = await classifyMode(evalCase.input);
      
      expect(evalCase.expectedModes).toContain(result);
    });
  }
});

// Run with: npx vitest run src/server/evals/

// src/server/evals/meaning-making-eval.ts

const MEANING_MAKING_CASES = [
  {
    input: 'I realized that my anxiety about the meeting was unfounded because...',
    expectedScore: { min: 0.7, max: 1.0 },
    description: 'Contains because + realize',
  },
  {
    input: 'The meeting was bad.',
    expectedScore: { min: 0.0, max: 0.3 },
    description: 'No meaning-making language',
  },
];

describe('Meaning-Making Detection Eval', () => {
  for (const evalCase of MEANING_MAKING_CASES) {
    it(evalCase.description, async () => {
      const score = await detectMeaningMaking(evalCase.input);
      
      expect(score).toBeGreaterThanOrEqual(evalCase.expectedScore.min);
      expect(score).toBeLessThanOrEqual(evalCase.expectedScore.max);
    });
  }
});
```

### 10.5 Debugging & Agent-Friendly Development

```typescript
// src/lib/debug/logger.ts

export const logger = {
  // Structured logging for easy parsing
  llm: (event: string, data: Record<string, any>) => {
    console.log(JSON.stringify({
      type: 'llm',
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
  
  sync: (event: string, data: Record<string, any>) => {
    console.log(JSON.stringify({
      type: 'sync',
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
  
  session: (event: string, data: Record<string, any>) => {
    console.log(JSON.stringify({
      type: 'session',
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  },
};

// Usage in LLM orchestration
async function runSpecialist(entryId: string, messages: Message[]) {
  logger.llm('specialist.start', { entryId, messageCount: messages.length });
  
  try {
    const result = await streamText({...});
    
    logger.llm('specialist.complete', {
      entryId,
      responseLength: result.text.length,
      toolsUsed: result.toolCalls?.map(t => t.toolName),
    });
    
    return result;
  } catch (error) {
    logger.llm('specialist.error', {
      entryId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// src/lib/debug/validation-tools.ts

/**
 * Validation tools for coding agents to verify their changes
 */

export const validationTools = {
  // Verify data model consistency
  async checkDataIntegrity(): Promise<ValidationResult> {
    const issues: string[] = [];
    
    // Check for orphaned messages
    const orphanedMessages = await db.$queryRaw`
      SELECT m.id FROM messages m
      LEFT JOIN entries e ON m.entry_id = e.id
      WHERE e.id IS NULL
    `;
    if (orphanedMessages.length > 0) {
      issues.push(`Found ${orphanedMessages.length} orphaned messages`);
    }
    
    // Check for entries without messages
    const emptyEntries = await db.$queryRaw`
      SELECT e.id FROM entries e
      LEFT JOIN messages m ON e.id = m.entry_id
      WHERE m.id IS NULL AND e.status = 'completed'
    `;
    if (emptyEntries.length > 0) {
      issues.push(`Found ${emptyEntries.length} completed entries without messages`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  },
  
  // Verify LLM tool definitions match expected schema
  async checkToolSchemas(): Promise<ValidationResult> {
    const tools = buildTools(['all'], 'test-user');
    const issues: string[] = [];
    
    for (const [name, tool] of Object.entries(tools)) {
      try {
        // Validate schema is parseable
        tool.parameters.parse({});
      } catch (error) {
        // Expected for required params, but should be a ZodError
        if (!(error instanceof z.ZodError)) {
          issues.push(`Tool ${name} has invalid schema: ${error.message}`);
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  },
  
  // Verify protocol definitions are complete
  async checkProtocols(): Promise<ValidationResult> {
    const issues: string[] = [];
    const requiredModes = ['plan', 'reflect', 'sleep', 'lift', 'clarity', 'unpack', 'create'];
    
    for (const mode of requiredModes) {
      const protocol = await loadProtocol(mode);
      
      if (!protocol) {
        issues.push(`Missing protocol for mode: ${mode}`);
        continue;
      }
      
      if (protocol.questionSequence.length === 0) {
        issues.push(`Protocol ${mode} has no questions`);
      }
      
      if (protocol.outputArtifacts.length === 0) {
        issues.push(`Protocol ${mode} has no output artifacts defined`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  },
  
  // Run all validations
  async runAll(): Promise<Record<string, ValidationResult>> {
    return {
      dataIntegrity: await this.checkDataIntegrity(),
      toolSchemas: await this.checkToolSchemas(),
      protocols: await this.checkProtocols(),
    };
  },
};

// CLI tool for agents
// npx tsx src/lib/debug/validate.ts
if (require.main === module) {
  validationTools.runAll().then((results) => {
    console.log(JSON.stringify(results, null, 2));
    
    const hasIssues = Object.values(results).some(r => !r.valid);
    process.exit(hasIssues ? 1 : 0);
  });
}
```

---

## 11. DevOps & Deployment

### 11.1 Docker Configuration

```dockerfile
# Dockerfile

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Drizzle client
RUN npx drizzel generate

# Build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static


USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://journal:journal@db:5432/journal
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ZEP_API_KEY=${ZEP_API_KEY}
      - MEM0_API_KEY=${MEM0_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=journal
      - POSTGRES_PASSWORD=journal
      - POSTGRES_DB=journal
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U journal"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 11.2 Environment Configuration

```typescript
// src/env.ts

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Auth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  
  // LLM
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  
  // Memory services
  ZEP_API_KEY: z.string(),
  MEM0_API_KEY: z.string(),
  
  // Cron
  CRON_SECRET: z.string().min(32),
  
  // Push notifications
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  
  // Feature flags
  ENABLE_PUSH_NOTIFICATIONS: z.boolean().default(false),
});

export const env = envSchema.parse(process.env);
```

### 11.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm db:push
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
        env:
          SKIP_ENV_VALIDATION: true

  deploy:
    needs: [lint, test, build]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 12. Security

### 12.1 Authentication Flow

```
import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getUserUseCases } from "@/app/composition/users";
import { normalizedEmailSchema } from "@/modules/kernel";
import { createLogger } from "@/modules/kernel/observability";
import { authConfig } from "./auth.config";

const logger = createLogger("auth");

const userUseCases = getUserUseCases();

export const LoginSchema = z.object({
	email: normalizedEmailSchema,
	password: z.string().min(1),
});

export type UserType = "regular";

declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			type: UserType;
		} & DefaultSession["user"];
	}

	interface User {
		id: string;
		email: string;
		type: UserType;
	}
}

declare module "next-auth/jwt" {
	interface JWT extends DefaultJWT {
		id: string;
		type: UserType;
	}
}

const nextAuthConfig: NextAuthConfig = {
	...authConfig,
	// Explicitly use JWT strategy (required for Credentials provider)
	session: { strategy: "jwt" },
	logger: {
		warn: (code: string) => {
			logger.warn({
				event: "auth.nextauth.warning",
				details: { code },
			});
		},
		error: (error: Error) => {
			logger.error({
				event: "auth.nextauth.error",
				error: error.message,
				details: { name: error.name, stack: error.stack },
			});
		},
		debug: (message: string, metadata?: unknown) => {
			logger.debug({
				event: "auth.nextauth.debug",
				details: { message, metadata },
			});
		},
	},
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = LoginSchema.safeParse(credentials);
				if (!parsed.success) {
					logger.warn({
						event: "auth.credentials.validation_failed",
						details: {
							errors: parsed.error.flatten().fieldErrors,
						},
					});
					return null;
				}

				const { email, password } = parsed.data;

				try {
					const authUser = await userUseCases.authenticateSession({
						email,
						password,
					});

					if (!authUser) {
						logger.info({
							event: "auth.credentials.auth_failed",
							details: { email },
						});
						return null;
					}

					logger.info({
						event: "auth.credentials.auth_success",
						details: { email, userId: authUser.id },
					});

					return {
						id: authUser.id,
						email: authUser.email,
						type: "regular",
					};
				} catch (error) {
					logger.error({
						event: "auth.credentials.auth_error",
						error: error instanceof Error ? error.message : String(error),
						details: { email },
					});
					throw error;
				}
			},
		}),
	],
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.type = user.type;
			}

			return token;
		},
		session({ session, token }) {
			if (session.user) {
				session.user.id = token.id;
				session.user.type = token.type;
			}

			return session;
		},
	},
};

export const {
	handlers: { GET, POST },
	auth,
	signIn,
	signOut,
} = NextAuth(nextAuthConfig);

```



---

## 13. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Goal:** Core infrastructure and basic notebook functionality

- [ ] Project setup (Next.js, TypeScript, tRPC, Drizzle, Zod)
- [ ] Database schema and migrations
- [ ] NextAuth integration
- [ ] Basic UI shell (shadcn/ui)
- [ ] Notebook editor with Markdown support
- [ ] Entry/Message CRUD operations
- [ ] IndexedDB offline storage
- [ ] Basic sync mechanism

**Deliverable:** Working notebook with offline support

### Phase 2: Memory Integration (Weeks 4-5)

**Goal:** Connect Zep and Mem0

- [ ] Zep client integration
- [ ] Mem0 client integration
- [ ] Memory sync service
- [ ] Entity extraction pipeline
- [ ] Basic memory UI (view entities)
- [ ] Memory deletion/forget controls

**Deliverable:** Entries indexed in memory, entities visible

### Phase 3: Router & Basic Sessions (Weeks 6-7)

**Goal:** Notebook questions and first guided session

- [ ] Router LLM integration (Haiku)
- [ ] Notebook question generation
- [ ] "Melting text" UI effect
- [ ] Plan session protocol (first guided mode)
- [ ] Specialist LLM integration (Sonnet)
- [ ] Streaming responses
- [ ] If-Then Plan artifact creation

**Deliverable:** Notebook with contextual questions, working Plan session

### Phase 4: All Sessions (Weeks 8-10)

**Goal:** Complete all guided session modes

- [ ] Reflect session
- [ ] Sleep session  
- [ ] Lift session (gratitude)
- [ ] Clarity session (thought record)
- [ ] Unpack session (expressive writing)
- [ ] Create session (best possible self)
- [ ] All artifact types
- [ ] Session finalization (timeout + cleanup)

**Deliverable:** All 7 session modes functional

### Phase 5: Timeline & Search (Weeks 11-12)

**Goal:** Browse and search past entries

- [ ] Timeline view
- [ ] Full-text search (Postgres)
- [ ] Semantic search (Zep)
- [ ] Combined search with filters
- [ ] Entry detail view
- [ ] Artifact management

**Deliverable:** Complete timeline with search

### Phase 6: Reviews & Background Jobs (Weeks 13-14)

**Goal:** Weekly reviews and scheduled jobs

- [ ] Vercel Cron setup
- [ ] Session finalization job
- [ ] Open loop follow-up job
- [ ] Weekly review generation
- [ ] Review UI
- [ ] Push notifications

**Deliverable:** Automated reviews and follow-ups

### Phase 7: Polish & Testing (Weeks 15-16)

**Goal:** Production readiness

- [ ] Complete test suite
- [ ] LLM eval framework
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Docker configuration
- [ ] Documentation
- [ ] Onboarding flow

**Deliverable:** Production-ready application

---

## 14. Open Questions & Risks

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Zep/Mem0 API instability | Medium | High | Build retry logic, queue failed syncs |
| LLM latency affects UX | Medium | Medium | Streaming, optimistic UI, fast model for routing |
| Offline sync conflicts | Low | Medium | Append-only model, last-write-wins |
| IndexedDB storage limits | Low | Low | Prune old synced entries |

### Questions

1. **Onboarding conversational flow:** PRD mentions 8 questions stored as Mem0 facts. Should these be collected via a traditional form, or a conversational interface?
   1. Answer: conversational interface

2. **Protocol hot-reloading:** When protocol definitions change, should in-progress sessions use the old version or switch to new?
   1. Answer: switch to new

3. **Memory transparency UX:** How granular should the "what's remembered" view be? Raw facts, or categorized summaries?
   1. Answer: Raw facts

4. **Push notification content:** What triggers a push? Just weekly reviews, or also nudges (morning/evening reminders)?
   1. Answer: weekly reviews and also nudges


---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Entry** | A single journaling session (notebook or guided) |
| **Message** | A single piece of content within an entry (user text, AI response, question) |
| **Artifact** | A structured output from a session (if-then plan, todo list, insight, etc.) |
| **Protocol** | The script/flow for a guided session mode |
| **Router** | The LLM component that classifies intent and generates contextual questions |
| **Specialist** | The LLM component that runs guided session protocols |
| **Open Loop** | A worry, goal, or anticipated event flagged for follow-up |
| **Meaning-making** | Language patterns (because, realize, understand) associated with better journaling outcomes |

## Appendix B: Agentic development directives

**The coding agent MUST have access to:**

1. Deterministic test execution with structured output
2. A reproducible local runtime environment
3. Strict static type checking
4. Linting that encodes architectural constraints
5. Structured, machine-readable logs
6. Full stack traces with source mapping
7. Deterministic mocks for external APIs
8. Runtime assertions for invariants
9. Ability to replay failing executions
10. Codebase-wide search and navigation

The coding agent should implement these or ask the user if these are not available. 
