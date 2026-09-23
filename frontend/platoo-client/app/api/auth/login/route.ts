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

  const resp = await fetch(`${SERVICES.user}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") || "application/json" },
    body,
  });

  const data = await resp.json();

  if (!resp.ok || !data?.token) {
    return NextResponse.json({ msg: data?.msg || "Login failed" }, { status: resp.status });
  }

  // The JWT only ever lives in an httpOnly cookie — it is NOT returned to JS.
  const payload = decodeJwtPayload(data.token) || {};
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.token, sessionCookieOptions());

  return NextResponse.json({
    user: { id: payload.id, role: payload.role, exp: payload.exp },
  });
}