import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

export interface VersionMeta {
  version: number;
  prompt: string;
  author: string;
  timestamp: number;
}

export class VersionStore {
  private sessionsDir: string;
  private versionsDir: string;
  private historyPath: string;
  private prototypePath: string;
  private currentVersion = 0;
  private history: VersionMeta[] = [];
  private initialized = false;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    this.versionsDir = join(sessionsDir, "versions");
    this.historyPath = join(sessionsDir, "history.json");
    this.prototypePath = join(sessionsDir, "prototype.html");
  }

  /** Ensure directories exist and load persisted history. */
  private async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.versionsDir, { recursive: true });

    try {
      const raw = await readFile(this.historyPath, "utf8");
      this.history = JSON.parse(raw) as VersionMeta[];
      this.currentVersion =
        this.history.length > 0
          ? Math.max(...this.history.map((h) => h.version))
          : 0;
    } catch {
      // No history file yet — start fresh
      this.history = [];
      this.currentVersion = 0;
    }
    this.initialized = true;
  }

  /**
   * Snapshot the current prototype.html into the versions directory.
   * Returns metadata for the new version.
   */
  async snapshot(prompt: string, author: string): Promise<VersionMeta> {
    await this.init();
    this.currentVersion++;
    const versionPath = this.getVersionPath(this.currentVersion);
    await copyFile(this.prototypePath, versionPath);

    const meta: VersionMeta = {
      version: this.currentVersion,
      prompt,
      author,
      timestamp: Date.now(),
    };
    this.history.push(meta);
    await writeFile(this.historyPath, JSON.stringify(this.history, null, 2));
    return meta;
  }

  /**
   * Revert prototype.html to a previous version.
   * Creates a new snapshot annotated as a revert.
   */
  async revert(version: number): Promise<VersionMeta> {
    await this.init();
    const versionPath = this.getVersionPath(version);
    await copyFile(versionPath, this.prototypePath);
    return this.snapshot(`Reverted to v${version}`, "system");
  }

  /** Return the full version history. */
  getHistory(): VersionMeta[] {
    return [...this.history];
  }

  /** Return the current version number. */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /** Return the path to the live prototype file. */
  getPrototypePath(): string {
    return this.prototypePath;
  }

  /** Return the path to a specific version snapshot. */
  getVersionPath(version: number): string {
    return join(this.versionsDir, `v${version}.html`);
  }
}
