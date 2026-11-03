import React, {useEffect, useRef, useState} from 'react';

let loader;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      function fail() {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Verification could not load.'));
      }
      const timeout = setTimeout(fail, 15000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.turnstile) resolve(window.turnstile);
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    }).catch(error => {
      loader = null;
      throw error;
    });
  }
  return loader;
}

export function TurnstileChallenge({siteKey, action, onToken, resetKey = 0}) {
  const container = useRef(null);
  const callbacks = useRef(onToken);
  callbacks.current = onToken;
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false, widget = null, instance;
    function unavailable(message) {
      if (disposed) return;
      callbacks.current?.('');
      setError(message);
    }
    callbacks.current?.('');
    setError('');
    if (!siteKey) return;
    loadTurnstile().then(api => {
      if (disposed) return;
      instance = api;
      widget = api.render(container.current, {
        sitekey: siteKey, action, theme: 'light', size: 'flexible',
        callback(token) {
          if (disposed) return;
          setError('');
          callbacks.current?.(token);
        },
        'expired-callback': () => unavailable('Verification expired.'),
        'error-callback': () => unavailable('Verification failed.')
      });
    }).catch(error => unavailable(error.message));
    return () => {
      disposed = true;
      if (widget !== null) instance?.remove(widget);
    };
  }, [siteKey, action, resetKey, attempt]);

  if (!siteKey) return <p className="tk-note">AI verification is not configured. Manual entry remains available.</p>;
  return <div className="tk-challenge">
    <div ref={container} aria-label="Verification challenge"/>
    {error && <>
      <p role="alert" className="tk-error">{error} Your draft is still here.</p>
      <button type="button" className="tk-secondary" onClick={() => setAttempt(n => n + 1)}>Retry verification</button>
    </>}
  </div>;
}
