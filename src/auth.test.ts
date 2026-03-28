import { describe, it, expect } from "vitest";
import {
  generateSecret,
  createToken,
  verifyToken,
  escapeHtml,
} from "./auth.js";

describe("generateSecret", () => {
  it("returns a 64-character hex string", () => {
    const secret = generateSecret();
    expect(secret).toHaveLength(64);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a unique value each call", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
  });
});

describe("createToken / verifyToken", () => {
  const secret = generateSecret();
  const session = "test-session";

  it("creates a valid token with default 24h expiration", () => {
    const before = Date.now();
    const token = createToken(secret, {
      role: "editor",
      name: "alice",
      session,
    });
    const after = Date.now();

    const payload = verifyToken(secret, token);
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe("editor");
    expect(payload!.name).toBe("alice");
    expect(payload!.session).toBe(session);

    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    expect(payload!.exp).toBeGreaterThanOrEqual(expectedMin);
    expect(payload!.exp).toBeLessThanOrEqual(expectedMax);
  });

  it("respects a custom expiration", () => {
    const customExp = Date.now() + 60_000;
    const token = createToken(secret, {
      role: "viewer",
      name: "bob",
      session,
      exp: customExp,
    });

    const payload = verifyToken(secret, token);
    expect(payload).not.toBeNull();
    expect(payload!.exp).toBe(customExp);
  });

  it("returns null for an expired token", () => {
    const token = createToken(secret, {
      role: "editor",
      name: "alice",
      session,
      exp: Date.now() - 1000,
    });

    expect(verifyToken(secret, token)).toBeNull();
  });

  it("returns null for a tampered payload", () => {
    const token = createToken(secret, {
      role: "viewer",
      name: "eve",
      session,
    });

    // Replace the payload portion with one that has role: "editor"
    const [_encodedPayload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        role: "editor",
        name: "eve",
        session,
        exp: Date.now() + 86_400_000,
      }),
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const tampered = `${tamperedPayload}.${signature}`;
    expect(verifyToken(secret, tampered)).toBeNull();
  });

  it("returns null for an invalid signature", () => {
    const token = createToken(secret, {
      role: "editor",
      name: "alice",
      session,
    });

    const [encodedPayload] = token.split(".");
    const badSig = "a".repeat(64);
    expect(verifyToken(secret, `${encodedPayload}.${badSig}`)).toBeNull();
  });

  it("returns null for a wrong secret", () => {
    const token = createToken(secret, {
      role: "editor",
      name: "alice",
      session,
    });

    const otherSecret = generateSecret();
    expect(verifyToken(otherSecret, token)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(verifyToken(secret, "")).toBeNull();
  });

  it("returns null for string without dot separator", () => {
    expect(verifyToken(secret, "nodothere")).toBeNull();
  });

  it("returns null for malformed base64 payload", () => {
    expect(verifyToken(secret, "!!!invalid!!!.abcdef1234567890")).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a>b")).toBe("a&gt;b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("escapes all special characters in one string", () => {
    expect(escapeHtml(`<div class="x" data-a='y'>&</div>`)).toBe(
      "&lt;div class=&quot;x&quot; data-a=&#39;y&#39;&gt;&amp;&lt;/div&gt;",
    );
  });

  it("returns unchanged string when no special characters", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});
