import { EventEmitter } from "node:events";
import path from "node:path";
import type { VesperConfig } from "./config.js";
import { VesperDb } from "./db.js";
import { ArtifactStore } from "./artifacts.js";
import { CodexRunner } from "./codex.js";
import { assessCommandSafety } from "./safety.js";
import { buildApprovalPrompt, buildRunPrompt } from "./prompts.js";
import { buildMemoryBundle, buildRetrospective } from "./memory.js";
import { createWorktree, syncConfiguredProjects } from "./projects.js";
import type {
  AgentRunRecord,
  ArtifactRecord,
  AutonomyMode,
  CodexStreamEvent,
  ProjectRecord,
  TodoRecord,
} from "./types.js";

export type VesperEvent =
  | { type: "run_created"; run: AgentRunRecord; todo: TodoRecord | null; project: ProjectRecord }
  | { type: "run_updated"; run: AgentRunRecord }
  | { type: "run_event"; run: AgentRunRecord; event: CodexStreamEvent }
  | { type: "artifact_created"; run: AgentRunRecord; artifact: ArtifactRecord }
  | { type: "run_blocked"; run: AgentRunRecord; reason: string }
  | { type: "run_completed"; run: AgentRunRecord };

export class VesperCore extends EventEmitter {
  readonly db: VesperDb;
  readonly artifacts: ArtifactStore;
  readonly codex: CodexRunner;
  private readonly activeKills = new Map<string, () => void>();

  constructor(readonly config: VesperConfig) {
    super();
    this.db = new VesperDb(config.databasePath);
    this.artifacts = new ArtifactStore(config.artifactRoot, this.db);
    this.codex = new CodexRunner();
    syncConfiguredProjects(this.db, config.projects);
  }

  onEvent(handler: (event: VesperEvent) => void): () => void {
    this.on("event", handler);
    return () => this.off("event", handler);
  }

  listProjects(): ProjectRecord[] {
    return this.db.listProjects();
  }

  createTodo(input: {
    projectSlug: string;
    title: string;
    body?: string;
    priority?: string;
    tags?: string[];
    autonomyMode?: AutonomyMode;
    createdBy: string;
  }): TodoRecord {
    const project = this.db.getProjectBySlug(input.projectSlug) ?? raise(`Unknown project: ${input.projectSlug}`);
    return this.db.createTodo({
      projectId: project.id,
      title: input.title,
      body: input.body,
      priority: input.priority,
      tags: input.tags,
      autonomyMode: input.autonomyMode,
      createdBy: input.createdBy,
    });
  }

  listTodos(projectSlug?: string): TodoRecord[] {
    const project = projectSlug ? this.db.getProjectBySlug(projectSlug) : null;
    return this.db.listTodos(project?.id, ["open", "picked", "running", "blocked"]);
  }

  async startTodo(input: {
    todoId: string;
    requestedBy: string;
    discordChannelId?: string | null;
    discordThreadId?: string | null;
    autonomyMode?: AutonomyMode;
  }): Promise<AgentRunRecord> {
    const todo = this.db.getTodo(input.todoId) ?? raise(`Unknown todo: ${input.todoId}`);
    const project = this.db.getProject(todo.projectId) ?? raise(`Unknown project: ${todo.projectId}`);
    this.assertProjectCanRun(project, input.autonomyMode ?? todo.autonomyMode);

    const run = this.db.createRun({
      todoId: todo.id,
      projectId: project.id,
      requestedBy: input.requestedBy,
      autonomyMode: input.autonomyMode ?? todo.autonomyMode,
      discordChannelId: input.discordChannelId,
      discordThreadId: input.discordThreadId,
    });
    this.db.updateTodo(todo.id, { status: "picked", autonomyMode: run.autonomyMode });
    this.publish({ type: "run_created", run, todo, project });
    void this.prepareAndRun(run.id).catch((err) => this.failRun(run.id, err));
    return run;
  }

  async spawnAdhoc(input: {
    projectSlug: string;
    prompt: string;
    requestedBy: string;
    autonomyMode: AutonomyMode;
    discordChannelId?: string | null;
    discordThreadId?: string | null;
  }): Promise<AgentRunRecord> {
    const project = this.db.getProjectBySlug(input.projectSlug) ?? raise(`Unknown project: ${input.projectSlug}`);
    this.assertProjectCanRun(project, input.autonomyMode);
    const todo = this.db.createTodo({
      projectId: project.id,
      title: input.prompt.slice(0, 80),
      body: input.prompt,
      autonomyMode: input.autonomyMode,
      createdBy: input.requestedBy,
      tags: ["ad-hoc"],
    });
    return this.startTodo({
      todoId: todo.id,
      requestedBy: input.requestedBy,
      discordChannelId: input.discordChannelId,
      discordThreadId: input.discordThreadId,
      autonomyMode: input.autonomyMode,
    });
  }

