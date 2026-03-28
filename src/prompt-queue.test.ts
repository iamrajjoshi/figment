import { describe, it, expect, beforeEach } from "vitest";
import { PromptQueue, type Prompt } from "./prompt-queue.js";

describe("PromptQueue", () => {
  let queue: PromptQueue;

  beforeEach(() => {
    queue = new PromptQueue();
  });

  describe("add", () => {
    it("creates a prompt with pending status and unique ID", () => {
      const prompt = queue.add("change the color", "alice");

      expect(prompt.id).toMatch(/^[0-9a-f]{8}$/);
      expect(prompt.text).toBe("change the color");
      expect(prompt.author).toBe("alice");
      expect(prompt.status).toBe("pending");
      expect(prompt.submittedAt).toBeGreaterThan(0);
    });

    it("assigns unique IDs to each prompt", () => {
      const a = queue.add("first", "alice");
      const b = queue.add("second", "bob");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("next", () => {
    it("returns the first pending prompt and marks it processing", () => {
      queue.add("first", "alice");
      queue.add("second", "bob");

      const prompt = queue.next();
      expect(prompt).toBeDefined();
      expect(prompt!.text).toBe("first");
      expect(prompt!.status).toBe("processing");
    });

    it("returns undefined when queue is empty", () => {
      expect(queue.next()).toBeUndefined();
    });

    it("returns undefined when no pending prompts remain", () => {
      queue.add("only one", "alice");
      queue.next(); // marks it processing

      expect(queue.next()).toBeUndefined();
    });
  });

  describe("complete", () => {
    it("marks prompt as done with version number", () => {
      const prompt = queue.add("do stuff", "alice");
      queue.next();
      queue.complete(prompt.id, 3);

      const all = queue.getAll();
      const completed = all.find((p) => p.id === prompt.id)!;
      expect(completed.status).toBe("done");
      expect(completed.version).toBe(3);
      expect(completed.completedAt).toBeGreaterThan(0);
    });

    it("does nothing for unknown ID", () => {
      queue.add("prompt", "alice");
      queue.complete("nonexistent", 1);
      expect(queue.getAll()[0].status).toBe("pending");
    });
  });

  describe("fail", () => {
    it("marks prompt as error with message", () => {
      const prompt = queue.add("do stuff", "alice");
      queue.next();
      queue.fail(prompt.id, "something broke");

      const all = queue.getAll();
      const failed = all.find((p) => p.id === prompt.id)!;
      expect(failed.status).toBe("error");
      expect(failed.error).toBe("something broke");
      expect(failed.completedAt).toBeGreaterThan(0);
    });
  });

  describe("getAll", () => {
    it("returns all prompts", () => {
      queue.add("first", "alice");
      queue.add("second", "bob");
      queue.add("third", "carol");

      const all = queue.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((p) => p.text)).toEqual(["first", "second", "third"]);
    });

    it("returns a copy (not the internal array)", () => {
      queue.add("prompt", "alice");
      const all = queue.getAll();
      all.pop();
      expect(queue.getAll()).toHaveLength(1);
    });
  });

  describe("getPending", () => {
    it("returns only pending prompts", () => {
      queue.add("first", "alice");
      queue.add("second", "bob");
      queue.add("third", "carol");

      queue.next(); // first -> processing

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
      expect(pending.map((p) => p.text)).toEqual(["second", "third"]);
    });

    it("returns empty array when no pending prompts", () => {
      expect(queue.getPending()).toEqual([]);
    });
  });

  describe("events", () => {
    it("fires 'added' event when a prompt is added", () => {
      const received: Prompt[] = [];
      queue.on("added", (prompt) => received.push(prompt));

      queue.add("hello", "alice");

      expect(received).toHaveLength(1);
      expect(received[0].text).toBe("hello");
      expect(received[0].status).toBe("pending");
    });

    it("fires 'updated' event when next() marks prompt as processing", () => {
      const received: Prompt[] = [];
      queue.on("updated", (prompt) => received.push(prompt));

      queue.add("hello", "alice");
      queue.next();

      expect(received).toHaveLength(1);
      expect(received[0].status).toBe("processing");
    });

    it("fires 'updated' event on complete()", () => {
      const received: Prompt[] = [];
      queue.on("updated", (prompt) => received.push(prompt));

      const prompt = queue.add("hello", "alice");
      queue.next();
      queue.complete(prompt.id, 1);

      // next() fires once, complete() fires once
      expect(received).toHaveLength(2);
      expect(received[1].status).toBe("done");
    });

    it("fires 'updated' event on fail()", () => {
      const received: Prompt[] = [];
      queue.on("updated", (prompt) => received.push(prompt));

      const prompt = queue.add("hello", "alice");
      queue.next();
      queue.fail(prompt.id, "oops");

      expect(received).toHaveLength(2);
      expect(received[1].status).toBe("error");
    });
  });

  describe("ordering", () => {
    it("processes prompts in FIFO order", () => {
      queue.add("first", "alice");
      queue.add("second", "bob");
      queue.add("third", "carol");

      const p1 = queue.next();
      expect(p1!.text).toBe("first");

      // Complete first, then get next
      queue.complete(p1!.id, 1);
      const p2 = queue.next();
      expect(p2!.text).toBe("second");

      queue.complete(p2!.id, 2);
      const p3 = queue.next();
      expect(p3!.text).toBe("third");
    });
  });
});
