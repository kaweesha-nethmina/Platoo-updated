import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SERVICES,
  SESSION_COOKIE,
  decodeJwtPayload,
  sessionCookieOptions,
} from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const resp = await fetch(`${SERVICES.user}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
    body,
  });

  const data = await resp.json();

  if (!resp.ok || !data?.token) {
    return NextResponse.json({ msg: data?.msg || "Google sign-in failed" }, { status: resp.status });
  }

  // Same as login: only an httpOnly cookie leaves the server.
  const payload = decodeJwtPayload(data.token) || {};
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.token, sessionCookieOptions());

  return NextResponse.json({
    user: { id: payload.id, role: payload.role, exp: payload.exp },
  });
}