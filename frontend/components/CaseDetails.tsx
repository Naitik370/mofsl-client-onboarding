import { dateLabels, formatDate, type Report, type Row } from '../lib';
import { Panel, Table, text } from './shared';

export function CaseDetails({
  row,
  report,
  onClose,
}: {
  row: Row;
  report: Report | null;
  onClose: () => void;
}) {
  const stageTat = row.stageTat as Record<string, number | null> | undefined;
  const breaches = row.stageSlaBreaches as Record<string, boolean | null> | undefined;
  const dates = row.processDates as Record<string, string> | undefined;
  return (
    <Panel title={`Case details · ${row.referenceId}`}>
      <button className="text-btn" onClick={onClose}>
        Close details
      </button>
      <dl className="case-facts">
        {[
          ['Original inward', formatDate(row.originalInwardDate)],
          ['Resubmissions', row.resubmissionCount],
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
        ].map(([label, value]) => (
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
          Touch Count includes {text(row.touchCountBaseline)} legacy entries as a minimum baseline.
          Earlier edits were not tracked.
        </p>
      )}
      <Table headings={['Stage', 'Gross working days', 'SLA days', 'Breach']}>
        {Array.from({ length: 6 }, (_, i) => `Stage ${i + 1}`).map((stage) => (
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
  );
}
