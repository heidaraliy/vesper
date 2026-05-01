import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const runtimeModeSchema = z.enum(["vm", "local-dev"]);

const projectConfigSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  path: z.string().min(1),
  worktreeRoot: z.string().min(1).nullable().optional(),
  buildCommand: z.string().default(""),
  testCommand: z.string().default(""),
  profile: z.string().default("generic"),
  gitRequired: z.boolean().default(true),
});

const configSchema = z.object({
  runtimeMode: runtimeModeSchema.default("vm"),
  databasePath: z.string().default("./data/vesper.db"),
  artifactRoot: z.string().default("./data/artifacts"),
  codex: z.object({
    model: z.string().nullable().default(null),
    reasoning: z.enum(["low", "medium", "high", "max"]).default("high"),
    sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).default("workspace-write"),
    approvalPolicy: z.enum(["untrusted", "on-request", "never"]).default("never"),
  }).default({}),
  discord: z.object({
    token: z.string().optional(),
    clientId: z.string().optional(),
    guildId: z.string().optional(),
    ownerIds: z.array(z.string()).default([]),
  }).default({}),
  projects: z.array(projectConfigSchema).default([]),
});

export type VesperConfig = z.infer<typeof configSchema>;
export type VesperProjectConfig = z.infer<typeof projectConfigSchema>;

export function loadConfig(configPath = process.env.VESPER_CONFIG ?? "./vesper.config.json"): VesperConfig {
  const resolved = path.resolve(configPath);
  const raw = existsSync(resolved) ? JSON.parse(readFileSync(resolved, "utf8")) as unknown : {};
  const expanded = expandEnv(raw);
  const parsed = configSchema.parse(expanded);

  return {
    ...parsed,
    databasePath: path.resolve(process.env.VESPER_DB ?? parsed.databasePath),
    artifactRoot: path.resolve(process.env.VESPER_ARTIFACT_ROOT ?? parsed.artifactRoot),
    discord: {
      ...parsed.discord,
      token: process.env.DISCORD_TOKEN ?? parsed.discord.token,
      clientId: process.env.DISCORD_CLIENT_ID ?? parsed.discord.clientId,
      guildId: process.env.DISCORD_GUILD_ID ?? parsed.discord.guildId,
      ownerIds: mergeOwnerIds(parsed.discord.ownerIds),
    },
  };
}

function mergeOwnerIds(configured: string[]): string[] {
  const fromEnv = (process.env.VESPER_OWNER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set([...configured, ...fromEnv]));
}

function expandEnv(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => process.env[name] ?? "");
  }
  if (Array.isArray(value)) return value.map(expandEnv);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, expandEnv(nested)]),
    );
  }
  return value;
}
