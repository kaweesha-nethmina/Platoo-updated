/**
 * NOTIFICATION-SERVICE input validation & sanitation.
 *
 * NOTIF-05 (CWE-80/CWE-93): user-controlled fields (customer name/address,
 * order id) are embedded into emails. sanitizeEmailField() removes CR/LF so
 * header-injection sequences (\r\nBcc: ...) can never escape the text body, and
 * the mailer builds messages from sanitised values with a fixed subject/from.
 */

export interface OrderDetails {
  id: string;
  customer: { name: string; address: string };
  total: number;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const validateOrderDetails = (details: unknown): details is OrderDetails => {
  if (typeof details !== 'object' || details === null) return false;

  const obj = details as Record<string, unknown>;
  const id = obj['id'];
  const customer = obj['customer'];
  const total = obj['total'];

  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return false;
  if (!isFiniteNumber(total) || total < 0 || total > 1_000_000_000) return false;
  if (typeof customer !== 'object' || customer === null) return false;

  const name = (customer as Record<string, unknown>)['name'];
  const address = (customer as Record<string, unknown>)['address'];
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) return false;
  if (typeof address !== 'string' || address.length === 0 || address.length > 256) return false;

  return true;
};

/**
 * Strips carriage returns / line feeds so user text cannot smuggle email
 * headers ("\r\nBcc: attacker@..."). Consecutive \r\n are removed, a lone \n
 * between words becomes a space (readability), all other characters are kept.
 */
export const sanitizeEmailField = (value: string): string =>
  value.replace(/[\r\n]+/g, (m) => (m.includes('\r') ? '' : ' '));