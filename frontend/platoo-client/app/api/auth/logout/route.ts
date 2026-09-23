import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SERVICES } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  // V-14: revoke the token server-side FIRST so an exfiltrated copy can no
  // longer authenticate — only then drop the cookie locally. Best effort: a
  // failure here still logs the user out of this browser.
  if (token) {
    try {
      await fetch(`${SERVICES.user}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("[api/auth/logout] server-side revocation failed:", error);
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ msg: "Logged out" });
}