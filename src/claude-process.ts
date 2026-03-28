import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

type OutputListener = (chunk: string) => void;
type ToolProgressListener = (progress: { tool: string; path?: string; status: "started" | "completed" }) => void;

const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
  haiku: "claude-haiku-4-5-20251001",
};

function resolveModel(model: string): string {
  return MODEL_ALIASES[model] ?? model;
}

export interface ClaudeResult {
  success: boolean;
  output: string;
  costUsd?: number;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Tool definitions for the Anthropic API
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file in the working directory.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative file path (e.g. ./prototype.html)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file in the working directory. Creates the file if it doesn't exist, overwrites if it does.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative file path" },
        content: { type: "string", description: "Full file content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace a specific string in a file. Use for surgical edits.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Relative file path" },
        old_string: { type: "string", description: "Exact string to find and replace" },
        new_string: { type: "string", description: "Replacement string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_files",
    description: "List files in the working directory.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Claude process — direct Anthropic API with agentic tool loop
// ---------------------------------------------------------------------------

export class ClaudeProcess {
  private workDir: string;
  private systemPromptPath: string;
  private model: string;
  private busy = false;
  private systemPrompt = "";
  private client: Anthropic | null = null;
  private outputListeners = new Set<OutputListener>();
  private toolProgressListeners = new Set<ToolProgressListener>();

  constructor(opts: {
    workDir: string;
    systemPromptPath: string;
    model?: string;
  }) {
    this.workDir = opts.workDir;
    this.systemPromptPath = opts.systemPromptPath;
    this.model = resolveModel(opts.model ?? "sonnet");
  }

  async start(): Promise<void> {
    try {
      this.systemPrompt = await readFile(this.systemPromptPath, "utf8");
    } catch {
      this.systemPrompt = "";
    }
    this.client = new Anthropic();
  }

  stop(): void {
    this.client = null;
  }

  isReady(): boolean {
    return !this.busy && this.client !== null;
  }

  on(event: "output", cb: OutputListener): void;
  on(event: "tool-progress", cb: ToolProgressListener): void;
  on(event: "output" | "tool-progress", cb: OutputListener | ToolProgressListener): void {
    if (event === "output") {
      this.outputListeners.add(cb as OutputListener);
    } else if (event === "tool-progress") {
      this.toolProgressListeners.add(cb as ToolProgressListener);
    }
  }

  async sendPrompt(
    author: string,
    instruction: string,
    _currentHtml: string,
    _version: number,
  ): Promise<ClaudeResult> {
    if (this.busy) {
      return { success: false, output: "Claude is busy processing another prompt" };
    }
    if (!this.client) {
      return { success: false, output: "Client not initialized. Call start() first." };
    }

    this.busy = true;
    const startTime = Date.now();

    const prompt = [
      `Design change from ${author}:`,
      instruction,
      "",
      "Read ./prototype.html, apply the change, and write it back. Only edit that file.",
    ].join("\n");

    try {
      const result = await this.agenticLoop(prompt);
      const durationMs = Date.now() - startTime;
      return { ...result, durationMs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: msg };
    } finally {
      this.busy = false;
    }
  }

  // -------------------------------------------------------------------------
  // Agentic tool loop
  // -------------------------------------------------------------------------

  private async agenticLoop(userPrompt: string): Promise<ClaudeResult> {
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    const MAX_TURNS = 15;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await this.client!.messages.create({
        model: this.model,
        max_tokens: 16384,
        system: this.systemPrompt || undefined,
        tools: TOOLS,
        messages,
      });

      // Extract text from response and notify listeners
      let responseText = "";
      for (const block of response.content) {
        if (block.type === "text") {
          responseText += block.text;
          this.notifyOutput(block.text);
        }
      }

      // If Claude is done (no more tool calls), return the text
      if (response.stop_reason === "end_turn") {
        return { success: true, output: responseText };
      }

      // Process tool calls
      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            const input = block.input as Record<string, string>;
            this.notifyToolProgress({ tool: block.name, path: input.path, status: "started" });
            const result = await this.executeTool(block.name, input);
            this.notifyToolProgress({ tool: block.name, path: input.path, status: "completed" });
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Add assistant response + tool results to conversation
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
      }
    }

    return { success: true, output: "Completed (max turns reached)" };
  }

  // -------------------------------------------------------------------------
  // Tool execution — all paths restricted to workDir
  // -------------------------------------------------------------------------

  private async executeTool(name: string, input: Record<string, string>): Promise<string> {
    try {
      switch (name) {
        case "read_file": {
          const safePath = this.resolveSafePath(input.path);
          const content = await readFile(safePath, "utf8");
          return content;
        }
        case "write_file": {
          const safePath = this.resolveSafePath(input.path);
          await writeFile(safePath, input.content);
          return `Wrote ${input.content.length} chars to ${input.path}`;
        }
        case "edit_file": {
          const safePath = this.resolveSafePath(input.path);
          const content = await readFile(safePath, "utf8");
          if (!content.includes(input.old_string)) {
            return `Error: old_string not found in ${input.path}`;
          }
          const updated = content.replace(input.old_string, input.new_string);
          await writeFile(safePath, updated);
          return `Edited ${input.path}`;
        }
        case "list_files": {
          const entries = await readdir(this.workDir);
          return entries.filter((e) => !e.startsWith(".")).join("\n");
        }
        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error: ${msg}`;
    }
  }

  /**
   * Resolve a path and ensure it stays within the working directory.
   * Throws if the path escapes.
   */
  private resolveSafePath(filePath: string): string {
    // Normalize: strip leading ./ and resolve
    const resolved = resolve(this.workDir, filePath);
    const rel = relative(this.workDir, resolved);

    // If the relative path starts with ".." or is absolute, it escapes
    if (rel.startsWith("..") || resolve(rel) === rel) {
      throw new Error(`Access denied: path "${filePath}" is outside the session directory`);
    }

    return resolved;
  }

  private notifyOutput(text: string): void {
    for (const cb of this.outputListeners) {
      cb(text);
    }
  }

  private notifyToolProgress(progress: { tool: string; path?: string; status: "started" | "completed" }): void {
    for (const cb of this.toolProgressListeners) {
      cb(progress);
    }
  }
}
