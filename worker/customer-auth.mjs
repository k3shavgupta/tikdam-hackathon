import { verifyToken } from '@clerk/backend';
import { clerkConfig } from '../server/clerk-config.mjs';
import { safeError } from './http.mjs';

// Customer sessions never grant Cloudflare Access owner permissions.
export async function requireCustomer(request, env) {
  const config = clerkConfig(env);
  if (!config.enabled) throw safeError('AUTH_UNAVAILABLE', 503, 'Account sign-in is not configured. You can continue as a guest.');
  const authorization = request.headers.get('Authorization') || '';
  // Explicit bearer tokens avoid stale cookies and browser handshake redirects
  // on API requests. getToken() refreshes the short-lived Clerk session token.
  if (!/^Bearer [^\s]{1,16384}$/.test(authorization)) throw safeError('SIGN_IN_REQUIRED', 401, 'Sign in to use your account.');
  try {
    const allowed = String(env.APP_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    const origin = new URL(request.url).origin;
    if (!allowed.includes(origin)) throw Error();
    // The lower-level verifier supports a public PEM without Clerk admin access.
    // Validate session-only claims and issuer as well as its signature and dates.
    const claims = await verifyToken(authorization.slice(7), { secretKey: env.CLERK_SECRET_KEY, jwtKey: env.CLERK_JWT_KEY, authorizedParties: [origin] });
    if (!/^user_[a-zA-Z0-9]+$/.test(claims.sub || '') || !/^sess_[a-zA-Z0-9]+$/.test(claims.sid || '') || claims.sts === 'pending' || claims.iss !== config.frontendOrigin || claims.azp !== origin) throw Error();
    return { userId: claims.sub };
  } catch {
    throw safeError('SIGN_IN_REQUIRED', 401, 'Your account session could not be verified. Sign in again.');
  }
}
