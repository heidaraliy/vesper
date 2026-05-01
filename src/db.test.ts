import { describe, expect, it } from "vitest";
import { VesperDb } from "./db.js";

describe("VesperDb", () => {
  it("stores projects, todos, runs, artifacts, and memory", () => {
    const db = new VesperDb(":memory:");
    const project = db.upsertProject({
      name: "Demo",
      slug: "demo",
      path: "/tmp/demo",
      worktreeRoot: "/tmp/wt",
      buildCommand: "npm run build",
      testCommand: "npm test",
      profile: "generic",
      gitRequired: true,
      readiness: "ready",
    });
    const todo = db.createTodo({
      projectId: project.id,
      title: "Add feature",
      createdBy: "user_1",
      autonomyMode: "plan-gated",
    });
    const run = db.createRun({
      projectId: project.id,
      todoId: todo.id,
      requestedBy: "user_1",
      autonomyMode: "plan-gated",
    });
    const artifact = db.createArtifact({
      runId: run.id,
      projectId: project.id,
      type: "plan",
      location: "/tmp/plan.md",
      summary: "Plan",
    });
    const memory = db.createMemory({
      projectId: project.id,
      type: "procedural",
      title: "Build",
      content: "Use npm run build.",
      evidenceArtifactIds: [artifact.id],
    });

    expect(db.listProjects()).toHaveLength(1);
    expect(db.listTodos(project.id)).toHaveLength(1);
    expect(db.listRuns()).toHaveLength(1);
    expect(db.listArtifacts(run.id)[0]?.id).toBe(artifact.id);
    expect(db.searchMemory(project.id, "build")[0]?.id).toBe(memory.id);
    db.close();
  });
});
