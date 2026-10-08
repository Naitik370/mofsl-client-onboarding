import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  fieldValidationErrors,
  accountTypes,
  channels,
  cseStatuses,
  dateFields,
  dateLabels,
  discrepancyTypes,
  reviewOutcomes,
  defaults,
  submissionPayload,
  entryTypes,
  mofslStatuses,
  owners,
  validate,
  visibleDateFields,
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
  onDirtyChange?: (dirty: boolean) => void;
};

function initialEntry(user: User, meta: Meta, selected: Row | null) {
  const payload: Record<string, string> = {
    ...defaults(user, meta),
    ...Object.fromEntries(Object.entries(selected || {}).map(([key, value]) => [key, text(value)])),
    autoCaptureDates: 'false',
    autoStatus: 'true',
  };
  if (selected && ['cse', 'mofsl'].includes(user.role)) {
    payload.statusDate = '';
    payload.entryType = user.role === 'cse' ? 'Resubmission' : 'Modification';
    payload.owner = user.role === 'cse' ? 'Operations' : 'MOFSL';
    if (
      user.role === 'cse' &&
      ['Discrepancy Raised to CSE', 'Form Returned to CSE'].includes(text(selected.status))
    ) {
      payload.entryType = 'Discrepancy Resolution';
    }
  }
  return payload;
}

