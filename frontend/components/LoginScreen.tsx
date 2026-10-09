import { useState, type FormEvent } from 'react';
import { Errors, type ErrorHandler } from './shared';

type Props = {
  sessionError: string;
  onSignIn: (credentials: Record<string, FormDataEntryValue>) => Promise<void>;
  onError: ErrorHandler;
};

export function LoginScreen({ sessionError, onSignIn, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await onSignIn(credentials);
    } catch (cause) {
      setError(onError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="login-screen" id="login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">MO</div>
          <div>
            <strong>MOFSL Client Onboarding</strong>
          </div>
        </div>
        <div className="login-copy">
          <h1>Sign in to continue</h1>
        </div>
        <form id="login-form" onSubmit={submit}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <Errors message={error || sessionError} />
          <button className="primary-btn login-btn" disabled={busy}>
            Sign in
          </button>
        </form>
        <small className="login-foot">Session expires after 12 hours of access.</small>
      </div>
    </section>
  );
}
