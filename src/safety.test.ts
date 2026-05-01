import { describe, expect, it } from "vitest";
import { assessCommandSafety } from "./safety.js";
import type { ProjectRecord } from "./types.js";

const project: ProjectRecord = {
  id: "proj_1",
  name: "Demo",
  slug: "demo",
  path: "/vm/projects/demo",
  worktreeRoot: "/vm/worktrees/demo",
  buildCommand: "npm run build",
  testCommand: "npm test",
  profile: "generic",
  gitRequired: true,
  readiness: "ready",
  createdAt: 1,
  updatedAt: 1,
};

describe("assessCommandSafety", () => {
  it("denies broad destructive deletes", () => {
    const decision = assessCommandSafety({
      command: "rm -rf /",
      cwd: "/vm/worktrees/demo/run",
      project,
      artifactRoot: "/vm/vesper/artifacts",
      databasePath: "/vm/vesper/vesper.db",
    });
    expect(decision.action).toBe("deny");
  });

  it("requires two approvals for scoped cleanup", () => {
    const decision = assessCommandSafety({
      command: "rm -rf build",
      cwd: "/vm/worktrees/demo/run",
      project,
      artifactRoot: "/vm/vesper/artifacts",
      databasePath: "/vm/vesper/vesper.db",
    });
    expect(decision.action).toBe("approval_required");
    if (decision.action === "approval_required") {
      expect(decision.requiredApprovals).toBe(2);
    }
  });

  it("denies secret-looking commands", () => {
    const decision = assessCommandSafety({
      command: "cat .env",
      cwd: "/vm/worktrees/demo/run",
      project,
      artifactRoot: "/vm/vesper/artifacts",
      databasePath: "/vm/vesper/vesper.db",
    });
    expect(decision.action).toBe("deny");
  });
});