export function CaseEntry({
  user,
  meta,
  cases,
  selected,
  onSaved,
  onClear,
  onError,
  onDirtyChange,
}: Props) {
  const [initialForm] = useState(() => initialEntry(user, meta, selected));
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<ReturnType<typeof fieldValidationErrors>>({
    fields: {},
    general: [],
  });
  const [busy, setBusy] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const stage = meta.statuses.find((item) => item.status === form.status)?.stage || '';
  const visibleDates = visibleDateFields(stage, form.channel, showAllDates);
  const additionalDates = dateFields.slice(7).filter((name) => visibleDates.includes(name));
  const [editingId] = useState(() =>
    selected && ['admin', 'operations'].includes(user.role) ? Number(selected.id) : null,
  );
  const referenceLocked = selected !== null;
  const currentCase =
    cases.find((row) => text(row.referenceId).toLowerCase() === form.referenceId.toLowerCase()) ||
    selected;
  const cseQueryResponse =
    user.role === 'cse' && currentCase?.status === 'Query Raised to CSE - Missing Information';
  const allowedStatuses = meta.statuses
    .filter((item) =>
      user.role === 'cse'
        ? cseQueryResponse
          ? item.status === currentCase?.status || item.status === 'Resubmitted by CSE'
          : form.entryType === 'New'
            ? item.status === 'Request Received from CSE'
            : item.status === currentCase?.status || cseStatuses.includes(item.status)
        : user.role === 'mofsl'
          ? item.status === currentCase?.status || mofslStatuses.includes(item.status)
          : true,
    )
    .map((item) => item.status);

  function changeField(name: string, value: string) {
    setErrors((current) => ({ ...current, fields: { ...current.fields, [name]: [] } }));
    const queryResponse =
      user.role === 'cse' &&
      name === 'referenceId' &&
      cases.find((row) => text(row.referenceId).toLowerCase() === value.trim().toLowerCase())
        ?.status === 'Query Raised to CSE - Missing Information';
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'status' ? { statusDate: '', autoStatus: 'false' } : {}),
      ...(name === 'entryType' && value === 'New' && !referenceLocked ? { referenceId: '' } : {}),
      ...(user.role === 'cse' && name === 'entryType' && value === 'New'
        ? { status: 'Request Received from CSE', statusDate: '' }
        : {}),
      ...(queryResponse
        ? {
            entryType: 'Resubmission',
            status: 'Query Raised to CSE - Missing Information',
            statusDate: '',
          }
        : {}),
    }));
  }

  function showErrors(messages: string[]) {
    const mapped = fieldValidationErrors(messages);
    setErrors(mapped);
    if (
      Object.keys(mapped.fields).some(
        (field) => dateFields.includes(field) && !visibleDates.includes(field),
      )
    )
      setShowAllDates(true);
    if (
      Object.keys(mapped.fields).some((field) =>
        ['accountNumber', 'discrepancyType', 'stage4ReviewOutcome', 'mofslQueryType'].includes(
          field,
        ),
      )
    )
      setShowAllDates(true);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#case-form [aria-invalid="true"]')?.focus(),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const references = new Set(cases.map((row) => text(row.referenceId).toLowerCase()));
    const payload = submissionPayload(form, user, currentCase);
    const errors = validate(payload, meta, references);
    if (
      (user.role === 'cse' && !cseStatuses.includes(payload.status)) ||
      (user.role === 'mofsl' && !mofslStatuses.includes(payload.status))
    )
      errors.push('Latest status: choose an allowed status for this update before saving');
    showErrors(errors);
    if (errors.length) return;

    setBusy(true);
    try {
      const saved = await api<Row>(editingId === null ? '/api/cases' : `/api/cases/${editingId}`, {
        method: editingId === null ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      onDirtyChange?.(false);
      await onSaved(saved);
    } catch (cause) {
      const message = onError(cause);
      showErrors(cause instanceof ApiError ? cause.errors : [message]);
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
    const messages = errors.fields[name] || [];
    const accessibility = {
      id: `case-${name}`,
      'aria-invalid': messages.length ? true : undefined,
      'aria-describedby': messages.length ? `error-${name}` : undefined,
    };
    return (
      <label
        key={name}
        htmlFor={`case-${name}`}
        className={['status', 'queryDetails', 'remarks'].includes(name) ? 'wide' : undefined}
      >
        {label}
        {choices ? (
          <select
            {...accessibility}
            name={name}
            value={form[name] || ''}
            onChange={(event) => changeField(name, event.target.value)}
            required={required}
          >
            {!choices.includes(form[name]) && <option value="">Choose a value</option>}
            {name === 'status'
              ? [...new Set(meta.statuses.map((item) => item.stage))]
                  .filter((group) =>
                    meta.statuses.some(
                      (item) => item.stage === group && choices.includes(item.status),
                    ),
                  )
                  .map((group) => (
                    <optgroup key={group} label={group}>
                      {meta.statuses
                        .filter((item) => item.stage === group && choices.includes(item.status))
                        .map((item) => (
                          <option key={item.status}>{item.status}</option>
                        ))}
                    </optgroup>
                  ))
              : choices.map((value) => <option key={value}>{value}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            {...accessibility}
            name={name}
            rows={3}
            value={form[name] || ''}
            onChange={(event) => changeField(name, event.target.value)}
          />
        ) : (
          <input
            {...accessibility}
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
        {messages.length > 0 && (
          <span id={`error-${name}`} className="field-error">
            {messages.join(' ')}
          </span>
        )}
      </label>
    );
  }

  return (
    <section className="view active">
      <div className="section-heading">
        <h2>
          {referenceLocked
            ? `${editingId ? 'Edit' : 'Add update for'} ${form.referenceId}`
            : 'New operational entry'}
        </h2>
        <span className="required-note">Required fields marked *</span>
      </div>
      <section className="report-panel form-panel">
        <form id="case-form" onSubmit={save} noValidate>
          <fieldset className="form-section">
            <legend>Client</legend>
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
                    ? cseQueryResponse
                      ? ['Resubmission']
                      : entryTypes.slice(0, 3)
                    : entryTypes,
              )}
              {field('clientName', 'Client name *', undefined, 'text', true)}
              {field('pan', 'PAN No *', undefined, 'text', true)}
              {field('accountType', 'Account type', accountTypes)}
              {field('channel', 'Channel', channels)}
              {field('location', 'Location', meta.locations)}
              {field('segment', 'Vertical / Segment', meta.segments)}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Assignment</legend>
            <div className="form-grid">
              {field('rmName', 'RM name')}
              {field('cseName', 'CSE name', undefined, 'text', false, user.role === 'cse')}
              {field('processorName', 'Processor name')}
              {field(
                'owner',
                'Current owner',
                user.role === 'cse' ? ['Operations'] : user.role === 'mofsl' ? ['MOFSL'] : owners,
              )}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Status &amp; dates</legend>
            <div className="form-grid">
              {field('status', 'Latest status *', allowedStatuses, 'text', true)}
              {field('statusDate', 'Status business date', undefined, 'date')}
              <div className="calculated-field">
                <span>Current Stage</span>
                <output>{form.stageOverride || text(selected?.derivedStage) || stage}</output>
                <small>Calculated from saved process fields.</small>
              </div>
              {['admin', 'operations'].includes(user.role) &&
                field('stageOverride', 'Current Stage override', [
                  '',
                  ...Array.from({ length: 6 }, (_, i) => `Stage ${i + 1}`),
                ])}
              {dateFields
                .slice(0, 6)
                .filter(
                  (name) =>
                    visibleDates.includes(name) &&
                    (name !== 'resubmissionDate' || form.entryType !== 'New' || showAllDates),
                )
                .map((name) =>
                  field(
                    name,
                    dateLabels[name] + (name === 'inwardDate' ? ' *' : ''),
                    undefined,
                    'date',
                    name === 'inwardDate',
                  ),
                )}
              {(stage === 'Stage 6' || showAllDates) && field('accountNumber', 'Account number')}
              {(['Stage 3', 'Stage 4'].includes(stage) || showAllDates) &&
                field('discrepancyType', 'Discrepancy type', ['', ...discrepancyTypes])}
              {(stage === 'Stage 4' || showAllDates) &&
                field('stage4ReviewOutcome', 'Stage 4 review outcome', ['', ...reviewOutcomes])}
              {(stage === 'Stage 1' || showAllDates) &&
                field('stage1QueryDetails', 'Stage 1 query details')}
              {(stage === 'Stage 5' || showAllDates) && field('mofslQueryType', 'MOFSL query type')}
              <label className="wide auto-date-control">
                <span>
                  <input
                    type="checkbox"
                    name="autoStatus"
                    checked={form.autoStatus === 'true'}
                    onChange={(event) => changeField('autoStatus', text(event.target.checked))}
                  />{' '}
                  Update status from newly entered process dates and review outcome
                </span>
                <small>
                  Selecting a status manually turns this off. Queries and exceptions require a
                  status selection.
                </small>
              </label>
              {(referenceLocked || form.entryType !== 'New') && (
                <label className="wide auto-date-control">
                  <span>
                    <input
                      type="checkbox"
                      checked={showAllDates}
                      onChange={(event) => setShowAllDates(event.target.checked)}
                    />{' '}
                    Show all process dates
                  </span>
                  <small>Also show the fields for other stages. Hidden values remain saved.</small>
                </label>
              )}
              {additionalDates.length > 0 && (
                <details className="wide process-fields" open>
                  <summary>{showAllDates ? 'All stage dates' : `${stage} dates`}</summary>
                  <div className="process-date-grid">
                    {additionalDates.map((name) =>
                      field(name, dateLabels[name], undefined, 'date'),
                    )}
                  </div>
                </details>
              )}
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
            </div>
            {selected && (
              <p className="report-note">
                Touch Count: {text(selected.touchCount ?? 0)}. Calculated from successful saves.
              </p>
            )}
          </fieldset>
          <fieldset className="form-section">
            <legend>Notes</legend>
            <div className="form-grid">
              {field('queryDetails', 'Query / event details', undefined, 'textarea')}
              {field('remarks', 'Remarks', undefined, 'textarea')}
            </div>
          </fieldset>
          {Object.values(errors.fields).some((messages) => messages.length) && (
            <p className="field-error" role="alert">
              Please check the highlighted fields.
            </p>
          )}
          {errors.general.map((message) => (
            <Errors key={message} message={message} />
          ))}
          <div className="form-actions">
            <button type="button" className="ghost-btn" disabled={busy} onClick={onClear}>
              {selected ? 'Cancel' : 'Clear'}
            </button>
            <button className="primary-btn" disabled={busy}>
              {busy ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
