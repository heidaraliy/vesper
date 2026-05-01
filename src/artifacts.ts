import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ArtifactType } from "./types.js";
import type { VesperDb } from "./db.js";

export class ArtifactStore {
  constructor(
    private readonly root: string,
    private readonly db: VesperDb,
  ) {
    mkdirSync(root, { recursive: true });
  }

  writeText(input: {
    runId: string;
    projectId: string;
    type: ArtifactType;
    name: string;
    content: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }) {
    const dir = path.join(this.root, input.runId);
    mkdirSync(dir, { recursive: true });
    const fileName = safeFileName(input.name);
    const location = path.join(dir, fileName);
    writeFileSync(location, input.content);
    return this.db.createArtifact({
      runId: input.runId,
      projectId: input.projectId,
      type: input.type,
      location,
      summary: input.summary ?? input.content.slice(0, 240),
      metadata: input.metadata,
    });
  }
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "artifact.md";
}
