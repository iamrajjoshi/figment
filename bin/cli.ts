#!/usr/bin/env node

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (err) => {
  console.error("  Unhandled error:", err instanceof Error ? err.message : err);
});

import { Command } from "commander";
import { readFile, mkdir, copyFile, writeFile, access } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";

import { generateSecret, createToken } from "../src/auth.js";
import { PromptQueue } from "../src/prompt-queue.js";
import { VersionStore } from "../src/version-store.js";
import { ClaudeProcess } from "../src/claude-process.js";
import { createServer, startProcessingLoop } from "../src/server.js";
import { startTunnel, stopTunnel } from "../src/tunnel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");

const program = new Command();

program
  .name("figment")
  .description("Collaborative design prototyping with Claude Code")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// figment init
// ---------------------------------------------------------------------------

program
  .command("init")
  .description("Initialize a design system for prototyping")
  .option("--tokens <path>", "Path to a CSS tokens file")
  .option("--dir <path>", "Directory to initialize in", ".")
  .action(async (opts: { tokens?: string; dir: string }) => {
    const baseDir = resolve(opts.dir, ".figment");
    await mkdir(baseDir, { recursive: true });

    // Copy or create design tokens
    const tokensOut = join(baseDir, "design-tokens.css");
    if (opts.tokens) {
      await copyFile(resolve(opts.tokens), tokensOut);
      console.log(`Copied design tokens from ${opts.tokens}`);
    } else {
      const defaultTokens = join(ROOT, "templates", "default-tokens.css");
      try {
        await access(defaultTokens);
        await copyFile(defaultTokens, tokensOut);
        console.log("Using default starter design tokens");
      } catch {
        await writeFile(tokensOut, "/* Add your design tokens here */\n:root {}\n");
        console.log("Created empty design-tokens.css — edit it with your brand tokens");
      }
    }

    // Copy system prompt template
    const promptOut = join(baseDir, "system-prompt.md");
    const defaultPrompt = join(ROOT, "templates", "system-prompt.md");
    try {
      await access(defaultPrompt);
      const promptContent = await readFile(defaultPrompt, "utf8");
      // Append design tokens to the system prompt
      const tokens = await readFile(tokensOut, "utf8");
      const fullPrompt = promptContent + "\n\n## Design Tokens\n\n```css\n" + tokens + "\n```\n";
      await writeFile(promptOut, fullPrompt);
    } catch {
      await writeFile(promptOut, "# Design Prototype Editor\n\nEdit ./prototype.html.\n");
    }

    console.log(`\nInitialized .figment/ in ${resolve(opts.dir)}`);
    console.log("  .figment/design-tokens.css  — your design system tokens");
    console.log("  .figment/system-prompt.md   — system prompt for Claude\n");
    console.log("Next: figment start --name my-prototype");
  });

// ---------------------------------------------------------------------------
// figment start
// ---------------------------------------------------------------------------

