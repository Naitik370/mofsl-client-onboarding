import { useEffect, useRef } from 'react';
import { dateLabels, formatDate, type Report, type Row } from '../lib';
import { Panel, Table, text } from './shared';

export function CaseDetails({
  row,
  report,
  onClose,
  entries = [],
  history = [],
  onEdit,
  editLabel = 'Edit latest entry',
  mofslOnly = false,
}: {
  row: Row;
  report: Report | null;
  onClose: () => void;
  entries?: Row[];
  history?: Row[];
  onEdit?: () => void;
  editLabel?: string;
  mofslOnly?: boolean;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = drawer.current!;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const stageTat = row.stageTat as Record<string, number | null> | undefined;
  const breaches = row.stageSlaBreaches as Record<string, boolean | null> | undefined;
  const dates = row.processDates as Record<string, string> | undefined;
  return (
    <dialog
      ref={drawer}
      className="case-details-drawer"
      aria-labelledby="case-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="case-details-header">
        <h2 id="case-details-title">Case details · {text(row.referenceId)}</h2>
        <button className="text-btn" onClick={onClose}>
          Close details
        </button>
      </header>
      <Panel>
        <dl className="case-facts">
          <div>
            <dt>Latest status</dt>
            <dd>{text(row.status)}</dd>
          </div>
          <div>
            <dt>Masked PAN</dt>
            <dd>{text(row.panMasked || 'Protected')}</dd>
          </div>
          {onEdit && (
            <div>
              <button className="ghost-btn" onClick={onEdit}>
                {editLabel}
              </button>
            </div>
          )}
          {[
            ['Original inward', formatDate(row.originalInwardDate)],
            ['Resubmissions', row.resubmissionCount],
            ['Current Stage', row.stage],
            ['Derived stage', row.derivedStage],
            ['Stage override', row.stageOverride || 'Automatic'],
            ['Gross TAT', `${text(row.grossTat)}d`],
            ['Net TAT', `${text(row.netTat)}d`],
            ['Query hold', `${text(row.queryHoldDays)}d`],
            ['Touch Count', row.touchCount ?? 'Not recorded'],
            ['Discrepancy type', row.discrepancyType || 'Not recorded'],
            ['Stage 4 outcome', row.stage4ReviewOutcome || 'Not recorded'],
            ['Stage 1 query details', row.stage1QueryDetails || 'Not recorded'],
            ['MOFSL query type', row.mofslQueryType || 'Not recorded'],
            ['Stage 1 queries', row.stage1Queries],
            ['Stage 3 discrepancies / returns', row.stage3Queries],
            ['MOFSL queries', row.stage5Queries],
          ]
            .filter(
              ([label]) =>
                !mofslOnly ||
                ![
                  'Discrepancy type',
                  'Stage 4 outcome',
                  'Stage 1 query details',
                  'Stage 1 queries',
                  'Stage 3 discrepancies / returns',
                ].includes(text(label)),
            )
            .map(([label, value]) => (
              <div key={text(label)}>
                <dt>{text(label)}</dt>
                <dd>{text(value)}</dd>
              </div>
            ))}
        </dl>
        {row.timingUsesAuditDates && (
          <p className="report-note">
            Some events use audit recording dates because business dates were not supplied.
          </p>
        )}
        {Number(row.touchCountBaseline) > 0 && (
          <p className="report-note">
            Touch Count includes {text(row.touchCountBaseline)} legacy entries as a minimum
            baseline. Earlier edits were not tracked.
          </p>
        )}
        <Table headings={['Stage', 'Gross working days', 'SLA days', 'Breach']}>
          {Array.from(
            { length: mofslOnly ? 2 : 6 },
            (_, i) => `Stage ${i + (mofslOnly ? 5 : 1)}`,
          ).map((stage) => (
            <tr key={stage}>
              <td>{stage}</td>
              <td>{stageTat?.[stage] ?? 'Not observed'}</td>
              <td>{report?.stageSlaDays[stage] ?? '-'}</td>
              <td>{breaches?.[stage] == null ? 'Unknown' : breaches[stage] ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </Table>
        <dl className="case-facts">
          {Object.entries(dates || {}).map(([field, value]) => (
            <div key={field}>
              <dt>
                {dateLabels[field] ||
                  (
                    {
                      signedFormReceivedDate: 'Signed form received',
                      submittedToMofslDate: 'Submitted to MOFSL',
                    } as Record<string, string>
                  )[field] ||
                  field}
              </dt>
              <dd>{formatDate(value)}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel
        title="Entry history"
        note="Saved entries, newest first. Status history below includes edits to these entries."
      >
        <Table
          headings={['Request / entry type', 'Status / stage', 'Inward / last saved', 'Notes']}
          empty={!entries.length}
        >
          {entries.map((entry) => (
            <tr key={Number(entry.id)}>
              <td>
                {text(entry.requestId)}
                <small className="subline">{text(entry.entryType)}</small>
              </td>
              <td>
                {text(entry.status)}
                <small className="subline">{text(entry.statusStage || entry.stage)}</small>
              </td>
              <td>
                {formatDate(entry.inwardDate)}
                <small className="subline">{text(entry.updatedAt).replace('T', ' ')}</small>
              </td>
              <td className="history-notes">{text(entry.remarks || entry.queryDetails || '-')}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Status history">
        <Table
          headings={['Business date', 'Status', 'Recorded by', 'Notes']}
          empty={!history.length}
        >
          {history.map((event) => (
            <tr key={Number(event.id)}>
              <td>
                {event.businessDate ? formatDate(event.businessDate) : 'Audit date fallback'}
                <small className="subline">{text(event.timestamp).replace('T', ' ')}</small>
              </td>
              <td>{text(event.status)}</td>
              <td>{text(event.changedBy)}</td>
              <td className="history-notes">{text(event.notes || '-')}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </dialog>
  );
}
