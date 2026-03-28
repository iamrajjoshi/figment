import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToken, generateSecret } from "./auth.js";
import { PromptQueue } from "./prompt-queue.js";
import { VersionStore } from "./version-store.js";
import { createServer } from "./server.js";
import type { ClaudeProcess } from "./claude-process.js";
import type { Hono } from "hono";

// ---------------------------------------------------------------------------
// Mock ClaudeProcess — implements the same interface without spawning
// ---------------------------------------------------------------------------

function createMockClaudeProcess(): ClaudeProcess {
  return {
    isReady: () => true,
    on: () => {},
    sendPrompt: async () => ({ success: true, output: "done" }),
  } as unknown as ClaudeProcess;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Server", () => {
  let tmpDir: string;
  let secret: string;
  let sessionName: string;
  let versionStore: VersionStore;
  let promptQueue: PromptQueue;
  let app: Hono;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "figment-srv-"));
    secret = generateSecret();
    sessionName = "test-session";

    // Set up version store with seeded prototype
    versionStore = new VersionStore(tmpDir);
    await mkdir(join(tmpDir, "versions"), { recursive: true });
    await writeFile(join(tmpDir, "prototype.html"), "<h1>Prototype</h1>");

    promptQueue = new PromptQueue();

    // Create a minimal UI HTML file
    const uiHtmlPath = join(tmpDir, "ui.html");
    await writeFile(uiHtmlPath, "<html><body>UI</body></html>");

    const server = createServer({
      secret,
      sessionName,
      sessionDir: tmpDir,
      versionStore,
      promptQueue,
      claudeProcess: createMockClaudeProcess(),
      uiHtmlPath,
    });
    app = server.app;
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // Helper to create tokens
  function editorToken(name = "alice"): string {
    return createToken(secret, { role: "editor", name, session: sessionName });
  }

  function viewerToken(name = "bob"): string {
    return createToken(secret, { role: "viewer", name, session: sessionName });
  }

  // -----------------------------------------------------------------------
  // GET /
  // -----------------------------------------------------------------------

  describe("GET /", () => {
    it("returns 200 with the UI HTML", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("UI");
    });
  });

  // -----------------------------------------------------------------------
  // GET /preview
  // -----------------------------------------------------------------------

  describe("GET /preview", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/preview");
      expect(res.status).toBe(401);
    });

    it("returns 200 with valid Bearer token", async () => {
      const res = await app.request("/preview", {
        headers: { Authorization: "Bearer " + editorToken() },
      });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Prototype");
    });

    it("returns 401 with expired token", async () => {
      const expired = createToken(secret, {
        role: "editor",
        name: "alice",
        session: sessionName,
        exp: Date.now() - 1000,
      });
      const res = await app.request("/preview", {
        headers: { Authorization: "Bearer " + expired },
      });
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/ticket
  // -----------------------------------------------------------------------

  describe("POST /api/ticket", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/api/ticket", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("returns a ticket with valid Bearer token", async () => {
      const res = await app.request("/api/ticket", {
        method: "POST",
        headers: { Authorization: "Bearer " + editorToken() },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ticket).toBeDefined();
      expect(typeof body.ticket).toBe("string");
      expect(body.expires).toBeGreaterThan(Date.now());
    });
  });

  // -----------------------------------------------------------------------
  // GET /preview with ticket
  // -----------------------------------------------------------------------

  describe("GET /preview with ticket", () => {
    it("works with a valid ticket", async () => {
      // Get a ticket
      const ticketRes = await app.request("/api/ticket", {
        method: "POST",
        headers: { Authorization: "Bearer " + editorToken() },
      });
      const { ticket } = await ticketRes.json();

      // Use the ticket for preview
      const res = await app.request(`/preview?ticket=${ticket}`);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Prototype");
    });

    it("ticket is single-use (second request returns 401)", async () => {
      const ticketRes = await app.request("/api/ticket", {
        method: "POST",
        headers: { Authorization: "Bearer " + editorToken() },
      });
      const { ticket } = await ticketRes.json();

      // First use succeeds
      const first = await app.request(`/preview?ticket=${ticket}`);
      expect(first.status).toBe(200);

      // Second use fails
      const second = await app.request(`/preview?ticket=${ticket}`);
      expect(second.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/state
  // -----------------------------------------------------------------------

  describe("GET /api/state", () => {
    it("returns 200 with Bearer token and includes session_name", async () => {
      const res = await app.request("/api/state", {
        headers: { Authorization: "Bearer " + editorToken() },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.session_name).toBe(sessionName);
      expect(body.queue).toBeDefined();
      expect(body.versions).toBeDefined();
      expect(typeof body.current_version).toBe("number");
      expect(body.participants).toBeDefined();
    });

    it("returns 401 with token from wrong session", async () => {
      const wrongSessionToken = createToken(secret, {
        role: "editor",
        name: "alice",
        session: "other-session",
      });
      const res = await app.request("/api/state", {
        headers: { Authorization: "Bearer " + wrongSessionToken },
      });
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/prompt
  // -----------------------------------------------------------------------

  describe("POST /api/prompt", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 for viewer", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + viewerToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "hello" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 201 for editor with valid body", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + editorToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "make it blue" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.text).toBe("make it blue");
      expect(body.status).toBe("pending");
      expect(body.id).toBeDefined();
    });

    it("returns 400 for missing prompt text", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + editorToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for prompt exceeding 2000 chars", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + editorToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "x".repeat(2001) }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("2000");
    });

    it("returns 400 for invalid JSON body", async () => {
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + editorToken(),
          "Content-Type": "application/json",
        },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });

    it("returns 201 with annotations and includes them in response", async () => {
      const annotations = [
        {
          type: "rect",
          id: "test",
          x: 0,
          y: 0,
          width: 100,
          height: 10,
          author: "alice",
          color: "#E8A84C",
          strokeWidth: 2,
        },
      ];
      const res = await app.request("/api/prompt", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + editorToken(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "make this blue", annotations }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.annotations).toBeDefined();
      expect(body.annotations).toHaveLength(1);
      expect(body.annotations[0].type).toBe("rect");
      expect(body.annotations[0].id).toBe("test");
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/revert/:version
  // -----------------------------------------------------------------------

  describe("POST /api/revert/:version", () => {
    it("returns 401 without auth", async () => {
      const res = await app.request("/api/revert/1", { method: "POST" });
      expect(res.status).toBe(401);
    });

    it("returns 403 for viewer", async () => {
      const res = await app.request("/api/revert/1", {
        method: "POST",
        headers: { Authorization: "Bearer " + viewerToken() },
      });
      expect(res.status).toBe(403);
    });

    it("reverts successfully for editor with valid version", async () => {
      // Create a version first
      await versionStore.snapshot("v1", "alice");
      await writeFile(join(tmpDir, "prototype.html"), "<h1>Changed</h1>");
      await versionStore.snapshot("v2", "bob");

      const res = await app.request("/api/revert/1", {
        method: "POST",
        headers: { Authorization: "Bearer " + editorToken() },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.prompt).toBe("Reverted to v1");
      expect(body.version).toBe(3);
    });

    it("returns 404 for nonexistent version", async () => {
      const res = await app.request("/api/revert/999", {
        method: "POST",
        headers: { Authorization: "Bearer " + editorToken() },
      });
      expect(res.status).toBe(404);
    });
  });
});
