import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SERVICES, SESSION_COOKIE } from "@/lib/server-auth";

// Server-to-server proxy (V-08). Browser JS never holds the JWT: requests go to
// this same-origin handler, which attaches `Authorization: Bearer <httpOnly-cookie>`
// and forwards to the backend services. Only the allowlisted services below are
// reachable, so this cannot be used as an open proxy.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ service: string; path: string[] }> };

// Path prefix each service expects. user/order mount everything under `/api`;
// pay uses a mixed layout (`/product/v1/...` and `/api/verify-payment/...`).
const PATH_PREFIX: Record<string, string> = {
  user: "/api",
  order: "/api",
  pay: "",
};

const IDEMPOTENCY_HEADERS = ["idempotency-key", "x-idempotency-key"];

async function forward(req: NextRequest, ctx: RouteContext, method: string) {
  const { service, path } = await ctx.params;

  const base = service ? SERVICES[service] : undefined;
  const prefix = service ? PATH_PREFIX[service] : undefined;
  if (!base || prefix === undefined) {
    return NextResponse.json({ msg: "Unknown service" }, { status: 404 });
  }

  if (!Array.isArray(path) || path.some((p) => p.includes("..") || p.includes("%2e") || p.includes("%00"))) {
    return NextResponse.json({ msg: "Invalid path" }, { status: 400 });
  }

  const current = new URL(req.url);
  const target = `${base}${prefix}/${path.join("/")}${current.search}`;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  for (const h of IDEMPOTENCY_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let resp: Response;
  if (method === "GET" || method === "DELETE") {
    resp = await fetch(target, { method, headers, cache: "no-store" });
  } else {
    const body = await req.text();
    resp = await fetch(target, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  }

  const text = await resp.text();
  const responseHeaders: Record<string, string> = {
    "Content-Type": resp.headers.get("content-type") || "application/json",
  };

  return new NextResponse(text, {
    status: resp.status,
    headers: responseHeaders,
  });
}

export const GET = (req: NextRequest, ctx: RouteContext) => forward(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: RouteContext) => forward(req, ctx, "POST");
export const PUT = (req: NextRequest, ctx: RouteContext) => forward(req, ctx, "PUT");
export const PATCH = (req: NextRequest, ctx: RouteContext) => forward(req, ctx, "PATCH");
export const DELETE = (req: NextRequest, ctx: RouteContext) => forward(req, ctx, "DELETE");