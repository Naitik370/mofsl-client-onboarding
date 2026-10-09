import { useState } from 'react';
import {
  closed,
  excluded,
  formatDate,
  latestCaseEntries,
  type Meta,
  type Report,
  type Row,
  type User,
} from '../lib';
import { routeHash } from '../navigation';
import { dimensionLabels, Panel, Status, Table, text } from './shared';
import type { DateRange } from '../useWorkspace';
import { CaseDetails } from './CaseDetails';
import { PerformanceCharts } from './PerformanceCharts';

export function Overview({
  report,
  meta,
  filters,
  onFilter,
  mofslOnly = false,
  onEdit,
  editLabel = 'Edit',
}: {
  report: Report | null;
  meta: Meta;
  filters: DateRange;
  onFilter: (range: DateRange) => void;
  mofslOnly?: boolean;
  onEdit?: (referenceId: string) => void;
  editLabel?: string;
}) {
  const [dates, setDates] = useState(filters);
  return (
    <section className="view active">
      <div className="report-toolbar">
        <div className="report-title">
          <strong>Account Opening Performance</strong>
          <span>
            {report
              ? `Updated ${new Date(report.generatedAt).toLocaleString('en-IN')}`
              : 'Loading latest report...'}
          </span>
        </div>
        <label>
          Inward from
          <input
            type="date"
            value={dates.start}
            onChange={(event) => setDates({ ...dates, start: event.target.value })}
          />
        </label>
        <label>
          Inward to
          <input
            type="date"
            value={dates.end}
            onChange={(event) => setDates({ ...dates, end: event.target.value })}
          />
        </label>
        <button className="ghost-btn" onClick={() => onFilter({ ...dates })}>
          Apply
        </button>
        <button
          className="text-btn"
          onClick={() => {
            const empty = { start: '', end: '' };
            setDates(empty);
            onFilter(empty);
          }}
        >
          Clear
        </button>
      </div>
      {report && (
        <Dashboard
          report={report}
          meta={meta}
          mofslOnly={mofslOnly}
          onEdit={onEdit}
          editLabel={editLabel}
        />
      )}
    </section>
  );
}

