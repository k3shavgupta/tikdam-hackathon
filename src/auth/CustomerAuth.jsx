import React, { createContext, useContext, useEffect, useState } from 'react';
import { ClerkProvider, SignIn, SignUp, SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/react';

const AuthAvailability = createContext(false);
const appearance = {
  variables: {
    colorPrimary: '#267a42', colorBackground: '#fffdf8', colorForeground: '#121212',
    colorInputBackground: '#fffbeb', colorInputText: '#121212',
    fontFamily: '"Space Grotesk", Arial, sans-serif', borderRadius: '6px',
  },
  elements: { card: 'tikdam-auth-card', formButtonPrimary: 'tikdam-auth-submit', headerTitle: 'tikdam-auth-title', userButtonTrigger: 'tikdam-user-button' },
};

export function CustomerAuthProvider({ children }) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch('/api/auth/config', { signal: controller.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(response => { if (!response.ok) throw Error(); return response.json(); })
      .then(data => setConfig(data.enabled && typeof data.publishableKey === 'string' ? data : { enabled: false }))
      .catch(() => setConfig({ enabled: false }))
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);
  if (!config) return <main className="loading"><p role="status">Opening Tikdam…</p></main>;
  if (!config.enabled) return children;
  return <ClerkProvider publishableKey={config.publishableKey} appearance={appearance}
    signInUrl="/app/sign-in" signUpUrl="/app/sign-up" afterSignOutUrl="/app"
    signInForceRedirectUrl="/app" signUpForceRedirectUrl="/app" telemetry={false}>
    <AuthAvailability.Provider value={true}>{children}</AuthAvailability.Provider>
  </ClerkProvider>;
}

export function AccountControls() {
  return useContext(AuthAvailability) ? <ConnectedAccountControls /> : null;
}

function ConnectedAccountControls() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [verified, setVerified] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setVerified(null);
    if (isLoaded && isSignedIn) {
      getToken().then(token => {
        if (!token) throw Error();
        return fetch('/api/account', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      }).then(async response => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (active) setVerified(data.userId === userId);
      }).catch(() => { if (active) setVerified(false); });
    }
    return () => { active = false; };
  }, [isLoaded, isSignedIn, userId, getToken, attempt]);
  if (!isLoaded) return <span className="account-status" role="status">Loading account…</span>;
  if (!isSignedIn) return <div className="account-controls">
    <SignInButton mode="modal"><button className="account-signin">Sign in</button></SignInButton>
    <SignUpButton mode="modal"><button className="account-signup">Sign up</button></SignUpButton>
  </div>;
  return <div className="account-controls">
    <span className="account-status" role="status">{verified === true ? 'Signed in' : verified === false ? 'Account verification failed' : 'Verifying account…'}</span>
    {verified === false && <button onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    <UserButton />
  </div>;
}

export function CustomerAuthPage({ signUp = false }) {
  const enabled = useContext(AuthAvailability);
  return <>
    <header><a className="brand" href="/" aria-label="Tikdam home"><img src="/brand/logo.svg" alt="Tikdam" /></a><a href="/app">Continue as guest →</a></header>
    <main className="auth-page">
      <section className="auth-intro">
        <p className="eyebrow">Your pre-purchase reality check</p>
        <h1>{signUp ? 'Your next purchase.\nA little clearer.' : 'Welcome back\nto Tikdam.'}</h1>
        <p>Ask a question, check the details, and know what evidence to keep.</p>
        <p className="auth-note">An account is optional. Checks and conversations still stay in this browser session; signing in does not save them yet.</p>
        <a href="/app">Start a check as a guest ↗</a>
      </section>
      <section className="auth-form" aria-label={signUp ? 'Create an account' : 'Sign in'}>
        {enabled ? <AuthForm signUp={signUp} /> : <div className="auth-unavailable" role="status"><h2>Guest checks are ready</h2><p>Account sign-in is temporarily unavailable. You can still use Tikdam without an account.</p><button onClick={() => window.location.reload()}>Retry sign-in</button><a href="/app">Continue as guest →</a></div>}
        <p className="auth-note">Clerk manages your sign-in and account details. Invoice contents are not sent to Clerk.</p>
      </section>
    </main>
  </>;
}

function AuthForm({ signUp }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <p role="status">Loading secure sign-in…</p>;
  if (isSignedIn) return <div className="auth-unavailable"><h2>You’re signed in</h2><UserButton /><a href="/app">Open Tikdam →</a></div>;
  return signUp ? <SignUp routing="path" path="/app/sign-up" /> : <SignIn routing="path" path="/app/sign-in" />;
}
