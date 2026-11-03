// Only the publishable key is sent to the browser. Runtime configuration lets
// staging and production use separate Clerk instances with the same build.
export function clerkConfig(env = {}) {
  const publishableKey = String(env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();
  try {
    if (!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(publishableKey)) throw Error();
    const encoded = publishableKey.replace(/^pk_(test|live)_/, '');
    const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    if (!decoded.endsWith('$')) throw Error();
    const host = decoded.slice(0, -1);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) throw Error();
    if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) throw Error();
    return { enabled: true, publishableKey, frontendOrigin: `https://${host}` };
  } catch {
    return { enabled: false, publishableKey: null, frontendOrigin: null };
  }
}
