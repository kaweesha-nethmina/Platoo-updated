import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  // The BFF presents the httpOnly-cookie JWT to user-service and returns only
  // the safe profile. The token is verified server-side by user-service.
  const resp = await fetch(`${process.env.USER_SERVICE_URL ?? "http://localhost:4000"}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = await resp.json();

  if (!resp.ok || !data?.user) {
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ user: null });
  }

  return NextResponse.json(data);
}