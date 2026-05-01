import type { AgentRunRecord, ProjectRecord, TodoRecord } from "./types.js";

export function buildRunPrompt(input: {
  project: ProjectRecord;
  todo?: TodoRecord | null;
  run: AgentRunRecord;
  memoryBundle?: string;
  feedback?: string;
}): string {
  const modeLines = input.run.autonomyMode === "plan-gated"
    ? [
        "AUTONOMY MODE: plan-gated.",
        "First produce a decision-complete implementation plan and then stop.",
        "Do not edit files, run destructive commands, commit, push, or create a PR until the user approves in Discord.",
      ]
    : [
        "AUTONOMY MODE: automatic.",
        "You may plan, implement, verify, commit, push, and open a PR without waiting for plan approval.",
        "Stay within the project/worktree and obey all Vesper safety rules.",
      ];

  return [
    "You are a Codex agent being orchestrated by Vesper from Discord.",
    "",
    ...modeLines,
    "",
    "PROJECT:",
    `- Name: ${input.project.name}`,
    `- Profile: ${input.project.profile}`,
    `- Path: ${input.run.worktreePath ?? input.project.path}`,
    `- Build: ${input.project.buildCommand || "(not configured)"}`,
    `- Test: ${input.project.testCommand || "(not configured)"}`,
    "",
    "TASK:",
    `- Title: ${input.todo?.title ?? "Ad hoc Discord task"}`,
    `- Body: ${input.feedback ?? input.todo?.body ?? ""}`,
    `- Tags: ${input.todo?.tags.join(", ") || "none"}`,
    "",
    input.memoryBundle?.trim() ? input.memoryBundle.trim() : "VESPER MEMORY BUNDLE: none",
    "",
    "SAFETY RULES:",
    "- Read AGENTS.md and CLAUDE.md when present before planning or editing.",
    "- Never edit or delete outside the current project/worktree.",
    "- Never read, print, copy, or summarize secrets such as .env files, SSH keys, tokens, or credentials.",
    "- Never delete repo roots, worktree roots, .git directories, artifact databases, or home/system directories.",
    "- Broad destructive commands are forbidden. Scoped cleanup requires explicit Vesper approval.",
    "- If blocked by safety policy, explain the exact blocker and stop.",
    "",
    "OUTPUT CONTRACT:",
    "- Keep Discord-facing summaries concise.",
    "- Include files changed, verification run, and PR URL when applicable.",
    "- If plan-gated, end with a clear approval-ready plan and no code changes.",
  ].join("\n");
}

export function buildApprovalPrompt(input: {
  project: ProjectRecord;
  todo?: TodoRecord | null;
  run: AgentRunRecord;
  feedback?: string;
  memoryBundle?: string;
}): string {
  return [
    "The Discord user approved the plan for this Vesper run.",
    input.feedback?.trim() ? `Additional feedback: ${input.feedback.trim()}` : "",
    "",
    buildRunPrompt({
      project: input.project,
      todo: input.todo,
      run: { ...input.run, autonomyMode: "automatic" },
      memoryBundle: input.memoryBundle,
    }),
  ].filter(Boolean).join("\n");
}