  async approveRun(input: { runId: string; approverId: string; feedback?: string }): Promise<AgentRunRecord> {
    const run = this.db.getRun(input.runId) ?? raise(`Unknown run: ${input.runId}`);
    if (run.status !== "awaiting_approval" && run.status !== "blocked") {
      throw new Error(`Run ${run.id} is not waiting for approval.`);
    }
    const updated = this.db.updateRun(run.id, { status: "running", phase: "implementing" }) ?? run;
    this.db.appendAudit({
      actorId: input.approverId,
      action: "run.approve",
      targetType: "agent_run",
      targetId: run.id,
      metadata: { feedback: input.feedback ?? "" },
    });
    this.publish({ type: "run_updated", run: updated });
    void this.executeRun(updated.id, input.feedback, true).catch((err) => this.failRun(updated.id, err));
    return updated;
  }

  cancelRun(runId: string, actorId: string): AgentRunRecord {
    this.activeKills.get(runId)?.();
    this.activeKills.delete(runId);
    const run = this.db.updateRun(runId, {
      status: "cancelled",
      phase: "idle",
      completedAt: Math.floor(Date.now() / 1000),
    }) ?? raise(`Unknown run: ${runId}`);
    this.db.appendAudit({ actorId, action: "run.cancel", targetType: "agent_run", targetId: runId });
    this.publish({ type: "run_updated", run });
    return run;
  }

  private async prepareAndRun(runId: string): Promise<void> {
    const run = this.db.getRun(runId) ?? raise(`Unknown run: ${runId}`);
    const project = this.db.getProject(run.projectId) ?? raise(`Unknown project: ${run.projectId}`);
    const todo = run.todoId ? this.db.getTodo(run.todoId) : null;
    const worktree = await createWorktree(project, todo?.id ?? run.id, todo?.title ?? "ad-hoc");
    const prepared = this.db.updateRun(run.id, {
      worktreePath: worktree.worktreePath,
      branchName: worktree.branchName,
      status: run.autonomyMode === "plan-gated" ? "planning" : "running",
      phase: run.autonomyMode === "plan-gated" ? "planning" : "implementing",
    }) ?? run;
    if (todo) this.db.updateTodo(todo.id, { status: "running" });
    this.publish({ type: "run_updated", run: prepared });
    await this.executeRun(prepared.id);
  }

