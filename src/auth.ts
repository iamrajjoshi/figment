import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface TokenPayload {
  role: "editor" | "viewer";
  name: string;
  session: string;
  exp: number;
}

/** Generate a 32-byte hex secret for HMAC signing. */
export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Create a signed token from the given payload.
 * Default expiration is 24 hours from now.
 */
export function createToken(
  secret: string,
  payload: {
    role: "editor" | "viewer";
    name: string;
    session: string;
    exp?: number;
  },
): string {
  const full: TokenPayload = {
    role: payload.role,
    name: payload.name,
    session: payload.session,
    exp: payload.exp ?? Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(full));
  const signature = sign(secret, encoded);
  return `${encoded}.${signature}`;
}

/**
 * Verify a token's HMAC signature and expiration.
 * Returns the decoded payload on success, null on failure.
 */
export function verifyToken(secret: string, token: string): TokenPayload | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(secret, encoded);

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return null;
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Escape HTML special characters to prevent XSS in the web UI. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
