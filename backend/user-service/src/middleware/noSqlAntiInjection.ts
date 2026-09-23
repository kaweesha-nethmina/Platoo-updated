import { NextFunction, Request, Response } from "express";

// (V-03 hygiene) NoSQL-injection guard. Rejects any request whose route params,
// query string, or JSON body smuggles MongoDB operators: object keys starting
// with `$` (e.g. `$ne`, `$gt`, `$where`), keys using dot-notation to target
// nested fields (e.g. `password.$ne`), or string values beginning with `$`.
// Legitimate business fields (emails, prices, addresses) never start with `$`.
function containsNoSqlOperator(value: unknown): boolean {
  if (typeof value === "string") {
    return value.startsWith("$");
  }
  if (Array.isArray(value)) {
    return value.some(containsNoSqlOperator);
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("$")) return true;
      if (key.includes(".")) return true;
      if (containsNoSqlOperator(child)) return true;
    }
  }
  return false;
}

export const rejectNoSqlOperators = (req: Request, res: Response, next: NextFunction): void => {
  for (const source of [req.params, req.query, req.body ?? null]) {
    if (containsNoSqlOperator(source)) {
      res.status(400).json({ msg: "Invalid request payload" });
      return;
    }
  }
  next();
};