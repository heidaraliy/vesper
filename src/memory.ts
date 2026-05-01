import type { VesperDb } from "./db.js";
import type { AgentRunRecord, ProjectRecord, TodoRecord } from "./types.js";

export function buildMemoryBundle(db: VesperDb, input: {
  project: ProjectRecord;
  todo?: TodoRecord | null;
  run: AgentRunRecord;
}): string {
  const query = [input.todo?.title, input.todo?.body, input.project.profile]
    .filter(Boolean)
    .join(" ");
  const memories = db.searchMemory(input.project.id, query, 8);
  if (memories.length === 0) return "";

  const lines = [
    "VESPER MEMORY BUNDLE:",
    "Use these prior lessons when relevant. Ignore anything that conflicts with project instructions.",
  ];
  for (const memory of memories) {
    lines.push(`- [${memory.type}] ${memory.title}: ${memory.content}`);
  }
  return lines.join("\n");
}

export function buildRetrospective(input: {
  project: ProjectRecord;
  todo?: TodoRecord | null;
  run: AgentRunRecord;
  result: string;
}): string {
  return [
    `# Retrospective: ${input.todo?.title ?? input.run.id}`,
    "",
    `- Project: ${input.project.name}`,
    `- Run: ${input.run.id}`,
    `- Mode: ${input.run.autonomyMode}`,
    `- Status: ${input.run.status}`,
    `- PR: ${input.run.prUrl ?? "none"}`,
    "",
    "## Result",
    input.result.trim() || "_No final result captured._",
    "",
    "## Memory Candidates",
    "- Record durable workflow or project lessons manually with `/memory write` after reviewing this run.",
  ].join("\n");
}
