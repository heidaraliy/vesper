import { describe, expect, it } from "vitest";
import { parseCodexLine } from "./codex.js";

describe("parseCodexLine", () => {
  it("extracts agent messages", () => {
    const parsed = parseCodexLine(JSON.stringify({
      type: "item.completed",
      session_id: "sess_1",
      item: { type: "agent_message", text: "Plan ready." },
    }));
    expect(parsed?.sessionId).toBe("sess_1");
    expect(parsed?.assistantText).toBe("Plan ready.");
    expect(parsed?.event?.kind).toBe("text");
  });

  it("extracts command executions", () => {
    const parsed = parseCodexLine(JSON.stringify({
      type: "item.started",
      item: { type: "command_execution", command: "npm test" },
    }));
    expect(parsed?.command).toBe("npm test");
    expect(parsed?.event?.kind).toBe("tool_use");
  });
});
