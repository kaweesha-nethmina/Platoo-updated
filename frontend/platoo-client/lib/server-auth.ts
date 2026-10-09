// Server-side shared helpers for the httpOnly-cookie auth bridge (V-08 fix).
// This module MUST only be imported from Next.js route handlers / server code:
// the JWT lives in an httpOnly cookie and is never exposed to client JS.

export const SESSION_COOKIE = "platoo_token";

// Backend service base URLs, read from the Next.js server environment.
export const SERVICES: Record<string, string> = {
  user: process.env.USER_SERVICE_URL ?? "http://localhost:4000",
  order: process.env.ORDER_SERVICE_URL ?? "http://localhost:3008",
  pay: process.env.PAYMENT_SERVICE_URL ?? "http://localhost:8081",
};

const SESSION_MAX_AGE = 60 * 60 * 24; // 1 day — matches the JWT expiry

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.COOKIE_SECURE === "true",
  };
}

// Decode the payload segment of a JWT without verifying it (server-side only,
// used to extract the id/role claims the client pages render). The token is
// still verified by the backend services whenever it is presented.
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}