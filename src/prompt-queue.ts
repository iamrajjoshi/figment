import { randomBytes } from "node:crypto";
import { type Annotation } from "./annotations.js";

export interface Prompt {
  id: string;
  text: string;
  author: string;
  status: "pending" | "processing" | "done" | "error";
  submittedAt: number;
  completedAt?: number;
  version?: number;
  error?: string;
  annotations?: Annotation[];
}

type QueueEvent = "added" | "updated";
type QueueListener = (prompt: Prompt) => void;

export class PromptQueue {
  private queue: Prompt[] = [];
  private listeners = new Map<QueueEvent, Set<QueueListener>>();

  /** Add a new prompt to the queue. */
  add(text: string, author: string, annotations?: Annotation[]): Prompt {
    const prompt: Prompt = {
      id: randomBytes(4).toString("hex"),
      text,
      author,
      status: "pending",
      submittedAt: Date.now(),
      ...(annotations?.length ? { annotations } : {}),
    };
    this.queue.push(prompt);
    this.emit("added", prompt);
    return prompt;
  }

  /** Dequeue the next pending prompt and mark it as processing. */
  next(): Prompt | undefined {
    const prompt = this.queue.find((p) => p.status === "pending");
    if (!prompt) return undefined;
    prompt.status = "processing";
    this.emit("updated", prompt);
    return prompt;
  }

  /** Mark a prompt as successfully completed with a version number. */
  complete(id: string, version: number): void {
    const prompt = this.queue.find((p) => p.id === id);
    if (!prompt) return;
    prompt.status = "done";
    prompt.version = version;
    prompt.completedAt = Date.now();
    this.emit("updated", prompt);
  }

  /** Mark a prompt as failed with an error message. */
  fail(id: string, error: string): void {
    const prompt = this.queue.find((p) => p.id === id);
    if (!prompt) return;
    prompt.status = "error";
    prompt.error = error;
    prompt.completedAt = Date.now();
    this.emit("updated", prompt);
  }

  /** Return all prompts in the queue. */
  getAll(): Prompt[] {
    return [...this.queue];
  }

  /** Return only pending prompts. */
  getPending(): Prompt[] {
    return this.queue.filter((p) => p.status === "pending");
  }

  /** Register a listener for queue events. */
  on(event: QueueEvent, cb: QueueListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
  }

  private emit(event: QueueEvent, prompt: Prompt): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) cb(prompt);
    }
  }
}
