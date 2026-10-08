import { useState, type FormEvent } from 'react';
import {
  api,
  accountTypes,
  channels,
  cseStatuses,
  dateFields,
  dateLabels,
  discrepancyTypes,
  reviewOutcomes,
  defaults,
  entryTypes,
  mofslStatuses,
  owners,
  validate,
  type Meta,
  type Row,
  type User,
} from '../lib';
import { Errors, text, type ErrorHandler } from './shared';

type Props = {
  user: User;
  meta: Meta;
  cases: Row[];
  selected: Row | null;
  onSaved: (row: Row) => Promise<void>;
  onClear: () => void;
  onError: ErrorHandler;
};

function initialEntry(user: User, meta: Meta, selected: Row | null) {
  const payload: Record<string, string> = {
    ...defaults(user, meta),
    ...Object.fromEntries(Object.entries(selected || {}).map(([key, value]) => [key, text(value)])),
    autoCaptureDates: 'false',
  };
  if (selected && ['cse', 'mofsl'].includes(user.role)) {
    payload.statusDate = '';
    payload.entryType = user.role === 'cse' ? 'Resubmission' : 'Modification';
    payload.status = user.role === 'cse' ? 'Resubmitted by CSE' : mofslStatuses[0];
    payload.owner = user.role === 'cse' ? 'Operations' : 'MOFSL';
  }
  return payload;
}

export function CaseEntry({ user, meta, cases, selected, onSaved, onClear, onError }: Props) {
  const [form, setForm] = useState(() => initialEntry(user, meta, selected));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editingId =
    selected && ['admin', 'operations'].includes(user.role) ? Number(selected.id) : null;
  const referenceLocked = selected !== null;
  const allowedStatuses = meta.statuses
    .filter((item) =>
      user.role === 'cse'
        ? cseStatuses.includes(item.status)
        : user.role === 'mofsl'
          ? mofslStatuses.includes(item.status)
          : true,
    )
    .map((item) => item.status);

  function changeField(name: string, value: string) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'status' ? { statusDate: '' } : {}),
      ...(name === 'entryType' && value === 'New' && !referenceLocked ? { referenceId: '' } : {}),
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const references = new Set(cases.map((row) => text(row.referenceId).toLowerCase()));
    const errors = validate(form, meta, references);
    setError(errors.join(' | '));
    if (errors.length) return;

    setBusy(true);
    try {
      const saved = await api<Row>(editingId === null ? '/api/cases' : `/api/cases/${editingId}`, {
        method: editingId === null ? 'POST' : 'PUT',
        body: JSON.stringify(form),
      });
      await onSaved(saved);
    } catch (cause) {
      setError(onError(cause));
    } finally {
      setBusy(false);
    }
  }

  function field(
    name: string,
    label: string,
    choices?: string[],
    type = 'text',
    required = false,
    readOnly = false,
  ) {
    return (
      <label key={name} className={name === 'status' ? 'wide' : undefined}>
        {label}
        {choices ? (
          <select
            name={name}
            value={form[name] || ''}
            onChange={(event) => changeField(name, event.target.value)}
            required={required}
          >
            {!choices.includes(form[name]) && <option value="">Choose a value</option>}
            {choices.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            min={type === 'number' ? 0 : undefined}
            step={type === 'number' ? 1 : undefined}
            value={form[name] || ''}
            onChange={(event) => changeField(name, event.target.value)}
            required={required}
            readOnly={readOnly}
            placeholder={
              name === 'referenceId'
                ? form.entryType === 'New'
                  ? 'Generated when saved'
                  : 'Existing Reference ID'
                : undefined
            }
          />
        )}
        {name === 'referenceId' && (
          <small>Generated for New entries. Use an existing ID for related entries.</small>
        )}
      </label>
    );
  }

  return (
    <section className="view active">
      <div className="section-heading">
        <div>
          <h2>
            {referenceLocked
              ? `${editingId ? 'Edit' : 'Add update for'} ${form.referenceId}`
              : 'New operational entry'}
          </h2>
        </div>
        <span className="required-note">Required fields marked *</span>
      </div>
      <section className="report-panel form-panel">
        <form id="case-form" onSubmit={save}>
          <div className="form-grid">
            {field(
              'referenceId',
              'Reference ID',
              undefined,
              'text',
              form.entryType !== 'New',
              referenceLocked || form.entryType === 'New',
            )}
            {field('requestId', 'Request ID *', undefined, 'text', true)}
            {field(
              'entryType',
              'Entry type',
              user.role === 'mofsl'
                ? ['Modification']
                : user.role === 'cse'
                  ? entryTypes.slice(0, 3)
                  : entryTypes,
            )}
            {field('clientName', 'Client name *', undefined, 'text', true)}
            {field('pan', 'PAN No *', undefined, 'text', true)}
            {field('accountType', 'Account type', accountTypes)}
            {field('channel', 'Channel', channels)}
            {field('location', 'Location', meta.locations)}
            {field('segment', 'Vertical / Segment', meta.segments)}
            {field('rmName', 'RM name')}
            {field('cseName', 'CSE name', undefined, 'text', false, user.role === 'cse')}
            {field('processorName', 'Processor name')}
            {field(
              'owner',
              'Current owner',
              user.role === 'cse' ? ['Operations'] : user.role === 'mofsl' ? ['MOFSL'] : owners,
            )}
            {dateFields
              .slice(0, 6)
              .map((name) =>
                field(
                  name,
                  dateLabels[name] + (name === 'inwardDate' ? ' *' : ''),
                  undefined,
                  'date',
                  name === 'inwardDate',
                ),
              )}
            {field('accountNumber', 'Account number')}
            {field('status', 'Latest status *', allowedStatuses, 'text', true)}
            {field('statusDate', 'Status business date', undefined, 'date')}
            <label>
              Touch Count
              <input value={text(selected?.touchCount ?? 0)} readOnly />
              <small>Calculated from successful case saves.</small>
            </label>
            {field('discrepancyType', 'Discrepancy type', ['', ...discrepancyTypes])}
            {field('stage4ReviewOutcome', 'Stage 4 review outcome', ['', ...reviewOutcomes])}
            {field('stage1QueryDetails', 'Stage 1 query details')}
            {field('mofslQueryType', 'MOFSL query type')}
            <details className="wide process-fields">
              <summary>Stage dates</summary>
              <div className="form-grid">
                {dateFields
                  .slice(7)
                  .map((name) => field(name, dateLabels[name], undefined, 'date'))}
              </div>
            </details>
            {user.role === 'admin' && (
              <label className="wide auto-date-control">
                <span>
                  <input
                    name="autoCaptureDates"
                    type="checkbox"
                    checked={form.autoCaptureDates === 'true'}
                    onChange={(event) =>
                      changeField('autoCaptureDates', text(event.target.checked))
                    }
                  />{' '}
                  Auto-capture related date
                </span>
                <small>
                  The API fills the related blank date with the server date. Supplied dates are
                  preserved.
                </small>
              </label>
            )}
            {['queryDetails', 'remarks'].map((name) => (
              <label key={name} className="wide">
                {name === 'queryDetails' ? 'Query / event details' : 'Remarks'}
                <textarea
                  name={name}
                  rows={3}
                  value={form[name] || ''}
                  onChange={(event) => changeField(name, event.target.value)}
                />
              </label>
            ))}
          </div>
          <Errors message={error} />
          <div className="form-actions">
            <button type="button" className="ghost-btn" disabled={busy} onClick={onClear}>
              Clear
            </button>
            <button className="primary-btn" disabled={busy}>
              Save entry
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