  private async executeRun(runId: string, feedback?: string, approved = false): Promise<void> {
    const run = this.db.getRun(runId) ?? raise(`Unknown run: ${runId}`);
    const project = this.db.getProject(run.projectId) ?? raise(`Unknown project: ${run.projectId}`);
    const todo = run.todoId ? this.db.getTodo(run.todoId) : null;
    const cwd = run.worktreePath ?? project.path;
    const memoryBundle = buildMemoryBundle(this.db, { project, todo, run });
    const prompt = approved
      ? buildApprovalPrompt({ project, todo, run, feedback, memoryBundle })
      : buildRunPrompt({ project, todo, run, feedback, memoryBundle });

    const logLines: string[] = [];
    const handle = this.codex.run({
      prompt,
      cwd,
      resumeSessionId: approved ? run.codexSessionId : null,
      options: this.config.codex,
      onCommand: (command) => {
        const decision = assessCommandSafety({
          command,
          cwd,
          project,
          artifactRoot: this.config.artifactRoot,
          databasePath: this.config.databasePath,
        });
        if (decision.action === "allow") return "allow";

        const safety = this.artifacts.writeText({
          runId: run.id,
          projectId: project.id,
          type: "safety_event",
          name: `safety-${Date.now()}.md`,
          content: [
            `# Safety ${decision.action}`,
            "",
            `Reason: ${decision.reason}`,
            `Command hash: ${decision.commandHash}`,
            `Command: ${command}`,
            `CWD: ${cwd}`,
            "",
            "Resolved targets:",
            ...(decision.resolvedTargets.length ? decision.resolvedTargets.map((target) => `- ${target}`) : ["- none"]),
          ].join("\n"),
          summary: decision.reason,
          metadata: decision,
        });
        this.publish({ type: "artifact_created", run, artifact: safety });

        if (decision.action === "approval_required") {
          const approval = this.db.createApproval({
            runId: run.id,
            projectId: project.id,
            commandHash: decision.commandHash,
            command,
            cwd,
            resolvedTargets: decision.resolvedTargets,
            requiredApprovals: decision.requiredApprovals,
            createdBy: run.requestedBy,
            expiresAt: Math.floor(Date.now() / 1000) + 15 * 60,
          });
          this.db.appendAudit({
            actorId: "vesper",
            action: "approval.request",
            targetType: "approval",
            targetId: approval.id,
            metadata: { runId: run.id, commandHash: approval.commandHash },
          });
        }

        const blocked = this.db.updateRun(run.id, { status: "blocked", phase: "blocked", summary: decision.reason }) ?? run;
        this.publish({ type: "run_blocked", run: blocked, reason: decision.reason });
        return "stop";
      },
      onEvent: (event) => {
        logLines.push(formatStreamEvent(event));
        const latest = this.db.getRun(run.id) ?? run;
        this.publish({ type: "run_event", run: latest, event });
      },
    });
    this.activeKills.set(run.id, handle.kill);

    try {
      const result = await handle.promise;
      this.activeKills.delete(run.id);
      const prUrl = extractPrUrl(result.result);
      const nextStatus = run.autonomyMode === "plan-gated" && !approved ? "awaiting_approval" : "completed";
      const nextPhase = nextStatus === "awaiting_approval" ? "awaiting_approval" : "idle";
      const updated = this.db.updateRun(run.id, {
        status: nextStatus,
        phase: nextPhase,
        codexSessionId: result.sessionId,
        prUrl,
        summary: result.result.slice(0, 1000),
        completedAt: nextStatus === "completed" ? Math.floor(Date.now() / 1000) : null,
      }) ?? run;

      const logArtifact = this.artifacts.writeText({
        runId: run.id,
        projectId: project.id,
        type: nextStatus === "awaiting_approval" ? "plan" : "log",
        name: nextStatus === "awaiting_approval" ? "plan.md" : "codex-log.md",
        content: `${logLines.join("\n")}\n\n# Final Result\n\n${result.result}`,
        summary: nextStatus === "awaiting_approval" ? "Plan generated; awaiting approval." : "Codex run completed.",
      });
      this.publish({ type: "artifact_created", run: updated, artifact: logArtifact });

      if (nextStatus === "completed") {
        if (todo) this.db.updateTodo(todo.id, { status: "done" });
        const retrospective = this.artifacts.writeText({
          runId: run.id,
          projectId: project.id,
          type: "retrospective",
          name: "retrospective.md",
          content: buildRetrospective({ project, todo, run: updated, result: result.result }),
          summary: "Run retrospective.",
        });
        this.publish({ type: "artifact_created", run: updated, artifact: retrospective });
        this.publish({ type: "run_completed", run: updated });
      } else {
        this.publish({ type: "run_updated", run: updated });
      }
    } catch (err) {
      this.activeKills.delete(run.id);
      throw err;
    }
  }

  private failRun(runId: string, err: unknown): void {
    const run = this.db.getRun(runId);
    if (!run) return;
    const message = err instanceof Error ? err.message : String(err);
    const failed = this.db.updateRun(run.id, {
      status: "failed",
      phase: "blocked",
      summary: message,
      completedAt: Math.floor(Date.now() / 1000),
    }) ?? run;
    if (run.todoId) this.db.updateTodo(run.todoId, { status: "blocked" });
    const artifact = this.artifacts.writeText({
      runId: run.id,
      projectId: run.projectId,
      type: "log",
      name: "failure.md",
      content: `# Failure\n\n${message}\n`,
      summary: message,
    });
    this.publish({ type: "artifact_created", run: failed, artifact });
    this.publish({ type: "run_blocked", run: failed, reason: message });
  }

  private assertProjectCanRun(project: ProjectRecord, mode: AutonomyMode): void {
    if (project.readiness === "missing_path") throw new Error(`Project path does not exist: ${project.path}`);
    if (project.readiness === "needs_git") throw new Error(`Project ${project.slug} needs git before Vesper can run agents.`);
    if (project.readiness === "needs_agents" && mode === "automatic") {
      throw new Error(`Project ${project.slug} needs AGENTS.md/CLAUDE.md before automatic mode is allowed.`);
    }
    if (this.config.runtimeMode === "local-dev" && mode === "automatic") {
      throw new Error("Automatic mode is disabled in local-dev mode. Use VM mode for autonomous agents.");
    }
  }

  private publish(event: VesperEvent): void {
    this.emit("event", event);
  }
}

function formatStreamEvent(event: CodexStreamEvent): string {
  if (event.kind === "text") return event.text ?? "";
  if (event.kind === "tool_use") return `> ${event.summary ?? event.tool ?? "tool"}`;
  if (event.kind === "tool_result") return event.text ? `\n${event.text}\n` : "> tool completed";
  if (event.kind === "error") return `ERROR: ${event.text ?? ""}`;
  return "";
}

function extractPrUrl(text: string): string | null {
  return text.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/)?.[0] ?? null;
}

function raise(message: string): never {
  throw new Error(message);
}
