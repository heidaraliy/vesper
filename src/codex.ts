import { spawn } from "node:child_process";
import type { CodexRunResult, CodexStreamEvent } from "./types.js";

export interface CodexRunnerOptions {
  model?: string | null;
  reasoning?: "low" | "medium" | "high" | "max";
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  approvalPolicy?: "untrusted" | "on-request" | "never";
}

export interface CodexRunRequest {
  prompt: string;
  cwd: string;
  resumeSessionId?: string | null;
  options?: CodexRunnerOptions;
  onEvent?: (event: CodexStreamEvent) => void;
  onCommand?: (command: string) => "allow" | "stop";
}

export class CodexRunner {
  run(request: CodexRunRequest): { promise: Promise<CodexRunResult>; kill: () => void } {
    const args = buildArgs(request);
    const proc = spawn("codex", args, {
      cwd: request.cwd,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let killed = false;
    let stdout = "";
    let stderr = "";
    let buffer = "";
    let sessionId: string | null = request.resumeSessionId ?? null;
    let resultText = "";

    const kill = () => {
      if (killed || proc.killed) return;
      killed = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 5000);
    };

    const promise = new Promise<CodexRunResult>((resolve, reject) => {
      proc.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const parsed = parseCodexLine(line);
          if (!parsed) continue;
          if (parsed.sessionId) sessionId = parsed.sessionId;
          if (parsed.command) {
            const decision = request.onCommand?.(parsed.command) ?? "allow";
            if (decision === "stop") {
              request.onEvent?.({ kind: "error", text: `Blocked command: ${parsed.command}` });
              kill();
              return;
            }
          }
          if (parsed.event) request.onEvent?.(parsed.event);
          if (parsed.assistantText) resultText += parsed.assistantText;
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        if (killed) {
          reject(new Error("Codex process was cancelled or blocked by Vesper policy."));
          return;
        }
        if (code !== 0) {
          reject(new Error(`Codex exited with code ${code}: ${extractFailure(stderr, stdout)}`));
          return;
        }
        resolve({
          sessionId,
          result: pickFinalResult(stdout, resultText),
          exitCode: code ?? 0,
        });
      });

      proc.on("error", reject);
    });

    return { promise, kill };
  }
}

function buildArgs(request: CodexRunRequest): string[] {
  const options = request.options ?? {};
  const args = ["exec"];

  if (request.resumeSessionId) {
    args.push("resume", request.resumeSessionId);
  }

  args.push(
    request.prompt,
    "--cd",
    request.cwd,
    "--sandbox",
    options.sandbox ?? "workspace-write",
    "--ask-for-approval",
    options.approvalPolicy ?? "never",
    "--json",
  );

  if (options.model) args.push("--model", options.model);
  if (options.reasoning) args.push("-c", `model_reasoning_effort="${options.reasoning}"`);
  return args;
}

interface ParsedCodexLine {
  sessionId?: string;
  command?: string;
  event?: CodexStreamEvent;
  assistantText?: string;
}

export function parseCodexLine(line: string): ParsedCodexLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const event = JSON.parse(trimmed) as Record<string, unknown>;
    const parsed: ParsedCodexLine = {};
    if (typeof event.session_id === "string") parsed.sessionId = event.session_id;

    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type === "agent_message" && typeof item.text === "string") {
      parsed.assistantText = item.text;
      parsed.event = { kind: "text", text: item.text };
      return parsed;
    }

    if (item?.type === "command_execution") {
      const command = typeof item.command === "string" ? item.command : "";
      parsed.command = command;
      parsed.event = event.type === "item.started"
        ? { kind: "tool_use", tool: "Bash", summary: summarizeCommand(command), input: { command } }
        : { kind: "tool_result", tool: "Bash", text: typeof item.aggregated_output === "string" ? item.aggregated_output : "" };
      return parsed;
    }

    const text = textFromEvent(event);
    if (text) {
      parsed.assistantText = text;
      parsed.event = { kind: "text", text };
      return parsed;
    }

    return parsed;
  } catch {
    return { event: { kind: "text", text: `${trimmed}\n` }, assistantText: `${trimmed}\n` };
  }
}

function textFromEvent(event: Record<string, unknown>): string {
  for (const candidate of [
    event.text,
    event.delta,
    event.content,
    (event.message as Record<string, unknown> | undefined)?.content,
    (event.data as Record<string, unknown> | undefined)?.text,
  ]) {
    if (typeof candidate === "string") return candidate;
  }
  return "";
}

function summarizeCommand(command: string): string {
  return `Running \`${command.length > 90 ? `${command.slice(0, 90)}...` : command}\``;
}

function extractFailure(stderr: string, stdout: string): string {
  const lines = [stderr, stdout]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningful = lines.filter((line) =>
    !/^OpenAI Codex v/i.test(line) &&
    !/^workdir:/i.test(line) &&
    !/^model:/i.test(line) &&
    !/^sandbox:/i.test(line) &&
    !/^approval:/i.test(line),
  );
  return meaningful.slice(-4).join(" ") || "unknown failure";
}

function pickFinalResult(stdout: string, streamed: string): string {
  const assistantMessages: string[] = [];
  for (const line of stdout.split("\n")) {
    const parsed = parseCodexLine(line);
    if (parsed?.assistantText?.trim()) assistantMessages.push(parsed.assistantText.trim());
  }
  return assistantMessages.at(-1) ?? streamed.trim() ?? stdout.trim();
}
