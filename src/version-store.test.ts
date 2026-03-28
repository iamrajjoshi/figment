import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VersionStore } from "./version-store.js";

describe("VersionStore", () => {
  let tmpDir: string;
  let store: VersionStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "figment-vs-"));
    store = new VersionStore(tmpDir);
    // Seed a prototype.html so snapshot() can copy it
    await writeFile(join(tmpDir, "prototype.html"), "<h1>Hello</h1>");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("snapshot", () => {
    it("creates a version file and increments counter", async () => {
      const meta = await store.snapshot("make it blue", "alice");

      expect(meta.version).toBe(1);
      expect(meta.prompt).toBe("make it blue");
      expect(meta.author).toBe("alice");
      expect(meta.timestamp).toBeGreaterThan(0);

      // Version file should exist
      const versionContent = await readFile(
        store.getVersionPath(1),
        "utf8",
      );
      expect(versionContent).toBe("<h1>Hello</h1>");
    });

    it("increments version on successive snapshots", async () => {
      const v1 = await store.snapshot("first", "alice");
      const v2 = await store.snapshot("second", "bob");
      const v3 = await store.snapshot("third", "carol");

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it("persists history to a JSON file", async () => {
      await store.snapshot("first", "alice");
      await store.snapshot("second", "bob");

      const raw = await readFile(join(tmpDir, "history.json"), "utf8");
      const history = JSON.parse(raw);
      expect(history).toHaveLength(2);
      expect(history[0].prompt).toBe("first");
      expect(history[1].prompt).toBe("second");
    });
  });

  describe("getHistory", () => {
    it("returns all versions", async () => {
      await store.snapshot("a", "alice");
      await store.snapshot("b", "bob");

      const history = store.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it("returns a copy (not the internal array)", async () => {
      await store.snapshot("a", "alice");
      const history = store.getHistory();
      history.pop();
      expect(store.getHistory()).toHaveLength(1);
    });
  });

  describe("getCurrentVersion", () => {
    it("starts at 0 for a fresh store", async () => {
      // Force init by calling snapshot then checking a new store
      const freshStore = new VersionStore(
        await mkdtemp(join(tmpdir(), "figment-vs-fresh-")),
      );
      expect(freshStore.getCurrentVersion()).toBe(0);
    });

    it("reflects the latest version after snapshots", async () => {
      expect(store.getCurrentVersion()).toBe(0);

      await store.snapshot("v1", "alice");
      expect(store.getCurrentVersion()).toBe(1);

      await store.snapshot("v2", "bob");
      expect(store.getCurrentVersion()).toBe(2);
    });
  });

  describe("revert", () => {
    it("copies old version back to prototype and creates a new version", async () => {
      // v1: original content
      await store.snapshot("original", "alice");

      // Modify prototype
      await writeFile(join(tmpDir, "prototype.html"), "<h1>Changed</h1>");
      await store.snapshot("changed", "bob");

      // Revert to v1
      const meta = await store.revert(1);
      expect(meta.version).toBe(3);
      expect(meta.prompt).toBe("Reverted to v1");
      expect(meta.author).toBe("system");

      // prototype.html should have v1 content
      const content = await readFile(join(tmpDir, "prototype.html"), "utf8");
      expect(content).toBe("<h1>Hello</h1>");
    });

    it("records the revert in history", async () => {
      await store.snapshot("v1", "alice");
      await writeFile(join(tmpDir, "prototype.html"), "<h1>v2</h1>");
      await store.snapshot("v2", "bob");
      await store.revert(1);

      const history = store.getHistory();
      expect(history).toHaveLength(3);
      expect(history[2].prompt).toBe("Reverted to v1");
    });
  });

  describe("path helpers", () => {
    it("getPrototypePath returns correct path", () => {
      expect(store.getPrototypePath()).toBe(join(tmpDir, "prototype.html"));
    });

    it("getVersionPath returns correct path for a version number", () => {
      expect(store.getVersionPath(5)).toBe(
        join(tmpDir, "versions", "v5.html"),
      );
    });
  });

  describe("persistence across instances", () => {
    it("new store instance loads history from disk", async () => {
      await store.snapshot("first", "alice");
      await store.snapshot("second", "bob");

      // Create a new store pointing at the same directory
      const store2 = new VersionStore(tmpDir);
      // Trigger init by calling snapshot
      await writeFile(join(tmpDir, "prototype.html"), "<h1>v3</h1>");
      const meta = await store2.snapshot("third", "carol");

      expect(meta.version).toBe(3);
      expect(store2.getHistory()).toHaveLength(3);
      expect(store2.getCurrentVersion()).toBe(3);
    });
  });

  describe("empty directory", () => {
    it("works with a fresh directory that has no history", async () => {
      const freshDir = await mkdtemp(join(tmpdir(), "figment-vs-empty-"));
      const freshStore = new VersionStore(freshDir);

      // Seed prototype so snapshot can copy it
      await writeFile(join(freshDir, "prototype.html"), "<p>new</p>");
      const meta = await freshStore.snapshot("initial", "system");

      expect(meta.version).toBe(1);
      expect(freshStore.getHistory()).toHaveLength(1);

      // Verify versions dir was created
      await expect(
        access(join(freshDir, "versions")),
      ).resolves.toBeUndefined();

      await rm(freshDir, { recursive: true, force: true });
    });
  });
});
