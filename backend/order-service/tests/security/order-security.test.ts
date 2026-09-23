/**
 * End-to-end security tests for the ORDER / CHECKOUT flow.
 *
 * These hit the RUNNING services (order-service, user-service, menu-service)
 * like a malicious client would. Run after `bash start-all.sh`:
 *
 *   npm run test:security
 *
 * Requires:
 *   - order-service  on :3008 (JWT_SECRET set & matching user-service)
 *   - user-service   on :4000
 *   - menu-service   on :3001 (with seeded restaurants + menu items)
 *
 * Environment overrides (all optional):
 *   ORDER_SERVICE_URL, USER_SERVICE_URL, MENU_SERVICE_URL
 *
 * The rate-limit test runs LAST because orders are counted against a shared
 * per-IP budget (default 30 order-requests per minute).
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const ORDER = process.env.ORDER_SERVICE_URL ?? "http://localhost:3008";
const USER = process.env.USER_SERVICE_URL ?? "http://localhost:4000";
const MENU = process.env.MENU_SERVICE_URL ?? "http://localhost:3001";

interface TestUser {
  token: string;
  id: string;
  email: string;
}

interface Fixture {
  restaurant_id: string;
  menu_item_id: string;
  unit_price: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Merge header groups onto the JSON defaults (variadic: a single-arg helper
// previously dropped extra header objects passed as a 2nd argument).
const j = (...parts: Array<Record<string, string>>) =>
  parts.reduce<Record<string, string>>((acc, part) => ({ ...acc, ...part }), {
    "Content-Type": "application/json",
  });

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerUser(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${crypto.randomUUID()}@example.com`;
  const payload = {
    name: `Test ${prefix}`,
    email,
    password: "Test1234!",
    phone: "0712345678",
    address: "123 Test Road, Colombo",
    role: "user",
  };
  const res = await fetch(`${USER}/api/auth/register`, {
    method: "POST",
    headers: j(),
    body: JSON.stringify(payload),
  });
  assert.strictEqual(res.status, 201, `register failed (${res.status}) ${await debugBody(res)}`);

  const loginRes = await fetch(`${USER}/api/auth/login`, {
    method: "POST",
    headers: j(),
    body: JSON.stringify({ email, password: payload.password }),
  });
  assert.strictEqual(loginRes.status, 200, `login failed (${loginRes.status})`);
  const { token } = (await loginRes.json()) as { token: string };
  assert.ok(token, "login did not return a token");

  // Extract user id from the JWT payload (same algorithm the services use).
  const [, payloadB64] = token.split(".");
  const payloadJson = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  return { token, id: payloadJson.id as string, email };
}

async function loadFixture(): Promise<Fixture> {
  const res = await fetch(`${MENU}/api/restaurants`);
  assert.strictEqual(res.status, 200, `menu /api/restaurants failed (${res.status})`);
  const restaurants = (await res.json()) as Array<{ _id: string }>;
  const restaurant = restaurants.find((r) => r && r._id);
  assert.ok(restaurant?._id, "no restaurant fixture available");

  const itemsRes = await fetch(
    `${MENU}/api/menu-items/restaurant/${restaurant._id}`
  );
  assert.strictEqual(itemsRes.status, 200, `menu items fetch failed (${itemsRes.status})`);
  const items = (await itemsRes.json()) as Array<{ _id: string; price: number }>;
  const item = items.find((i) => i && i._id && typeof i.price === "number");
  assert.ok(item?._id, "no menu item fixture available");

  return {
    restaurant_id: restaurant._id,
    menu_item_id: item._id,
    unit_price: item.price,
  };
}

async function createOrder(
  token: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<Response> {
  return fetch(`${ORDER}/api/orders`, {
    method: "POST",
    headers: j(bearer(token), ...(headers ? [headers] : [])),
    body: JSON.stringify(body),
  });
}

function validOrderBody(fixture: Fixture, overrides?: Record<string, unknown>) {
  return {
    restaurant_id: fixture.restaurant_id,
    items: [{ menu_item_id: fixture.menu_item_id, quantity: 2 }],
    delivery_address: "456 Happiness Lane, Colombo 07",
    phone: "0771234567",
    email: `customer-${crypto.randomUUID()}@example.com`,
    location: { lat: 6.9271, lng: 79.8612 },
    ...(overrides ?? {}),
  };
}

// Read a response body without consuming the original (for debug messages).
async function debugBody(res: Response): Promise<string> {
  const text = await res.clone().text();
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("order / checkout security", () => {
  let userA: TestUser;
  let userB: TestUser;
  let fixture: Fixture;
  const createdOrderIds: Array<{ id: string; token: string }> = [];
  const createdUserIds: Array<{ id: string; token: string }> = [];

  before(async () => {
    userA = await registerUser("alice");
    userB = await registerUser("bob");
    createdUserIds.push({ id: userA.id, token: userA.token }, { id: userB.id, token: userB.token });
    fixture = await loadFixture();
  });

  after(async () => {
    // Best-effort cleanup of test data.
    for (const { id, token } of createdOrderIds) {
      try {
        await fetch(`${ORDER}/api/orders/${id}`, {
          method: "DELETE",
          headers: bearer(token),
        });
      } catch {
        /* best effort */
      }
    }
    for (const { id, token } of createdUserIds) {
      try {
        await fetch(`${USER}/api/auth/delete/${id}`, {
          method: "DELETE",
          headers: bearer(token),
        });
      } catch {
        /* best effort */
      }
    }
  });

  it("rejects order creation without auth (401)", async () => {
    const res = await fetch(`${ORDER}/api/orders`, {
      method: "POST",
      headers: j(),
      body: JSON.stringify(validOrderBody(fixture)),
    });
    assert.strictEqual(res.status, 401);
  });

  it("ignores client-supplied prices and computes totals server-side", async () => {
    // Attacker tries to pay 1 cent for a real LKR-priced item.
    const res = await createOrder(
      userA.token,
      validOrderBody(fixture, {
        items: [
          { menu_item_id: fixture.menu_item_id, quantity: 2, price: 0.01, name: "FREE" },
        ],
      })
    );
    assert.strictEqual(res.status, 201, await debugBody(res));
    const { order } = (await res.json()) as { order: any };

    const unitPrice = order.items[0].price;
    assert.strictEqual(unitPrice, fixture.unit_price, "server did not use catalog price");

    const subtotal = Math.round(fixture.unit_price * 2 * 100) / 100;
    const fee = order.delivery_fee;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const expectedTotal = Math.round((subtotal + fee + tax) * 100) / 100;
    assert.strictEqual(order.total_amount, expectedTotal, "server total does not match recomputation");
    assert.ok(order.tax >= 0);

    createdOrderIds.push({ id: order._id, token: userA.token });
  });

  it("rejects mass-assignment of identity/status/totals (severe price tampering)", async () => {
    const res = await createOrder(
      userA.token,
      validOrderBody(fixture, {
        user_id: userB.id, // try to register the order to another account
        total_amount: 1,
        delivery_fee: -9000,
        status: "delivered",
        payment_status: "paid",
        paid_at: "2020-01-01T00:00:00.000Z",
      })
    );
    // The craft attempt must be rejected outright, never silently coerced.
    assert.strictEqual(res.status, 400, await debugBody(res));
    const body = (await res.json()) as { failed?: string[] };
    for (const f of ["user_id", "total_amount", "delivery_fee", "status", "payment_status", "paid_at"]) {
      assert.ok((body.failed ?? []).includes(f), `field ${f} was not rejected`);
    }
  });

  it("enforces ownership (IDOR): another user cannot read/update/delete an order", async () => {
    const res = await createOrder(userA.token, validOrderBody(fixture));
    assert.strictEqual(res.status, 201, await debugBody(res));
    const { order } = (await res.json()) as { order: any };
    createdOrderIds.push({ id: order._id, token: userA.token });

    // userB must be blocked on all object-level operations.
    const readRes = await fetch(`${ORDER}/api/orders/${order._id}`, {
      headers: bearer(userB.token),
    });
    assert.strictEqual(readRes.status, 403, "IDOR read allowed");

    const updateRes = await fetch(`${ORDER}/api/orders/${order._id}`, {
      method: "PUT",
      headers: j(bearer(userB.token)),
      body: JSON.stringify(validOrderBody(fixture)),
    });
    assert.strictEqual(updateRes.status, 403, "IDOR update allowed");

    const delRes = await fetch(`${ORDER}/api/orders/${order._id}`, {
      method: "DELETE",
      headers: bearer(userB.token),
    });
    assert.strictEqual(delRes.status, 403, "IDOR delete allowed");
  });

  it("rejects invalid quantities", async () => {
    for (const quantity of [0, -3, 1000, 1.5]) {
      const res = await createOrder(
        userA.token,
        validOrderBody(fixture, {
          items: [{ menu_item_id: fixture.menu_item_id, quantity }],
        })
      );
      assert.strictEqual(res.status, 400, `quantity ${quantity} was accepted`);
    }
  });

  it("rejects malformed / NoSQL-injection menu_item_id", async () => {
    for (const badId of ["not-an-object-id", "$gt: ''", '{"$ne": null}', ".."]) {
      const res = await createOrder(
        userA.token,
        validOrderBody(fixture, {
          items: [{ menu_item_id: badId, quantity: 1 }],
        })
      );
      assert.strictEqual(res.status, 400, `menu_item_id ${badId} was accepted`);
    }
  });

  it("rejects forbidden server-owned fields with 400", async () => {
    const res = await createOrder(
      userA.token,
      validOrderBody(fixture, {
        order_id: "ORD999",
        createdAt: "pwned",
      })
    );
    assert.strictEqual(res.status, 400, "forbidden field was accepted");
  });

  it("does not leak internal error details", async () => {
    // Give a restaurant_id that exists but no matching delivery fee path: any
    // server rejection must be a generic message, never raw stack/DB text.
    const res = await createOrder(
      userA.token,
      validOrderBody(fixture, { restaurant_id: "000000000000000000000000" })
    );
    const text = await debugBody(res);
    assert.ok(
      text.length < 300,
      "error response too verbose (possible details leak)"
    );
    assert.ok(!/at\s+\w+\s+\(/i.test(text), "stack frame leaked in response");
    assert.ok(!/mongo|mongoose|mongodb|mongooseerror/i.test(text), "DB internals leaked");
  });

  it("stores user-supplied text faithfully yet stays render-safe (XSS policy)", async () => {
    const payload = validOrderBody(fixture, {
      delivery_address: '<img src=x onerror=alert(1)> "test"',
    });
    const res = await createOrder(userA.token, payload);
    assert.strictEqual(res.status, 201, await debugBody(res));
    const { order } = (await res.json()) as { order: any };
    // Verified control: the checkout/success pages render this field through
    // React text nodes (no dangerouslySetInnerHTML), so it cannot execute.
    assert.ok(
      order.delivery_address.includes("<img"),
      "expected the literal value to persist server-side for React to escape"
    );
    createdOrderIds.push({ id: order._id, token: userA.token });
  });

  it("returns meaningful 404 for a non-existent order (no 500)", async () => {
    const res = await fetch(`${ORDER}/api/orders/${crypto.randomUUID()}`, {
      headers: bearer(userA.token),
    });
    assert.strictEqual(res.status, 404);
  });

  it("is idempotent: same Idempotency-Key never mints a duplicate order", async () => {
    const key = `it-${crypto.randomUUID()}`;
    const body = validOrderBody(fixture);

    const first = await createOrder(userA.token, body, { "Idempotency-Key": key });
    assert.strictEqual(first.status, 201, await debugBody(first));
    const firstJson = (await first.json()) as { order: any };

    const second = await createOrder(userA.token, body, { "Idempotency-Key": key });
    assert.strictEqual(second.status, 200, await debugBody(second));
    const secondJson = (await second.json()) as { order: any };

    assert.strictEqual(
      String(secondJson.order._id),
      String(firstJson.order._id),
      "idempotent replay created a different order"
    );
    createdOrderIds.push({ id: firstJson.order._id, token: userA.token });
  });

  it("rate limits order creation (run LAST)", async () => {
    const body = validOrderBody(fixture);
    let limited = false;
    for (let i = 0; i < 45; i++) {
      const res = await createOrder(userA.token, body, {
        "Idempotency-Key": `rl-${crypto.randomUUID()}`,
      });
      if (res.status === 429) {
        limited = true;
        break;
      }
      // The limiter shared window is tightly coupled to real usage; treat
      // unexpected failures as assertion failures, allowing 200/201/400.
      assert.ok([200, 201, 400].includes(res.status), `unexpected status ${res.status}`);
    }
    assert.ok(limited, "rate limit was never hit within 45 requests");
  });
});