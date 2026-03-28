import { Hono } from "hono";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { streamSSE } from "hono/streaming";
import { verifyToken, createToken, type TokenPayload } from "./auth.js";
import { type PromptQueue, type Prompt } from "./prompt-queue.js";
import { type VersionStore } from "./version-store.js";
import { type ClaudeProcess } from "./claude-process.js";
import { extractDesignTokens } from "./design-tokens-extractor.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerOpts {
  secret: string;
  sessionName: string;
  sessionDir: string;
  versionStore: VersionStore;
  promptQueue: PromptQueue;
  claudeProcess: ClaudeProcess;
  uiHtmlPath: string;
}

interface Participant {
  name: string;
  role: "editor" | "viewer";
  joinedAt: number;
}

type SSEWriter = {
  writeSSE: (data: { event: string; data: string; id?: string }) => Promise<void>;
};

interface Ticket {
  payload: TokenPayload;
  expires: number;
}

// ---------------------------------------------------------------------------
// Broadcaster — fans out SSE events to all connected clients
// ---------------------------------------------------------------------------

class SSEBroadcaster {
  private clients = new Set<SSEWriter>();

  add(writer: SSEWriter): void {
    this.clients.add(writer);
  }

  remove(writer: SSEWriter): void {
    this.clients.delete(writer);
  }

  async send(event: string, data: unknown): Promise<void> {
    const payload = JSON.stringify(data);
    const dead: SSEWriter[] = [];
    for (const client of this.clients) {
      try {
        await client.writeSSE({ event, data: payload });
      } catch {
        dead.push(client);
      }
    }
    for (const d of dead) this.clients.delete(d);
  }

  get size(): number {
    return this.clients.size;
  }
}

// ---------------------------------------------------------------------------
// Rate limiter — per-token, 1 prompt every WINDOW ms
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS = 5_000;

class RateLimiter {
  private lastSubmit = new Map<string, number>();

  check(token: string): boolean {
    const hash = createHash("sha256").update(token).digest("hex");
    const last = this.lastSubmit.get(hash) ?? 0;
    if (Date.now() - last < RATE_WINDOW_MS) return false;
    this.lastSubmit.set(hash, Date.now());
    return true;
  }
}

// ---------------------------------------------------------------------------
// Ticket store — short-lived, single-use tokens for URL-based auth
// ---------------------------------------------------------------------------

const TICKET_TTL_MS = 60_000;

class TicketStore {
  private tickets = new Map<string, Ticket>();

  create(payload: TokenPayload): string {
    const id = randomBytes(16).toString("hex");
    this.tickets.set(id, { payload, expires: Date.now() + TICKET_TTL_MS });
    this.cleanup();
    return id;
  }

