import crypto from "node:crypto";
import path from "node:path";
import type { ProjectRecord } from "./types.js";

export type SafetyDecision =
  | { action: "allow"; reason: string; commandHash: string; resolvedTargets: string[] }
  | { action: "deny"; reason: string; commandHash: string; resolvedTargets: string[] }
  | { action: "approval_required"; reason: string; commandHash: string; resolvedTargets: string[]; requiredApprovals: number };

const destructiveRegex = /\b(rm|trash|unlink|rmdir)\b/i;
const broadDestructiveRegex = /\brm\s+(?:-[^\s]*[rf][^\s]*|-[^\s]*[fr][^\s]*)\s+(.+)/i;
const secretRegex = /(\.env\b|id_rsa|id_ed25519|\.ssh|keychain|credentials|secret|token)/i;
const installPipeRegex = /(curl|wget)\b.*\|\s*(sh|bash|zsh)/i;

export function assessCommandSafety(input: {
  command: string;
  cwd: string;
  project: ProjectRecord;
  artifactRoot: string;
  databasePath: string;
}): SafetyDecision {
  const commandHash = hashCommand(input.command, input.cwd);
  const resolvedTargets = resolveLikelyTargets(input.command, input.cwd);

  if (secretRegex.test(input.command)) {
    return { action: "deny", reason: "Command appears to access secrets or credentials.", commandHash, resolvedTargets };
  }

  if (installPipeRegex.test(input.command)) {
    return { action: "deny", reason: "Piped network install commands are blocked.", commandHash, resolvedTargets };
  }

  if (touchesProtectedPath(resolvedTargets, input)) {
    return { action: "deny", reason: "Command targets a protected path outside the active workspace.", commandHash, resolvedTargets };
  }

  const broadMatch = input.command.match(broadDestructiveRegex);
  if (broadMatch) {
    if (isBroadDeleteTarget(broadMatch[1])) {
      return { action: "deny", reason: "Broad destructive delete target is blocked with no approval path.", commandHash, resolvedTargets };
    }
    if (resolvedTargets.some((target) => !isScopedCleanupTarget(target, input.cwd))) {
      return { action: "deny", reason: "Destructive command target is not a scoped cleanup path.", commandHash, resolvedTargets };
    }
    return {
      action: "approval_required",
      reason: "Scoped destructive cleanup requires two approvers.",
      commandHash,
      resolvedTargets,
      requiredApprovals: 2,
    };
  }

  if (destructiveRegex.test(input.command)) {
    return {
      action: "approval_required",
      reason: "Potentially destructive command requires approval.",
      commandHash,
      resolvedTargets,
      requiredApprovals: 1,
    };
  }

  return { action: "allow", reason: "No safety policy matched.", commandHash, resolvedTargets };
}

export function hashCommand(command: string, cwd: string): string {
  return crypto.createHash("sha256").update(`${cwd}\n${command}`).digest("hex");
}

function resolveLikelyTargets(command: string, cwd: string): string[] {
  const match = command.match(broadDestructiveRegex);
  if (!match) return [];
  return match[1]
    .split(/\s+/)
    .map((raw) => raw.replace(/^['"]|['"]$/g, ""))
    .filter((part) => part && !part.startsWith("-"))
    .map((part) => path.resolve(cwd, part));
}

function touchesProtectedPath(targets: string[], input: { project: ProjectRecord; artifactRoot: string; databasePath: string }): boolean {
  const protectedRoots = [
    path.resolve("/"),
    path.resolve(process.env.HOME ?? "~"),
    path.resolve(input.project.path),
    input.project.worktreeRoot ? path.resolve(input.project.worktreeRoot) : null,
    path.resolve(input.artifactRoot),
    path.resolve(input.databasePath),
  ].filter((item): item is string => Boolean(item));

  return targets.some((target) => protectedRoots.some((root) => target === root));
}

function isBroadDeleteTarget(rawTarget: string): boolean {
  const normalized = rawTarget.trim().replace(/^['"]|['"]$/g, "");
  return ["/", "~", ".", "..", "$HOME", "${HOME}", "/*", "./", "../"].includes(normalized);
}

function isScopedCleanupTarget(target: string, cwd: string): boolean {
  const relative = path.relative(cwd, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const first = relative.split(path.sep)[0];
  return ["build", "dist", ".cache", "node_modules", "tmp", "coverage", ".next", ".vite"].includes(first);
}
