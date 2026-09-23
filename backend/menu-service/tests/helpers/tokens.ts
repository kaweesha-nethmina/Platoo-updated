/**
 * Test JWT helpers (menu-service integration suites).
 * Signs tokens with the SAME JWT_SECRET used by the jest suites (.env.test:
 * JWT_SECRET=test-only-jwt-secret-for-platoo-suites) and the SAME payload
 * shape as user-service authController.ts: jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' }).
 * NOTE: menu-service has NO auth middleware, so these tokens are used to
 * PROVE that authenticated-request behaviour is not enforced (auth-gap evidence)
 * rather than to obtain 401/403.
 */
import crypto from 'crypto';

const b64url = (obj: object): string =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

export const TEST_JWT_SECRET = 'test-only-jwt-secret-for-platoo-suites';

export interface SignOptions {
  expiresInSeconds?: number;
  secret?: string;
  iat?: number;
}

export const signToken = (
  payload: Record<string, unknown>,
  opts: SignOptions = {}
): string => {
  const {
    expiresInSeconds = 86400,
    secret = TEST_JWT_SECRET,
    iat = Math.floor(Date.now() / 1000),
  } = opts;
  const body = { ...payload, iat, exp: iat + expiresInSeconds };
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const data = `${header}.${b64url(body)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
};

/** Valid, cryptographically-correct token signed with the test JWT_SECRET. */
export const validUserToken = (id = 'it-menu-user-1', role = 'user'): string =>
  signToken({ id, role });

/** Same scheme but already expired (-1h) — would be rejected by any real verifier. */
export const expiredToken = (): string =>
  signToken({ id: 'expired-user', role: 'user' }, { expiresInSeconds: -3600 });

/** Valid header/payload but tampered signature — rejected by any real verifier. */
export const tamperedToken = (): string => {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url({ id: 'attacker', role: 'admin', iat: 1, exp: 9999999999 });
  return `${header}.${body}.invalidsignature`;
};