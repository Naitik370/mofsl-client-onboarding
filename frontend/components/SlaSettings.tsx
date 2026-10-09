import { useEffect, useState, type FormEvent } from 'react';
import { api, type SlaSettings as Settings } from '../lib';
import { Errors, type ErrorHandler } from './shared';

export function SlaSettings({
  onSaved,
  onError,
}: {
  onSaved: () => Promise<void>;
  onError: ErrorHandler;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Settings>('/api/settings')
      .then((settings) => {
        if (active)
          setValues(
            Object.fromEntries(
              Object.entries({ slaDays: settings.slaDays, ...settings.stageSlaDays }).map(
                ([key, value]) => [key, String(value)],
              ),
            ),
          );
      })
      .catch((cause) => {
        if (active) setError(onError(cause));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [onError]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(values) });
      await onSaved();
    } catch (cause) {
      setError(onError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="report-panel form-panel">
      <form onSubmit={save}>
        <div className="form-grid">
          {['slaDays', ...Array.from({ length: 6 }, (_, i) => `stage${i + 1}`)].map((key, i) => (
            <label key={key}>
              {i === 0 ? 'Overall SLA (working days)' : `Stage ${i} SLA (working days)`}
              <input
                type="number"
                min={1}
                max={3650}
                step={1}
                required
                value={values[key] || ''}
                disabled={busy}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <Errors message={error} />
        <button className="primary-btn" disabled={busy || !values.slaDays}>
          Save SLA settings
        </button>
      </form>
    </section>
  );
}
