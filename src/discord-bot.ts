import {
  Client,
  Events,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
} from "discord.js";
import type {
  ChatInputCommandInteraction,
  GuildMember,
  TextBasedChannel,
} from "discord.js";
import type { VesperCore, VesperEvent } from "./core.js";
import { hasRole, rolesForMember } from "./permissions.js";
import { registerCommands } from "./discord-commands.js";
import type { AutonomyMode } from "./types.js";

export class VesperDiscordBot {
  private readonly client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });
  private readonly buffers = new Map<string, string[]>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly core: VesperCore,
    private readonly options: { token: string; clientId: string; guildId: string; ownerIds: string[] },
  ) {}

  async start(): Promise<void> {
    await registerCommands(this.options);
    this.core.onEvent((event) => void this.handleVesperEvent(event));
    this.client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      void this.handleCommand(interaction).catch((err) => this.safeReply(interaction, `Error: ${err instanceof Error ? err.message : String(err)}`));
    });
    this.flushTimer = setInterval(() => void this.flushAll(), 20_000);
    await this.client.login(this.options.token);
  }

  async stop(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushAll();
    this.client.destroy();
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const roles = rolesForMember(interaction.member instanceof Object ? interaction.member as GuildMember : null, {
      ownerIds: this.options.ownerIds,
    });

    if (interaction.commandName === "project") {
      await this.handleProject(interaction);
      return;
    }

    if (interaction.commandName === "todo") {
      if (!hasRole(roles, "requester")) throw new Error("You need the Vesper Requester role.");
      await this.handleTodo(interaction, hasRole(roles, "operator"));
      return;
    }

    if (interaction.commandName === "agent") {
      if (!hasRole(roles, "operator")) throw new Error("You need the Vesper Operator role.");
      await this.handleAgent(interaction, hasRole(roles, "approver"));
      return;
    }

    if (interaction.commandName === "memory") {
      if (!hasRole(roles, "operator")) throw new Error("You need the Vesper Operator role.");
      await this.handleMemory(interaction);
    }
  }

  private async handleProject(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "list") {
      const projects = this.core.listProjects();
      await interaction.reply({
        ephemeral: true,
        content: projects.length
          ? projects.map((p) => `- \`${p.slug}\` ${p.name}: ${p.readiness} (${p.path})`).join("\n")
          : "No projects configured.",
      });
      return;
    }

    const slug = interaction.options.getString("project", true);
    const project = this.core.listProjects().find((candidate) => candidate.slug === slug);
    await interaction.reply({
      ephemeral: true,
      content: project
        ? [
            `\`${project.slug}\` ${project.name}`,
            `Readiness: ${project.readiness}`,
            `Path: ${project.path}`,
            `Worktrees: ${project.worktreeRoot ?? "direct"}`,
            `Build: ${project.buildCommand || "not configured"}`,
            `Test: ${project.testCommand || "not configured"}`,
          ].join("\n")
        : `Unknown project: ${slug}`,
    });
  }

  private async handleTodo(interaction: ChatInputCommandInteraction, canOperate: boolean): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "add") {
      const todo = this.core.createTodo({
        projectSlug: interaction.options.getString("project", true),
        title: interaction.options.getString("title", true),
        body: interaction.options.getString("body") ?? "",
        autonomyMode: modeOption(interaction) ?? "plan-gated",
        createdBy: interaction.user.id,
      });
      await interaction.reply({ ephemeral: true, content: `Created todo \`${todo.id}\`: ${todo.title}` });
      return;
    }

    if (sub === "list") {
      const todos = this.core.listTodos(interaction.options.getString("project") ?? undefined);
      await interaction.reply({
        ephemeral: true,
        content: todos.length
          ? todos.slice(0, 20).map((todo) => `- \`${todo.id}\` [${todo.status}/${todo.autonomyMode}] ${todo.title}`).join("\n")
          : "No open todos.",
      });
      return;
    }

    if (!canOperate) throw new Error("Picking todos requires the Vesper Operator role.");
    const thread = await this.createRunThread(interaction, `vesper-${interaction.options.getString("todo", true).slice(0, 16)}`);
    const run = await this.core.startTodo({
      todoId: interaction.options.getString("todo", true),
      requestedBy: interaction.user.id,
      discordChannelId: interaction.channelId,
      discordThreadId: thread.id,
      autonomyMode: modeOption(interaction) ?? undefined,
    });
    await interaction.reply({ ephemeral: true, content: `Started run \`${run.id}\` in <#${thread.id}>.` });
  }

  private async handleAgent(interaction: ChatInputCommandInteraction, canApprove: boolean): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "spawn") {
      const mode = modeOption(interaction) ?? "plan-gated";
      const thread = await this.createRunThread(interaction, `vesper-${interaction.options.getString("project", true)}`);
      const run = await this.core.spawnAdhoc({
        projectSlug: interaction.options.getString("project", true),
        prompt: interaction.options.getString("prompt", true),
        autonomyMode: mode,
        requestedBy: interaction.user.id,
        discordChannelId: interaction.channelId,
        discordThreadId: thread.id,
      });
      await interaction.reply({ ephemeral: true, content: `Spawned run \`${run.id}\` in <#${thread.id}>.` });
      return;
    }

    if (sub === "approve") {
      if (!canApprove) throw new Error("Approving runs requires the Vesper Approver role.");
      const run = await this.core.approveRun({
        runId: interaction.options.getString("run", true),
        approverId: interaction.user.id,
        feedback: interaction.options.getString("feedback") ?? undefined,
      });
      await interaction.reply({ ephemeral: true, content: `Approved run \`${run.id}\`.` });
      return;
    }

    if (sub === "cancel") {
      const run = this.core.cancelRun(interaction.options.getString("run", true), interaction.user.id);
      await interaction.reply({ ephemeral: true, content: `Cancelled run \`${run.id}\`.` });
      return;
    }

    const runs = this.core.db.listRuns(["queued", "planning", "awaiting_approval", "running", "blocked"]);
    await interaction.reply({
      ephemeral: true,
      content: runs.length
        ? runs.map((run) => `- \`${run.id}\` [${run.status}/${run.phase}] <#${run.discordThreadId ?? interaction.channelId}> ${run.summary.slice(0, 80)}`).join("\n")
        : "No active runs.",
    });
  }

  private async handleMemory(interaction: ChatInputCommandInteraction): Promise<void> {
    const projectSlug = interaction.options.getString("project", true);
    const project = this.core.listProjects().find((candidate) => candidate.slug === projectSlug);
    if (!project) throw new Error(`Unknown project: ${projectSlug}`);

    if (interaction.options.getSubcommand() === "write") {
      const memory = this.core.db.createMemory({
        projectId: project.id,
        type: "procedural",
        title: interaction.options.getString("title", true),
        content: interaction.options.getString("content", true),
        confidence: 0.75,
      });
      await interaction.reply({ ephemeral: true, content: `Wrote memory \`${memory.id}\`.` });
      return;
    }

    const memories = this.core.db.searchMemory(project.id, interaction.options.getString("query", true));
    await interaction.reply({
      ephemeral: true,
      content: memories.length
        ? memories.map((memory) => `- \`${memory.id}\` [${memory.type}] ${memory.title}: ${memory.content.slice(0, 160)}`).join("\n")
        : "No matching memory.",
    });
  }

  private async createRunThread(interaction: ChatInputCommandInteraction, name: string): Promise<TextBasedChannel & { id: string }> {
    const channel = interaction.channel;
    if (channel && "threads" in channel) {
      const manager = channel.threads as { create(input: { name: string; autoArchiveDuration: ThreadAutoArchiveDuration; reason: string }): Promise<TextBasedChannel & { id: string }> };
      return manager.create({
        name: name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 90),
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: "Vesper agent run",
      });
    }
    throw new Error("Run commands must be used in a Discord text channel that supports threads.");
  }

  private async handleVesperEvent(event: VesperEvent): Promise<void> {
    const run = "run" in event ? event.run : null;
    if (!run?.discordThreadId) return;
    const channel = await this.client.channels.fetch(run.discordThreadId).catch(() => null);
    if (!channel?.isTextBased()) return;

    if (event.type === "run_event") {
      const text = formatEvent(event.event);
      if (!text) return;
      const buffer = this.buffers.get(run.id) ?? [];
      buffer.push(text);
      this.buffers.set(run.id, buffer);
      return;
    }

    await this.flushRun(run.id, channel);
    if (event.type === "run_created") {
      await sendTo(channel, `Started \`${run.id}\` for **${event.todo?.title ?? "ad hoc task"}** (${run.autonomyMode}).`);
    } else if (event.type === "artifact_created") {
      await sendTo(channel, `Artifact: \`${event.artifact.type}\` ${event.artifact.summary}`);
    } else if (event.type === "run_blocked") {
      await sendTo(channel, `<@${run.requestedBy}> Run \`${run.id}\` blocked: ${event.reason}`);
    } else if (event.type === "run_completed") {
      await sendTo(channel, `<@${run.requestedBy}> Run \`${run.id}\` completed.${run.prUrl ? ` PR: ${run.prUrl}` : ""}`);
    } else if (event.type === "run_updated" && run.status === "awaiting_approval") {
      await sendTo(channel, `<@${run.requestedBy}> Plan is ready. Use \`/agent approve run:${run.id}\` to continue.`);
    }
  }

  private async flushAll(): Promise<void> {
    for (const [runId] of this.buffers) {
      const run = this.core.db.getRun(runId);
      if (!run?.discordThreadId) continue;
      const channel = await this.client.channels.fetch(run.discordThreadId).catch(() => null);
      if (channel?.isTextBased()) await this.flushRun(runId, channel);
    }
  }

  private async flushRun(runId: string, channel: TextBasedChannel): Promise<void> {
    const buffer = this.buffers.get(runId);
    if (!buffer?.length) return;
    this.buffers.delete(runId);
    const text = buffer.join("\n").trim();
    if (!text) return;
    await sendTo(channel, text.length > 1900 ? `${text.slice(0, 1850)}\n...` : text);
  }

  private async safeReply(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ephemeral: true, content }).catch(() => undefined);
    } else {
      await interaction.reply({ ephemeral: true, content }).catch(() => undefined);
    }
  }
}

function modeOption(interaction: ChatInputCommandInteraction): AutonomyMode | null {
  const mode = interaction.options.getString("mode");
  return mode === "automatic" || mode === "plan-gated" ? mode : null;
}

function formatEvent(event: { kind: string; text?: string; summary?: string }): string {
  if (event.kind === "tool_use") return event.summary ? `> ${event.summary}` : "";
  if (event.kind === "error") return event.text ? `Error: ${event.text}` : "";
  if (event.kind === "text") return event.text?.trim() ?? "";
  return "";
}

async function sendTo(channel: TextBasedChannel, content: string): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;
  await channel.send(content);
}