program
  .command("start")
  .description("Start a collaborative prototyping session")
  .requiredOption("--name <name>", "Session name (kebab-case)")
  .option("--port <port>", "Server port", "3847")
  .option("--model <model>", "Claude model to use", "sonnet")
  .option("--tunnel [name]", "Start a Cloudflare tunnel (pass a name to use a named tunnel with your Cloudflare account)")
  .option("--config <dir>", "Path to .figment/ config directory")
  .option("--from <path>", "Start from an existing file (HTML, screenshot, PDF, etc.)")
  .action(async (opts: { name: string; port: string; model: string; tunnel?: boolean | string; config?: string; from?: string }) => {
    const port = parseInt(opts.port, 10);
    const secret = generateSecret();

    // Find .figment config
    const configDir = opts.config ? resolve(opts.config) : resolve(".figment");
    let systemPromptPath: string;
    try {
      await access(join(configDir, "system-prompt.md"));
      systemPromptPath = join(configDir, "system-prompt.md");
    } catch {
      console.error("No .figment/ config found. Run `figment init` first.");
      process.exit(1);
    }

    // Create isolated session directory in temp
    const sessionDir = mkdtempSync(join(tmpdir(), `figment-${opts.name}-`));
    const versionsDir = join(sessionDir, "versions");
    await mkdir(versionsDir, { recursive: true });

    // Copy design tokens into session dir for Claude to reference
    try {
      const tokensPath = join(configDir, "design-tokens.css");
      await access(tokensPath);
      await copyFile(tokensPath, join(sessionDir, "design-tokens.css"));
    } catch {
      // No tokens — that's okay
    }

    // Seed the prototype
    const HTML_EXTS = [".html", ".htm"];
    let seedPrompt: string | null = null;

    if (opts.from) {
      const fromPath = resolve(opts.from);
      const ext = fromPath.slice(fromPath.lastIndexOf(".")).toLowerCase();

      if (HTML_EXTS.includes(ext)) {
        // HTML file — copy directly as the starting prototype
        await copyFile(fromPath, join(sessionDir, "prototype.html"));
        console.log(`  Seeded from: ${fromPath}`);
      } else {
        // Anything else (image, PDF, etc.) — copy as reference, queue initial prompt
        const refName = "reference" + ext;
        await copyFile(fromPath, join(sessionDir, refName));

        // Write a blank prototype that Claude will replace
        await writeFile(join(sessionDir, "prototype.html"),
          "<!DOCTYPE html><html><head><title>Prototype</title></head><body></body></html>");

        // Queue a seed prompt after the server starts
        seedPrompt = `Look at the file ./${refName} in the current directory. It is a visual reference for the prototype you need to build. Recreate it as a complete HTML prototype in ./prototype.html using the design tokens from ./design-tokens.css. Match the layout, colors, typography, and content as closely as possible. If it's a screenshot of a UI, reproduce the UI. If it's a PDF or document, extract the design intent and create a matching prototype.`;
        console.log(`  Reference file: ${refName} (Claude will recreate it)`);
      }
    } else {
      // No --from: seed a blank prototype with design tokens
      try {
        let tokens = await readFile(join(sessionDir, "design-tokens.css"), "utf8");
        tokens = tokens.replace(/<\/style/gi, "<\\/style");
        const safeName = opts.name.replace(/[<>"'&]/g, "");
        const seed = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName}</title>
  <style>
${tokens}

  /* Prototype styles */
  </style>
</head>
<body>
  <main style="padding: var(--space-12); max-width: 1200px; margin: 0 auto;">
    <h1 class="text-title2">New prototype</h1>
    <p class="text-secondary">Submit a prompt to start designing.</p>
  </main>
</body>
</html>`;
        await writeFile(join(sessionDir, "prototype.html"), seed);
      } catch {
        await writeFile(
          join(sessionDir, "prototype.html"),
          "<!DOCTYPE html><html><head><title>Prototype</title></head><body><p>Submit a prompt to start.</p></body></html>",
        );
      }
    }

    // Write a restrictive Claude Code settings.json to limit file access
    const claudeSettingsDir = join(sessionDir, ".claude");
    await mkdir(claudeSettingsDir, { recursive: true });
    await writeFile(join(claudeSettingsDir, "settings.json"), JSON.stringify({
      permissions: {
        allow: [
          `Read ${sessionDir}/**`,
          `Write ${sessionDir}/**`,
          `Edit ${sessionDir}/**`,
          `Glob ${sessionDir}/**`,
        ],
        deny: [
          "Bash *",
          "Read /**",
          "Write /**",
          "Edit /**",
          "Glob /**",
        ],
      },
    }, null, 2));

    // Initialize components — only snapshot as v1 when seeded from an HTML file
    const versionStore = new VersionStore(sessionDir);
    if (opts.from && HTML_EXTS.includes(opts.from.slice(opts.from.lastIndexOf(".")).toLowerCase())) {
      try {
        await access(join(sessionDir, "prototype.html"));
        await versionStore.snapshot("Seeded from " + (opts.from.split("/").pop() ?? "file"), "system");
      } catch {
        // No prototype yet — fine
      }
    }
    // For --from with non-HTML files, Claude will create v1 when it processes the seed prompt.
    // For no --from, currentVersion stays at 0 until the first user prompt.
    const promptQueue = new PromptQueue();
    const claudeProcess = new ClaudeProcess({
      workDir: sessionDir,
      systemPromptPath,
      model: opts.model,
    });

    const uiHtmlPath = join(ROOT, "ui", "index.html");
    const { app, broadcast } = createServer({
      secret,
      sessionName: opts.name,
      sessionDir,
      versionStore,
      promptQueue,
      claudeProcess,
      uiHtmlPath,
    });

    // Start persistent Claude process, then processing loop
    console.log("  Starting Claude process...");
    await claudeProcess.start();
    console.log("  Claude ready.");
    claudeProcess.on("tool-progress", (progress) => {
      broadcast("tool-progress", progress).catch(() => {});
    });
    startProcessingLoop(promptQueue, claudeProcess, versionStore, broadcast);

    // If seeding from a non-HTML reference, queue the initial reconstruction prompt
    if (seedPrompt) {
      console.log("  Generating prototype from reference...");
      promptQueue.add(seedPrompt, "system");
    }

    // Start HTTP server
    const server = serve({ fetch: app.fetch, port });
    console.log(`\n  figment — ${opts.name}\n`);
    console.log(`  Session dir: ${sessionDir}`);
    console.log(`  Local:       http://localhost:${port}`);

    // Generate host token
    const hostToken = createToken(secret, { role: "editor", name: "host", session: opts.name });
    console.log(`\n  Open:  http://localhost:${port}/?t=${hostToken}`);

    // Start tunnel if requested
    let tunnelProcess: ReturnType<typeof stopTunnel> extends void ? undefined : undefined;
    if (opts.tunnel) {
      const tunnelName = typeof opts.tunnel === "string" ? opts.tunnel : undefined;
      console.log(tunnelName
        ? `\n  Starting named Cloudflare tunnel "${tunnelName}"...`
        : "\n  Starting Cloudflare quick tunnel...");
      try {
        const tunnel = await startTunnel(port, tunnelName);
        tunnelProcess = tunnel.process as never;
        console.log(`  Public: ${tunnel.url}/?t=${hostToken}`);
      } catch (err) {
        console.error(`  Tunnel failed: ${err instanceof Error ? err.message : err}`);
        console.log("  Continuing without tunnel — use localhost only\n");
      }
    }

    console.log(`\n  Generate invite links:`);
    console.log(`    Open the UI and click "Invite", or use:`);
    console.log(`    curl -X POST http://localhost:${port}/api/invite \\`);
    console.log(`      -H "Authorization: Bearer ${hostToken}" \\`);
    console.log(`      -H "Content-Type: application/json" \\`);
    console.log(`      -d '{"role":"editor","name":"Alice"}'\n`);

    // Graceful shutdown
    const cleanup = () => {
      console.log("\n  Shutting down...");
      claudeProcess.stop();
      if (tunnelProcess) stopTunnel(tunnelProcess as never);
      if (typeof (server as { close?: () => void }).close === "function") {
        (server as { close: () => void }).close();
      }
      console.log(`  Session files saved at: ${sessionDir}\n`);
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });

// ---------------------------------------------------------------------------
// figment invite
// ---------------------------------------------------------------------------

program
  .command("invite")
  .description("Generate an invite link for a session")
  .requiredOption("--secret <secret>", "Session secret (printed at start)")
  .requiredOption("--session <name>", "Session name")
  .requiredOption("--role <role>", "Role: editor or viewer")
  .requiredOption("--name <name>", "Display name for the invitee")
  .option("--expires <hours>", "Token expiration in hours", "24")
  .option("--host <url>", "Server URL", "http://localhost:3847")
  .action(async (opts: { secret: string; session: string; role: string; name: string; expires: string; host: string }) => {
    if (opts.role !== "editor" && opts.role !== "viewer") {
      console.error("Role must be 'editor' or 'viewer'");
      process.exit(1);
    }
    const expiresMs = parseFloat(opts.expires) * 60 * 60 * 1000;
    const token = createToken(opts.secret, {
      role: opts.role as "editor" | "viewer",
      name: opts.name,
      session: opts.session,
      exp: Date.now() + expiresMs,
    });
    console.log(`\n  Invite link for ${opts.name} (${opts.role}):`);
    console.log(`  ${opts.host}/?t=${token}\n`);
    console.log(`  Expires in ${opts.expires}h`);
  });

program.parse();