  consume(id: string): TokenPayload | null {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    this.tickets.delete(id); // single-use
    if (ticket.expires < Date.now()) return null;
    return ticket.payload;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, ticket] of this.tickets) {
      if (ticket.expires < now) this.tickets.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Auth helper — resolves a request to a TokenPayload via token or ticket
// ---------------------------------------------------------------------------

interface AuthResult {
  payload: TokenPayload;
  /** Stable identifier for rate limiting (token signature hash or ticket ID) */
  rateLimitKey: string;
}

function authenticate(
  c: { req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined } },
  secret: string,
  sessionName: string,
  ticketStore: TicketStore,
): AuthResult | null {
  // 1. Try ticket (for EventSource, iframe, export — URL-safe, single-use)
  const ticketId = c.req.query("ticket");
  if (ticketId) {
    const payload = ticketStore.consume(ticketId);
    if (payload && payload.session === sessionName) {
      return { payload, rateLimitKey: createHash("sha256").update(ticketId).digest("hex") };
    }
    return null;
  }

  // 2. Try Authorization header (preferred for fetch() calls)
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const rawToken = auth.slice(7);
    const payload = verifyToken(secret, rawToken);
    if (payload && payload.session === sessionName) {
      // Key on the token's signature (unique per invite, not controllable)
      const sig = rawToken.split(".")[1] ?? rawToken;
      return { payload, rateLimitKey: createHash("sha256").update(sig).digest("hex") };
    }
    return null;
  }

  // 3. Try ?t= query param (share link entry point only)
  const fromQuery = c.req.query("t");
  if (fromQuery) {
    const payload = verifyToken(secret, fromQuery);
    if (payload && payload.session === sessionName) {
      const sig = fromQuery.split(".")[1] ?? fromQuery;
      return { payload, rateLimitKey: createHash("sha256").update(sig).digest("hex") };
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createServer(opts: ServerOpts): {
  app: Hono;
  broadcast: (event: string, data: unknown) => Promise<void>;
} {
  const { secret, sessionName, sessionDir, versionStore, promptQueue, uiHtmlPath } = opts;
  const app = new Hono();
  const broadcaster = new SSEBroadcaster();
  const rateLimiter = new RateLimiter();
  const ticketStore = new TicketStore();
  const participants = new Map<string, Participant>();

  // -- UI shell ---------------------------------------------------------------

  app.get("/", async (c) => {
    try {
      const html = await readFile(uiHtmlPath, "utf8");
      return c.html(html);
    } catch {
      return c.text("UI not found", 404);
    }
  });

  // -- Ticket exchange --------------------------------------------------------

  app.post("/api/ticket", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);

    const ticket = ticketStore.create(auth.payload);
    return c.json({ ticket, expires: Date.now() + TICKET_TTL_MS });
  });

  // -- Invite (editor-only, generates share links without exposing secret) -----

  app.post("/api/invite", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);
    if (auth.payload.role !== "editor") return c.json({ error: "Editors only" }, 403);

    let body: { role?: string; name?: string; expires_hours?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const role = body.role;
    if (role !== "editor" && role !== "viewer") {
      return c.json({ error: "Role must be 'editor' or 'viewer'" }, 400);
    }

    const name = body.name;
    if (!name || typeof name !== "string" || name.length > 100) {
      return c.json({ error: "Name is required (max 100 chars)" }, 400);
    }

    const MAX_EXPIRES_HOURS = 72;
    const rawExpires = body.expires_hours ?? 24;
    if (typeof rawExpires !== "number" || !isFinite(rawExpires) || rawExpires <= 0) {
      return c.json({ error: "expires_hours must be a positive number" }, 400);
    }
    const expiresHours = Math.min(rawExpires, MAX_EXPIRES_HOURS);
    const expiresMs = expiresHours * 60 * 60 * 1000;

    const token = createToken(secret, {
      role,
      name,
      session: sessionName,
      exp: Date.now() + expiresMs,
    });

    return c.json({ token, role, name, expires_hours: expiresHours });
  });

  // -- Prototype preview (auth required) --------------------------------------

  // CSP for preview: sandbox scripts but block all network exfiltration
  // Block all network access from preview content. img-src uses data:/blob: only (no 'self')
  // to prevent same-origin image requests as a data exfiltration side channel.
  const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; sandbox allow-scripts";

  app.get("/preview", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.text("Unauthorized", 401);

    try {
      const html = await readFile(versionStore.getPrototypePath(), "utf8");
      c.header("Content-Security-Policy", PREVIEW_CSP);
      return c.html(html);
    } catch {
      return c.text("No prototype yet", 404);
    }
  });

  app.get("/preview/:version", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.text("Unauthorized", 401);

    const v = parseInt(c.req.param("version"), 10);
    if (isNaN(v)) return c.text("Invalid version", 400);
    try {
      const html = await readFile(versionStore.getVersionPath(v), "utf8");
      c.header("Content-Security-Policy", PREVIEW_CSP);
      return c.html(html);
    } catch {
      return c.text("Version not found", 404);
    }
  });

  // -- SSE events -------------------------------------------------------------

  app.get("/api/events", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.text("Invalid token", 401);

    // Track participant with unique connection ID
    const connId = randomBytes(8).toString("hex");
    const p: Participant = { name: auth.payload.name, role: auth.payload.role, joinedAt: Date.now() };
    participants.set(connId, p);
    broadcaster.send("participant-joined", p).catch(() => {});

    return streamSSE(c, async (stream) => {
      const writer: SSEWriter = { writeSSE: (d) => stream.writeSSE(d) };
      broadcaster.add(writer);

      // Send initial state
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ version: versionStore.getCurrentVersion() }),
      });

      // Keep alive until client disconnects
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          await stream.sleep(30_000);
        }
      } catch {
        // Client disconnected
      } finally {
        broadcaster.remove(writer);
        participants.delete(connId);
        broadcaster.send("participant-left", { name: auth.payload.name }).catch(() => {});
      }
    });
  });

  // -- Submit prompt ----------------------------------------------------------

  app.post("/api/prompt", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);
    if (auth.payload.role !== "editor") return c.json({ error: "Editors only" }, 403);

    // Rate limit by token signature hash (non-controllable, unique per invite)
    if (!rateLimiter.check(auth.rateLimitKey)) return c.json({ error: "Rate limited — wait 5 seconds" }, 429);

    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const text = body.text;
    if (!text || typeof text !== "string") return c.json({ error: "Missing prompt text" }, 400);
    if (text.length > 2000) return c.json({ error: "Prompt too long (max 2000 chars)" }, 400);

    const prompt = promptQueue.add(text, auth.payload.name);
    // Broadcast to all connected clients so the prompt appears in their queue
    broadcaster.send("prompt-added", prompt).catch(() => {});
    return c.json(prompt, 201);
  });

  // -- Session state ----------------------------------------------------------

  app.get("/api/state", (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);

    return c.json({
      session_name: sessionName,
      has_prototype: versionStore.getCurrentVersion() > 0,
      queue: promptQueue.getAll(),
      versions: versionStore.getHistory(),
      current_version: versionStore.getCurrentVersion(),
      participants: Array.from(participants.values()),
    });
  });

  // -- Design system tokens (editor-only) ------------------------------------

  app.post("/api/design-system", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);
    if (auth.payload.role !== "editor") return c.json({ error: "Editors only" }, 403);

    let body: { url?: string; css?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.url && !body.css) {
      return c.json({ error: "Provide either 'url' or 'css'" }, 400);
    }

    try {
      let css: string;
      let tokenCount: number;

      if (body.css) {
        css = body.css;
        tokenCount = (css.match(/--[\w-]+\s*:/g) ?? []).length;
      } else {
        const result = await extractDesignTokens(body.url!);
        css = result.css;
        tokenCount = result.tokenCount;
      }

      // Write tokens to session dir
      const tokensPath = join(sessionDir, "design-tokens.css");
      await writeFile(tokensPath, css);

      // Update system prompt — re-read template base and append new tokens
      const systemPromptPath = join(sessionDir, "..", "system-prompt.md");
      let basePrompt: string;
      try {
        const fullPrompt = await readFile(systemPromptPath, "utf8");
        // Strip any existing Design Tokens section
        const tokensSectionIdx = fullPrompt.indexOf("\n\n## Design Tokens\n");
        basePrompt = tokensSectionIdx >= 0 ? fullPrompt.slice(0, tokensSectionIdx) : fullPrompt;
      } catch {
        basePrompt = "# Design Prototype Editor\n\nEdit ./prototype.html.";
      }
      const updatedPrompt = basePrompt + "\n\n## Design Tokens\n\n```css\n" + css + "\n```\n";
      await writeFile(systemPromptPath, updatedPrompt);

      // Broadcast update event
      await broadcaster.send("design-system-updated", { tokenCount });

      return c.json({ success: true, tokenCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // -- Revert -----------------------------------------------------------------

  app.post("/api/revert/:version", async (c) => {
    const auth = authenticate(c, secret, sessionName, ticketStore);
    if (!auth) return c.json({ error: "Invalid token" }, 401);
    if (auth.payload.role !== "editor") return c.json({ error: "Editors only" }, 403);

    const v = parseInt(c.req.param("version"), 10);
    if (isNaN(v)) return c.json({ error: "Invalid version" }, 400);

    try {
      const meta = await versionStore.revert(v);
      await broadcaster.send("prototype-updated", meta);
      return c.json(meta);
    } catch {
      return c.json({ error: "Version not found" }, 404);
    }
  });

  const broadcast = (event: string, data: unknown) => broadcaster.send(event, data);

  return { app, broadcast };
}

// ---------------------------------------------------------------------------
// Processing loop — dequeues prompts and feeds them to Claude
// ---------------------------------------------------------------------------

export async function startProcessingLoop(
  queue: PromptQueue,
  claude: ClaudeProcess,
  versionStore: VersionStore,
  broadcast: (event: string, data: unknown) => Promise<void>,
): Promise<void> {
  // Process prompts as they arrive
  queue.on("added", () => processNext().catch(() => {}));

  async function processNext(): Promise<void> {
    if (!claude.isReady()) return;

    const prompt = queue.next();
    if (!prompt) return;

    await broadcast("prompt-updated", prompt);

    try {
      // Read current prototype
      let currentHtml: string;
      try {
        currentHtml = await readFile(versionStore.getPrototypePath(), "utf8");
      } catch {
        currentHtml = "<!-- empty prototype -->";
      }

      // Send to Claude
      const result = await claude.sendPrompt(
        prompt.author,
        prompt.text,
        currentHtml,
        versionStore.getCurrentVersion(),
      );

      if (result.success) {
        const meta = await versionStore.snapshot(prompt.text, prompt.author);
        queue.complete(prompt.id, meta.version);
        await broadcast("prototype-updated", meta);
      } else {
        queue.fail(prompt.id, result.output);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      queue.fail(prompt.id, message);
    }

    // Broadcast the final prompt status
    const updated = queue.getAll().find((p) => p.id === prompt.id);
    if (updated) await broadcast("prompt-updated", updated);

    // Process next in queue if any
    processNext().catch(() => {});
  }
}
