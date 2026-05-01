import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  AgentPhase,
  AgentRunRecord,
  AgentRunStatus,
  ApprovalRecord,
  ApprovalStatus,
  ArtifactRecord,
  ArtifactType,
  AutonomyMode,
  MemoryRecord,
  MemoryType,
  ProjectRecord,
  TodoRecord,
  TodoStatus,
} from "./types.js";

export const newId = (prefix: string) => `${prefix}_${nanoid(12)}`;
const now = () => Math.floor(Date.now() / 1000);

export class VesperDb {
  readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  upsertProject(input: Omit<ProjectRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): ProjectRecord {
    const existing = this.getProjectBySlug(input.slug);
    const ts = now();
    const id = existing?.id ?? input.id ?? newId("proj");
    this.db.prepare(`
      INSERT INTO projects (
        id, name, slug, path, worktree_root, build_command, test_command, profile,
        git_required, readiness, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        worktree_root = excluded.worktree_root,
        build_command = excluded.build_command,
        test_command = excluded.test_command,
        profile = excluded.profile,
        git_required = excluded.git_required,
        readiness = excluded.readiness,
        updated_at = excluded.updated_at
    `).run(
      id,
      input.name,
      input.slug,
      input.path,
      input.worktreeRoot,
      input.buildCommand,
      input.testCommand,
      input.profile,
      input.gitRequired ? 1 : 0,
      input.readiness,
      existing?.createdAt ?? ts,
      ts,
    );
    return this.getProject(id) ?? raise(`Failed to upsert project ${input.slug}`);
  }

  listProjects(): ProjectRecord[] {
    return (this.db.prepare("SELECT * FROM projects ORDER BY name ASC").all() as Row[]).map(rowToProject);
  }

