import { useState, type ChangeEvent } from 'react';
import {
  api,
  ApiError,
  downloadTemplate,
  parseCsv,
  type ImportRow,
  type Meta,
  type Row,
  type User,
} from '../lib';
import { Errors, Panel, text, type ErrorHandler } from './shared';

type Props = {
  user: User;
  meta: Meta;
  cases: Row[];
  onImported: (count: number) => Promise<void>;
  onError: ErrorHandler;
};

export function BulkUpload({ user, meta, cases, onImported, onError }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = rows.filter((row) => !row.errors.length && !row.imported).length;

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const references = new Set(cases.map((row) => text(row.referenceId).toLowerCase()));
      setRows(parseCsv(await file.text(), user, meta, references));
      setError('');
    } catch (cause) {
      setError(onError(cause));
    } finally {
      input.value = '';
    }
  }

  async function importValid() {
    setBusy(true);
    const results = [...rows];
    let imported = 0;

    try {
      for (let index = 0; index < results.length; index++) {
        const row = results[index];
        if (row.errors.length || row.imported) continue;
        try {
          await api('/api/cases', { method: 'POST', body: JSON.stringify(row.payload) });
          results[index] = { ...row, imported: true };
          imported += 1;
        } catch (cause) {
          results[index] = { ...row, errors: [onError(cause)] };
          if (cause instanceof ApiError && cause.status === 401) break;
        }
      }
      setRows(results);
      await onImported(imported);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view active">
      <div className="section-heading">
        <div>
          <h2>Bulk Upload</h2>
        </div>
      </div>
      <Errors message={error} />
      <div className="upload-grid">
        <section className="report-panel upload-panel">
          <div className="dropzone">
            <strong>Select onboarding CSV</strong>
            <span>
              Required headers: Request ID, Client Name, PAN No, Inward Date, Latest Status.
              Reference ID is required for related entries.
            </span>
            <label className="ghost-btn">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                aria-label="Choose CSV"
                style={{ display: 'block' }}
                onChange={selectFile}
              />
            </label>
          </div>
          <button className="text-btn" onClick={downloadTemplate}>
            Download template
          </button>
        </section>
        <Panel title="Validation Preview" note={`${ready} ready of ${rows.length} rows`}>
          <div className="validation-list">
            {rows.length ? (
              rows.map((row, index) => (
                <div
                  key={index}
                  className={`validation-row ${row.errors.length ? 'invalid' : 'valid'}`}
                >
                  <strong>
                    {row.payload.referenceId ||
                      row.payload.requestId ||
                      row.payload.clientName ||
                      'Unidentified row'}
                  </strong>
                  <span>
                    {row.imported ? 'Imported' : row.errors.join(' | ') || 'Ready to import'}
                  </span>
                </div>
              ))
            ) : (
              <div className="validation-empty">Rows will appear here before import.</div>
            )}
          </div>
          <div className="form-actions">
            <button className="primary-btn" onClick={importValid} disabled={busy || ready === 0}>
              Import valid rows
            </button>
          </div>
        </Panel>
      </div>
    </section>
  );
}
