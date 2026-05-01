import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectRecord } from "./types.js";
import type { VesperDb } from "./db.js";
import type { VesperProjectConfig } from "./config.js";

const exec = promisify(execFile);

export function assessProjectReadiness(projectPath: string, gitRequired: boolean): ProjectRecord["readiness"] {
  if (!existsSync(projectPath)) return "missing_path";
  if (gitRequired && !existsSync(path.join(projectPath, ".git"))) return "needs_git";
  if (!existsSync(path.join(projectPath, "AGENTS.md")) && !existsSync(path.join(projectPath, "CLAUDE.md"))) {
    return "needs_agents";
  }
  return "ready";
}

export function syncConfiguredProjects(db: VesperDb, projects: VesperProjectConfig[]): ProjectRecord[] {
  return projects.map((project) => db.upsertProject({
    name: project.name,
    slug: project.slug,
    path: path.resolve(project.path),
    worktreeRoot: project.worktreeRoot ? path.resolve(project.worktreeRoot) : null,
    buildCommand: project.buildCommand,
    testCommand: project.testCommand,
    profile: project.profile,
    gitRequired: project.gitRequired,
    readiness: assessProjectReadiness(path.resolve(project.path), project.gitRequired),
  }));
}

export async function createWorktree(project: ProjectRecord, todoId: string, title: string): Promise<{ worktreePath: string; branchName: string }> {
  if (!project.worktreeRoot) {
    return { worktreePath: project.path, branchName: "local-direct" };
  }

  const baseRef = await resolveBaseRef(project.path);
  const branchName = `vesper/${todoId}/${slugify(title)}`;
  const worktreePath = path.join(project.worktreeRoot, branchName.replace(/\//g, "-"));

  if (existsSync(worktreePath)) {
    return { worktreePath, branchName };
  }

  await exec("git", ["worktree", "add", worktreePath, "-b", branchName, baseRef], { cwd: project.path });
  return { worktreePath, branchName };
}

async function resolveBaseRef(repoPath: string): Promise<string> {
  await exec("git", ["fetch", "origin"], { cwd: repoPath }).catch(() => undefined);
  for (const candidate of ["origin/main", "origin/master", "main", "master", "HEAD"]) {
    try {
      await exec("git", ["rev-parse", "--verify", candidate], { cwd: repoPath });
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to resolve a base ref for ${repoPath}`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "work";
}
