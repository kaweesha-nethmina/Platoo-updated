# Trust-Boundary Audit — Platoo (user, payment, order services)

Audit date: 2026-09-20 · Scope: `user-service`, `payment-service`, `order-service` only.

## The principle

Never trust data merely because it came through your frontend. Validate input is the
beginner question ("is `price` a number?"). The security-engineer question is:
**"Why does the client have authority to tell the service `price` at all?"** Authoritative
values (prices, amounts, roles, ownership ids, payment state) must be obtained by the
server from a trusted source — the database, an authenticated caller's identity, or a
payment provider — never accepted as caller input.

The secure order flow should therefore accept only the *least-privileged* request:

```
POST /orders
{ "items": [ { "menuItemId": "...", "quantity": 2 } ] }
```

and the server resolves `menuItemId → DB price`, computes `server total`, derives
`user_id` from the verified JWT, and records only server-obtained values.

## Trust-boundary map

```
         UNTRUSTED boundary
   Internet ──► [Browser]
                 │
                 │ UNTRUSTED (JWT bearer, user-controlled body)
                 ▼
           [user-service] ──► DB users        (issues JWT, owns identity/role)
                 │
                 ▼  authenticated caller identity (JWT subject)
           [order-service] ──► DB orders       (ownership checks per row)
                 │
                 │ service identity (internal key)
                 ▼
           [payment-service] ──► order-service fetch ──► Stripe
                 │
                 │ external trust boundary
                 ▼
                 [Stripe]
```

At every boundary ask:
- Who is calling, and how do I know? (JWT subject vs. opaque `user_id` in the body)
- What data can they control? (body fields, localStorage, query/params)
- What data must I obtain independently? (price, amount, delivery fee, order ownership)
- What authority does the caller have? (self vs. owner vs. admin vs. service)
- What if they lie? (client sends price=0, another user's id, status=`paid`)

## Findings

### user-service

| Where | Trusted-from-client | Risk | Status |
|---|---|---|---|
| `register` (`authController.ts:26,32`) | `role` self-assigned | admin escalation | **Fixed V-02** — `PUBLIC_REGISTRATION_ROLES` whitelist; unknown/admin roles downgraded to `user`. |
| `updateUser` (`authController.ts:126-136,164`) | uses JWT identity + params | cross-user account takeover | **Good pattern** — `protect([...])` + owner-or-admin guard. BUT returns the full `user` document incl. `password` hash (V-11 open). |
| `getAllUsers`, `getUserById`, `getRestaurantOwnerByIdPublic` (`auth.ts:50-61`) | route params, no auth | password-hash leakage to any caller (V-06 open); function-level auth missing | Directory traversal/auth middleware outstanding. |

### payment-service

| Where | Trusted-from-client | Risk | Status |
|---|---|---|---|
| `ProductRequest.orderId` (`StripeService.java:34,41`) | only an order reference | — | **Fixed V-03** — amount is not accepted from the client at all. |
| `computeTrustedAmount` (`StripeService.java:90-112`) | recomputed from persisted order | — | **Good** for item price/quantity — item prices are V-07 server-sourced. **Residual:** reads `order.delivery_fee` from the persisted order (line 106), and that value was client-supplied at order creation (see order-service). |

### order-service

| Where | Trusted-from-client | Risk | Status |
|---|---|---|---|
| `createOrder` (`orderController.ts:8,32-33,88`) | `user_id` falls/integrity of order, and the order amount it feeds into payment verification rely on it | spoofing another user | **Open — V-04.** `user_id` must come from the JWT subject, not `req.body`. |
| `createOrder` items (`orderController.ts:9`, `orderService.ts:21-57`) | client `price`/`name`/`total` | price tampering | **Fixed V-07** — `resolveTrustedItems` rebuilds items from `POST /api/menu-items/quote`; client price/total are ignored (`total_amount` recomputed at `orderService.ts:77`). |
| `delivery_fee` (`orderController.ts:11`, `orderService.ts:103`) | client-supplied `delivery_fee` stored verbatim | feeds payment-service total | **Residual.** Server does not resolve it from the restaurant/database; client can inflate/deflate it. |
| `getOrderById` (`orderController.ts:83-105`) | `orderId` from params | Insecure Direct Object Reference — any caller can read any order | **Open — V-04/V-12.** |
| `getOrdersByUserId` (`orderController.ts:178-179`) | `userId` from params | read another user's orders | **Open — V-12.** Must use JWT subject + ownership. |
| `getAllOrders` | none (public listing) | whole-collection leak | **Open — V-12.** |
| `updateOrder` (`orderController.ts:111-124`) | body `user_id`, `status`, `items` | overwrite other users'/status | **Open — V-04/V-12.** |
| `updateOrderStatus` (`orderController.ts:136-160`) | body `status` to any orderId | anyone can mark an order delivered/cancelled | **Open — V-04** function-level authorization. |
| `confirmPayment` (`orderController.ts:194`, `orderService.ts:271+`) | `sessionId` from client | fake payment | **Fixed V-05** — session verified server-side against Stripe; metadata `order_id` must match; idempotent; email only after verification. |

## Bottom line

- Item price / order total / payment amount: **server-verified** (V-03 + V-05 + V-07).
- Roles: **server-whitelisted** (V-02).
- **Everything else is still client-authoritative** (`user_id`, ownership/IDOR on order
  read/update/status/delete, public `GET /orders`, `delivery_fee`) — that is exactly the
  V-04 + V-12 + V-06 + V-11 backlog, and each item is "why does the client have authority
  to tell me this?" rather than "is this input validated?"