import { spawn, type ChildProcess } from "node:child_process";

/**
 * Start a Cloudflare tunnel on the given port.
 * - No name: quick tunnel (free, random URL, no account needed)
 * - With name: named tunnel (requires `cloudflared tunnel create <name>` + Cloudflare account)
 */
export function startTunnel(
  port: number,
  name?: string,
): Promise<{ url: string; process: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const args = name
      ? ["tunnel", "run", "--url", `http://localhost:${port}`, name]
      : ["tunnel", "--url", `http://localhost:${port}`];

    const child = spawn("npx", ["cloudflared", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Tunnel startup timed out after 30 seconds"));
      }
    }, 30_000);

    const handleOutput = (chunk: Buffer): void => {
      if (resolved) return;
      const text = chunk.toString();
      // Quick tunnels print a trycloudflare.com URL
      const quickMatch = text.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/);
      if (quickMatch) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: quickMatch[1], process: child });
        return;
      }
      // Named tunnels print the configured hostname or a "registered" message
      const namedMatch = text.match(/(https:\/\/[a-z0-9.-]+\.[a-z]{2,})/);
      if (name && namedMatch) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: namedMatch[1], process: child });
      }
    };

    child.stdout.on("data", handleOutput);
    child.stderr.on("data", handleOutput);

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to start tunnel: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Tunnel process exited with code ${code} before URL was available`));
      }
    });
  });
}

/** Stop a running tunnel process. */
export function stopTunnel(child: ChildProcess): void {
  child.kill("SIGTERM");
}
