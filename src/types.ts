export type RuntimeMode = "vm" | "local-dev";

export type AutonomyMode = "plan-gated" | "automatic";

export type TodoStatus = "open" | "picked" | "running" | "blocked" | "done" | "cancelled";

export type AgentRunStatus =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentPhase =
  | "idle"
  | "planning"
  | "implementing"
  | "building"
  | "testing"
  | "reviewing"
  | "creating_pr"
  | "awaiting_approval"
  | "blocked";

export type ArtifactType =
  | "plan"
  | "log"
  | "summary"
  | "test_result"
  | "review"
  | "pr_body"
  | "retrospective"
  | "safety_event"
  | "evaluation";

export type MemoryType = "procedural" | "semantic" | "episodic" | "artifact";

export type UserRole = "viewer" | "requester" | "operator" | "approver" | "owner";

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  path: string;
  worktreeRoot: string | null;
  buildCommand: string;
  testCommand: string;
  profile: string;
  gitRequired: boolean;
  readiness: "ready" | "needs_git" | "needs_agents" | "missing_path";
  createdAt: number;
  updatedAt: number;
}

export interface TodoRecord {
  id: string;
  projectId: string;
  title: string;
  body: string;
  status: TodoStatus;
  priority: string;
  tags: string[];
  autonomyMode: AutonomyMode;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentRunRecord {
  id: string;
  todoId: string | null;
  projectId: string;
  requestedBy: string;
  autonomyMode: AutonomyMode;
  discordChannelId: string | null;
  discordThreadId: string | null;
  codexSessionId: string | null;
  worktreePath: string | null;
  branchName: string | null;
  status: AgentRunStatus;
  phase: AgentPhase;
  prUrl: string | null;
  summary: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  projectId: string;
  type: ArtifactType;
  location: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface MemoryRecord {
  id: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  evidenceArtifactIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  projectId: string;
  commandHash: string;
  command: string;
  cwd: string;
  resolvedTargets: string[];
  requiredApprovals: number;
  approvals: string[];
  status: ApprovalStatus;
  createdBy: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CodexStreamEvent {
  kind: "text" | "thinking" | "tool_use" | "tool_result" | "error";
  text?: string;
  tool?: string;
  summary?: string;
  input?: Record<string, unknown>;
}

export interface CodexRunResult {
  sessionId: string | null;
  result: string;
  exitCode: number;
}