export function Performance({
  report,
  dimension,
  onDimension,
  mofslOnly = false,
}: {
  report: Report | null;
  dimension: string;
  onDimension: (dimension: string) => void;
  mofslOnly?: boolean;
}) {
  const columns = [
    ['name', dimensionLabels[dimension]],
    ['total', 'Total'],
    ['open', 'Open'],
    ['closed', 'Closed'],
    ['rft', 'RFT'],
    ['nrft', 'NRFT'],
    ['rftPercent', 'RFT %'],
    ['averageNetTat', 'Avg Net TAT'],
    ['slaBreaches', 'SLA Breaches'],
    ['exceptions', 'Exceptions'],
    ['stage1Queries', 'Stage 1 queries'],
    ['stage3Queries', 'Stage 3 queries'],
    ['stage5Queries', 'Stage 5 queries'],
    ['cseQueries', 'CSE-side queries'],
    ['mofslQueries', 'MOFSL-side queries'],
    ['stageSlaBreaches', 'Stage SLA cases'],
  ].filter(
    ([key]) => !mofslOnly || !['stage1Queries', 'stage3Queries', 'cseQueries'].includes(key),
  );
  return (
    <section className="view active performance-view">
      <div className="section-heading">
        <div>
          <h2>Compare performance</h2>
          <p>Charts and detailed MIS by {dimensionLabels[dimension]}.</p>
        </div>
        <div className="segmented" role="group" aria-label="MIS dimension">
          {Object.entries(dimensionLabels).map(([key, label]) => (
            <button
              key={key}
              className={dimension === key ? 'active' : ''}
              aria-pressed={dimension === key}
              onClick={() => onDimension(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {report ? (
        <PerformanceCharts
          report={report}
          dimension={dimensionLabels[dimension]}
          mofslOnly={mofslOnly}
        />
      ) : (
        <p role="status">Loading performance charts...</p>
      )}
      <Panel
        title="Detailed performance MIS"
        note="The table contains the exact values behind the charts and additional SLA metrics."
      >
        <Table headings={columns.map(([, label]) => label)} empty={!report?.groups.length}>
          {report?.groups.map((row) => (
            <tr key={text(row.name)}>
              {columns.map(([key]) => (
                <td key={key}>
                  {text(row[key])}
                  {key === 'rftPercent' ? '%' : key === 'averageNetTat' ? 'd' : ''}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Panel>
    </section>
  );
}

export function CaseRegister({
  cases,
  metrics,
  meta,
  user,
  onEdit,
  detailReference = null,
  onDetails,
  history = [],
}: {
  cases: Row[];
  metrics: Report | null;
  meta: Meta;
  user: User;
  onEdit: (row: Row) => void;
  detailReference?: string | null;
  onDetails: (reference: string | null) => void;
  history?: Row[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const derived = new Map((metrics?.cases || []).map((row) => [row.caseId, row]));
  const current = latestCaseEntries(cases);
  const details = current.find(
    (row) => text(row.referenceId).toLowerCase() === detailReference?.toLowerCase(),
  );
  const visible = current.filter(
    (row) =>
      (!search || Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase())) &&
      (!statusFilter || row.status === statusFilter),
  );

  return (
    <section className="view active case-register">
      <div className="section-heading">
        <div>
          <h2>Case Register</h2>
          <p>{current.length} cases · Latest saved status per case</p>
        </div>
        <div className="entry-tools">
          <input
            placeholder="Search reference, client, PAN..."
            aria-label="Search cases"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filter cases by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {meta.statuses.map((item) => (
              <option key={item.status}>{item.status}</option>
            ))}
          </select>
        </div>
      </div>
      <Panel>
        <Table
          headings={[
            'Actions',
            'Reference',
            'Client',
            'Inward',
            'Latest status',
            'Queries',
            'RFT',
            'Net TAT',
          ]}
          empty={!visible.length}
        >
          {visible.map((row) => {
            const calculated = derived.get(row.caseId) || row;
            return (
              <tr
                key={text(row.referenceId)}
                className="case-row"
                tabIndex={0}
                aria-label={`Open details for ${text(row.referenceId)}`}
                onClick={() => onDetails(text(row.referenceId))}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
                    event.preventDefault();
                    onDetails(text(row.referenceId));
                  }
                }}
              >
                <td className="case-actions" onClick={(event) => event.stopPropagation()}>
                  <a
                    className="text-btn"
                    href={routeHash('cases', text(row.referenceId))}
                    onClick={(event) => {
                      event.preventDefault();
                      onDetails(text(row.referenceId));
                    }}
                  >
                    Details
                  </a>
                  {user.role !== 'viewer' && (
                    <button className="text-btn" onClick={() => onEdit(row)}>
                      {['cse', 'mofsl'].includes(user.role) ? 'Add update' : 'Edit'}
                    </button>
                  )}
                </td>
                <td>
                  <strong>{text(row.referenceId)}</strong>
                  <small className="subline">{text(calculated.stage || row.stage)}</small>
                </td>
                <td>
                  {text(row.clientName)}
                  <small className="subline">
                    {text(calculated.panMasked || row.panMasked || 'Protected')}
                  </small>
                </td>
                <td>{formatDate(calculated.originalInwardDate || row.inwardDate)}</td>
                <td>
                  <Status value={row.status} />
                </td>
                <td>{text(calculated.queryCount ?? '-')}</td>
                <td>
                  <span className={`rft ${calculated.rft === 'RFT' ? 'yes' : 'no'}`}>
                    {text(calculated.rft || '-')}
                  </span>
                </td>
                <td>{text(calculated.netTat ?? '-')}d</td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {details && (
        <CaseDetails
          row={{ ...details, ...derived.get(details.caseId) }}
          report={metrics}
          mofslOnly={user.role === 'mofsl'}
          entries={cases.filter((row) => row.caseId === details.caseId)}
          history={history.filter((row) => text(row.referenceId) === text(details.referenceId))}
          onEdit={user.role === 'viewer' ? undefined : () => onEdit(details)}
          editLabel={['cse', 'mofsl'].includes(user.role) ? 'Add update' : 'Edit latest entry'}
          onClose={() => onDetails(null)}
        />
      )}
      {detailReference && !details && metrics && (
        <p role="status">This case is unavailable or outside your access.</p>
      )}
    </section>
  );
}

export function AuditHistory({ history }: { history: Row[] }) {
  return (
    <section className="view active">
      <div className="section-heading">
        <div>
          <h2>Audit History</h2>
        </div>
      </div>
      <Panel>
        <Table
          headings={[
            'Timestamp',
            'Business date',
            'Reference',
            'Previous',
            'New status',
            'Stage',
            'Changed by',
            'Owner',
            'Notes',
          ]}
          empty={!history.length}
        >
          {history.map((row) => (
            <tr key={Number(row.id)}>
              <td>{new Date(text(row.timestamp)).toLocaleString('en-IN')}</td>
              <td>{row.businessDate ? formatDate(row.businessDate) : 'Audit date fallback'}</td>
              <td>
                <strong>{text(row.referenceId)}</strong>
              </td>
              <td>{text(row.previous || '-')}</td>
              <td>
                <Status value={row.status} />
              </td>
              <td>{text(row.stage)}</td>
              <td>{text(row.changedBy)}</td>
              <td>{text(row.owner)}</td>
              <td className="notes-cell">{text(row.notes)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </section>
  );
}

export function Dashboard({
  report,
  meta,
  mofslOnly = false,
  onEdit,
  editLabel = 'Edit',
}: {
  report: Report;
  meta: Meta;
  mofslOnly?: boolean;
  onEdit?: (referenceId: string) => void;
  editLabel?: string;
}) {
  const s = report.summary;
  const kpis = [
    ['Open cases', s.open, '', ''],
    ['Closed cases', s.closed, '', 'good'],
    ['RFT', `${s.rftPercent}%`, `${s.rft} RFT / ${s.nrft} NRFT`, 'good'],
    ['Avg net TAT', `${s.averageNetTat}d`, `Gross ${s.averageGrossTat}d`, ''],
    [
      'SLA breaches',
      s.slaBreaches,
      `Above ${meta.slaDays} working days`,
      s.slaBreaches ? 'bad' : 'good',
    ],
    [
      'Exceptions',
      s.rejected + s.cancelled,
      `${s.rejected} rejected, ${s.cancelled} cancelled`,
      'bad',
    ],
  ];
  const pipeline = report.pipeline.filter(
    (row) => !mofslOnly || ['Stage 5', 'Stage 6'].includes(row.stage),
  );
  const max = Math.max(1, ...pipeline.map((x) => x.count));
  const attention = report.cases
    .filter(
      (row) =>
        ![...closed, ...excluded].includes(text(row.status)) &&
        (row.slaBreach || row.status === 'On Hold'),
    )
    .slice(0, 10);
  return (
    <>
      <div className="kpi-strip">
        {kpis.map(([label, value, note, cls]) => (
          <div key={text(label)} className={`kpi ${cls}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel title="Stage Pipeline">
          <div className="pipeline-list">
            {pipeline.map((row) => (
              <div key={row.stage} className="pipeline-row">
                <span>{row.stage}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
                </div>
                <strong>{row.count}</strong>
                <small>
                  {row.averageAging}d case · {row.averageStageTat ?? '-'}d stage
                </small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Quality & Exceptions">
          <div className="quality-summary">
            <div className="quality-meter">
              <div>
                <strong>{s.rftPercent}%</strong>
                <span>Right first time</span>
              </div>
              <div className="meter">
                <i style={{ width: `${s.rftPercent}%` }} />
              </div>
            </div>
            <div className="quality-grid">
              {[
                ['NRFT rate', `${s.nrftPercent}%`],
                ['On hold', s.onHold],
                ['Rejected', s.rejected],
                ['Cancelled', s.cancelled],
              ].map(([label, value]) => (
                <div key={text(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="report-note">
              Rejected and cancelled cases are excluded from final RFT and average TAT.
            </p>
          </div>
        </Panel>
      </div>
      <Panel title="Cases Requiring Attention">
        <Table
          headings={[
            ...(onEdit ? ['Actions'] : []),
            'Reference',
            'Client',
            'Location',
            'CSE',
            'Stage',
            'Net TAT',
            'Owner',
            'Status',
          ]}
          empty={!attention.length}
        >
          {attention.map((row) => (
            <tr key={Number(row.caseId)}>
              {onEdit && (
                <td className="case-actions">
                  <button className="text-btn" onClick={() => onEdit(text(row.referenceId))}>
                    {editLabel}
                  </button>
                </td>
              )}
              <td>
                <strong>{text(row.referenceId)}</strong>
              </td>
              <td>{text(row.clientName)}</td>
              <td>{text(row.location)}</td>
              <td>{text(row.cseName || 'Unassigned')}</td>
              <td>{text(row.stage)}</td>
              <td>
                <strong className={row.slaBreach ? 'danger-text' : ''}>{text(row.netTat)}d</strong>
              </td>
              <td>{text(row.owner)}</td>
              <td>
                <Status value={row.status} />
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
