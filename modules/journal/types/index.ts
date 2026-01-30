export enum EntryMode {
  NOTEBOOK = 'notebook',
  PLAN = 'plan',
  REFLECT = 'reflect',
  SLEEP = 'sleep',
  LIFT = 'lift',
  CLARITY = 'clarity',
  UNPACK = 'unpack',
  CREATE = 'create',
}

export enum EntryStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum MessageType {
  TEXT = 'text',
  QUESTION = 'question',
  ARTIFACT = 'artifact',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  FAILED = 'failed',
}

export enum ArtifactType {
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

export enum ArtifactStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  EXPIRED = 'expired',
}

export enum EntityType {
  PERSON = 'person',
  PROJECT = 'project',
  TOPIC = 'topic',
  PLACE = 'place',
  CUSTOM = 'custom',
}

export interface EntryMetadata {
  mood?: MoodInference | null;
  sentiment?: number | null;
  topics?: string[];
  meaningMakingScore?: number;
}

export interface MoodInference {
  primary: string;
  intensity: number;
  secondary: string[];
}

export interface Entry {
  id: string;
  userId: string;
  mode: EntryMode;
  status: EntryStatus;
  metadata: EntryMetadata;
  syncStatus: SyncStatus;
  localId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface Message {
  id: string;
  entryId: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  toolData: Record<string, unknown> | null;
  syncStatus: SyncStatus;
  localId: string | null;
  createdAt: Date;
}

export interface Artifact {
  id: string;
  userId: string;
  entryId: string | null;
  type: ArtifactType;
  data: Record<string, unknown>;
  status: ArtifactStatus | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