  getProject(id: string): ProjectRecord | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToProject(row) : null;
  }

  getProjectBySlug(slug: string): ProjectRecord | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as Row | undefined;
    return row ? rowToProject(row) : null;
  }

  createTodo(input: {
    projectId: string;
    title: string;
    body?: string;
    priority?: string;
    tags?: string[];
    autonomyMode?: AutonomyMode;
    createdBy: string;
  }): TodoRecord {
    const id = newId("todo");
    const ts = now();
    this.db.prepare(`
      INSERT INTO todos (
        id, project_id, title, body, status, priority, tags, autonomy_mode,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.title,
      input.body ?? "",
      "open",
      input.priority ?? "normal",
      JSON.stringify(input.tags ?? []),
      input.autonomyMode ?? "plan-gated",
      input.createdBy,
      ts,
      ts,
    );
    return this.getTodo(id) ?? raise(`Failed to create todo ${id}`);
  }

  listTodos(projectId?: string, statuses?: TodoStatus[]): TodoRecord[] {
    const params: unknown[] = [];
    let sql = "SELECT * FROM todos WHERE 1 = 1";
    if (projectId) {
      sql += " AND project_id = ?";
      params.push(projectId);
    }
    if (statuses?.length) {
      sql += ` AND status IN (${statuses.map(() => "?").join(", ")})`;
      params.push(...statuses);
    }
    sql += " ORDER BY created_at DESC";
    return (this.db.prepare(sql).all(...params) as Row[]).map(rowToTodo);
  }

  getTodo(id: string): TodoRecord | null {
    const row = this.db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToTodo(row) : null;
  }

  updateTodo(id: string, updates: Partial<Pick<TodoRecord, "status" | "title" | "body" | "priority" | "tags" | "autonomyMode">>): TodoRecord | null {
    const current = this.getTodo(id);
    if (!current) return null;
    const next = { ...current, ...updates, updatedAt: now() };
    this.db.prepare(`
      UPDATE todos SET
        title = ?, body = ?, status = ?, priority = ?, tags = ?, autonomy_mode = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.title,
      next.body,
      next.status,
      next.priority,
      JSON.stringify(next.tags),
      next.autonomyMode,
      next.updatedAt,
      id,
    );
    return this.getTodo(id);
  }

  createRun(input: {
    todoId?: string | null;
    projectId: string;
    requestedBy: string;
    autonomyMode: AutonomyMode;
    discordChannelId?: string | null;
    discordThreadId?: string | null;
    worktreePath?: string | null;
    branchName?: string | null;
  }): AgentRunRecord {
    const id = newId("run");
    const ts = now();
    this.db.prepare(`
      INSERT INTO agent_runs (
        id, todo_id, project_id, requested_by, autonomy_mode, discord_channel_id,
        discord_thread_id, codex_session_id, worktree_path, branch_name, status,
        phase, pr_url, summary, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.todoId ?? null,
      input.projectId,
      input.requestedBy,
      input.autonomyMode,
      input.discordChannelId ?? null,
      input.discordThreadId ?? null,
      null,
      input.worktreePath ?? null,
      input.branchName ?? null,
      "queued",
      "idle",
      null,
      "",
      ts,
      ts,
      null,
    );
    return this.getRun(id) ?? raise(`Failed to create run ${id}`);
  }

  getRun(id: string): AgentRunRecord | null {
    const row = this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToRun(row) : null;
  }

  listRuns(statuses?: AgentRunStatus[]): AgentRunRecord[] {
    const params: unknown[] = [];
    let sql = "SELECT * FROM agent_runs";
    if (statuses?.length) {
      sql += ` WHERE status IN (${statuses.map(() => "?").join(", ")})`;
      params.push(...statuses);
    }
    sql += " ORDER BY created_at DESC";
    return (this.db.prepare(sql).all(...params) as Row[]).map(rowToRun);
  }

  updateRun(id: string, updates: Partial<{
    status: AgentRunStatus;
    phase: AgentPhase;
    discordThreadId: string | null;
    codexSessionId: string | null;
    worktreePath: string | null;
    branchName: string | null;
    prUrl: string | null;
    summary: string;
    completedAt: number | null;
  }>): AgentRunRecord | null {
    const current = this.getRun(id);
    if (!current) return null;
    const next = {
      ...current,
      ...updates,
      updatedAt: now(),
    };
    this.db.prepare(`
      UPDATE agent_runs SET
        status = ?, phase = ?, discord_thread_id = ?, codex_session_id = ?,
        worktree_path = ?, branch_name = ?, pr_url = ?, summary = ?,
        updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      next.status,
      next.phase,
      next.discordThreadId,
      next.codexSessionId,
      next.worktreePath,
      next.branchName,
      next.prUrl,
      next.summary,
      next.updatedAt,
      next.completedAt,
      id,
    );
    return this.getRun(id);
  }

  createArtifact(input: {
    runId: string;
    projectId: string;
    type: ArtifactType;
    location: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): ArtifactRecord {
    const id = newId("art");
    const ts = now();
    this.db.prepare(`
      INSERT INTO artifacts (id, run_id, project_id, type, location, summary, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.runId,
      input.projectId,
      input.type,
      input.location,
      input.summary ?? "",
      JSON.stringify(input.metadata ?? {}),
      ts,
    );
    return this.getArtifact(id) ?? raise(`Failed to create artifact ${id}`);
  }

  getArtifact(id: string): ArtifactRecord | null {
    const row = this.db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToArtifact(row) : null;
  }

  listArtifacts(runId: string): ArtifactRecord[] {
    return (this.db.prepare("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at ASC").all(runId) as Row[]).map(rowToArtifact);
  }

  createMemory(input: {
    projectId: string;
    type: MemoryType;
    title: string;
    content: string;
    tags?: string[];
    confidence?: number;
    evidenceArtifactIds?: string[];
  }): MemoryRecord {
    const id = newId("mem");
    const ts = now();
    this.db.prepare(`
      INSERT INTO memories (
        id, project_id, type, title, content, tags, confidence,
        evidence_artifact_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.type,
      input.title,
      input.content,
      JSON.stringify(input.tags ?? []),
      input.confidence ?? 0.5,
      JSON.stringify(input.evidenceArtifactIds ?? []),
      ts,
      ts,
    );
    return this.getMemory(id) ?? raise(`Failed to create memory ${id}`);
  }

  getMemory(id: string): MemoryRecord | null {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToMemory(row) : null;
  }

  searchMemory(projectId: string, query: string, limit = 8): MemoryRecord[] {
    const tokens = query.toLowerCase().split(/[^a-z0-9_]+/).filter((part) => part.length >= 3);
    const memories = (this.db.prepare("SELECT * FROM memories WHERE project_id = ? ORDER BY updated_at DESC").all(projectId) as Row[]).map(rowToMemory);
    return memories
      .map((memory) => ({
        memory,
        score: tokens.reduce((score, token) => {
          const haystack = `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase();
          return score + (haystack.includes(token) ? 1 : 0);
        }, 0),
      }))
      .filter((item) => item.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  deleteMemory(id: string): boolean {
    return this.db.prepare("DELETE FROM memories WHERE id = ?").run(id).changes > 0;
  }

  createApproval(input: {
    runId: string;
    projectId: string;
    commandHash: string;
    command: string;
    cwd: string;
    resolvedTargets: string[];
    requiredApprovals: number;
    createdBy: string;
    expiresAt: number;
  }): ApprovalRecord {
    const id = newId("apr");
    const ts = now();
    this.db.prepare(`
      INSERT INTO approvals (
        id, run_id, project_id, command_hash, command, cwd, resolved_targets,
        required_approvals, approvals, status, created_by, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.runId,
      input.projectId,
      input.commandHash,
      input.command,
      input.cwd,
      JSON.stringify(input.resolvedTargets),
      input.requiredApprovals,
      JSON.stringify([]),
      "pending",
      input.createdBy,
      input.expiresAt,
      ts,
      ts,
    );
    return this.getApproval(id) ?? raise(`Failed to create approval ${id}`);
  }

  getApproval(id: string): ApprovalRecord | null {
    const row = this.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Row | undefined;
    return row ? rowToApproval(row) : null;
  }

  updateApproval(id: string, updates: Partial<{ status: ApprovalStatus; approvals: string[] }>): ApprovalRecord | null {
    const current = this.getApproval(id);
    if (!current) return null;
    const next = { ...current, ...updates, updatedAt: now() };
    this.db.prepare("UPDATE approvals SET status = ?, approvals = ?, updated_at = ? WHERE id = ?")
      .run(next.status, JSON.stringify(next.approvals), next.updatedAt, id);
    return this.getApproval(id);
  }

  appendAudit(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.db.prepare(`
      INSERT INTO audit_log (id, actor_id, action, target_type, target_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId("audit"),
      input.actorId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
      now(),
    );
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    worktree_root TEXT,
    build_command TEXT NOT NULL DEFAULT '',
    test_command TEXT NOT NULL DEFAULT '',
    profile TEXT NOT NULL DEFAULT 'generic',
    git_required INTEGER NOT NULL DEFAULT 1,
    readiness TEXT NOT NULL DEFAULT 'ready',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    tags TEXT NOT NULL DEFAULT '[]',
    autonomy_mode TEXT NOT NULL DEFAULT 'plan-gated',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_todos_project_status ON todos(project_id, status);

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    todo_id TEXT REFERENCES todos(id) ON DELETE SET NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL,
    autonomy_mode TEXT NOT NULL,
    discord_channel_id TEXT,
    discord_thread_id TEXT,
    codex_session_id TEXT,
    worktree_path TEXT,
    branch_name TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    phase TEXT NOT NULL DEFAULT 'idle',
    pr_url TEXT,
    summary TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id, created_at);

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0.5,
    evidence_artifact_ids TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, type);

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    command_hash TEXT NOT NULL,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL,
    resolved_targets TEXT NOT NULL DEFAULT '[]',
    required_approvals INTEGER NOT NULL,
    approvals TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    created_by TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
`;

type Row = Record<string, unknown>;

function rowToProject(row: Row): ProjectRecord {
  return {
    id: string(row.id),
    name: string(row.name),
    slug: string(row.slug),
    path: string(row.path),
    worktreeRoot: nullableString(row.worktree_root),
    buildCommand: string(row.build_command),
    testCommand: string(row.test_command),
    profile: string(row.profile),
    gitRequired: Boolean(row.git_required),
    readiness: string(row.readiness) as ProjectRecord["readiness"],
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
  };
}

function rowToTodo(row: Row): TodoRecord {
  return {
    id: string(row.id),
    projectId: string(row.project_id),
    title: string(row.title),
    body: string(row.body),
    status: string(row.status) as TodoStatus,
    priority: string(row.priority),
    tags: json<string[]>(row.tags, []),
    autonomyMode: string(row.autonomy_mode) as AutonomyMode,
    createdBy: string(row.created_by),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
  };
}

function rowToRun(row: Row): AgentRunRecord {
  return {
    id: string(row.id),
    todoId: nullableString(row.todo_id),
    projectId: string(row.project_id),
    requestedBy: string(row.requested_by),
    autonomyMode: string(row.autonomy_mode) as AutonomyMode,
    discordChannelId: nullableString(row.discord_channel_id),
    discordThreadId: nullableString(row.discord_thread_id),
    codexSessionId: nullableString(row.codex_session_id),
    worktreePath: nullableString(row.worktree_path),
    branchName: nullableString(row.branch_name),
    status: string(row.status) as AgentRunStatus,
    phase: string(row.phase) as AgentPhase,
    prUrl: nullableString(row.pr_url),
    summary: string(row.summary),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
    completedAt: nullableNumber(row.completed_at),
  };
}

function rowToArtifact(row: Row): ArtifactRecord {
  return {
    id: string(row.id),
    runId: string(row.run_id),
    projectId: string(row.project_id),
    type: string(row.type) as ArtifactType,
    location: string(row.location),
    summary: string(row.summary),
    metadata: json<Record<string, unknown>>(row.metadata, {}),
    createdAt: number(row.created_at),
  };
}

function rowToMemory(row: Row): MemoryRecord {
  return {
    id: string(row.id),
    projectId: string(row.project_id),
    type: string(row.type) as MemoryType,
    title: string(row.title),
    content: string(row.content),
    tags: json<string[]>(row.tags, []),
    confidence: number(row.confidence),
    evidenceArtifactIds: json<string[]>(row.evidence_artifact_ids, []),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
  };
}

function rowToApproval(row: Row): ApprovalRecord {
  return {
    id: string(row.id),
    runId: string(row.run_id),
    projectId: string(row.project_id),
    commandHash: string(row.command_hash),
    command: string(row.command),
    cwd: string(row.cwd),
    resolvedTargets: json<string[]>(row.resolved_targets, []),
    requiredApprovals: number(row.required_approvals),
    approvals: json<string[]>(row.approvals, []),
    status: string(row.status) as ApprovalStatus,
    createdBy: string(row.created_by),
    expiresAt: number(row.expires_at),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
  };
}

function string(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : string(value);
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value);
}

function json<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(string(value)) as T;
  } catch {
    return fallback;
  }
}

function raise(message: string): never {
  throw new Error(message);
}
