export type User = {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'operations' | 'cse' | 'mofsl' | 'viewer';
};
export type Row = Record<
  string,
  string | number | boolean | null | Record<string, string | number | boolean | null>
>;
export type Meta = {
  today?: string;
  statuses: { status: string; stage: string; requiredFields?: Record<string, string> }[];
  locations: string[];
  segments: string[];
  slaDays: number;
};
export type Report = {
  generatedAt: string;
  summary: Record<string, number>;
  pipeline: {
    stage: string;
    count: number;
    averageAging: number;
    averageStageTat: number | null;
  }[];
  groups: Row[];
  cases: Row[];
  slaDays: number;
  stageSlaDays: Record<string, number>;
};
export type SlaSettings = { slaDays: number; stageSlaDays: Record<string, number> };
export const discrepancyTypes = [
  'Document Missing',
  'Signature Mismatch',
  'Incomplete Details',
  'Other',
];
export const reviewOutcomes = ['Found in Order', 'Still Pending'];
export type ImportRow = { payload: Record<string, string>; errors: string[]; imported?: boolean };
export const cseStatuses = [
  'Under Review by Operations',
  'Request Received from CSE',
  'Resubmitted by CSE',
  'Discrepancy Resolution Received',
  'Resubmitted Form Received - Under Review',
];
export const mofslStatuses = [
  'Query Raised by MOFSL',
  'Query Resolved - Resubmitted to MOFSL',
  'Account Opened',
  'Communication Sent - Case Closed',
];
export const entryTypes = ['New', 'Resubmission', 'Discrepancy Resolution', 'Modification'];
export const accountTypes = ['Individual', 'HUF', 'Corporate', 'NRI', 'Minor'];
export const channels = ['Physical', 'Digital'];
export const owners = ['Operations', 'CSE', 'MOFSL'];
export const closed = ['Account Opened', 'Communication Sent - Case Closed'];
export const excluded = ['Rejected', 'Cancelled by Client'];
const queryStatuses = [
  'Query Raised to CSE - Missing Information',
  'Discrepancy Raised to CSE',
  'Form Returned to CSE',
  'Query Raised by MOFSL',
];
export const dateLabels: Record<string, string> = {
  inwardDate: 'Inward date',
  outwardDate: 'Outward date',
  resubmissionDate: 'Resubmission date',
  signedFormDate: 'Signed form received date',
  submittedDate: 'Submitted to MOFSL date',
  accountOpeningDate: 'Account opening date',
  statusDate: 'Status business date',
  stage1QueryRaisedDate: 'Stage 1 query raised date',
  stage1ResubmissionDate: 'Stage 1 resubmission date',
  formPreparedDate: 'Form prepared date',
  physicalFormSubmittedDate: 'Physical form submitted to CSE date',
  digitalFormSentDate: 'Digital form sent to client date',
  discrepancyRaisedDate: 'Discrepancy raised date',
  formReturnedToCseDate: 'Form returned to CSE date',
  discrepancyResolutionReceivedDate: 'Discrepancy resolution received date',
  resubmittedFormReceivedDate: 'Resubmitted form received date',
  mofslQueryRaisedDate: 'MOFSL query raised date',
  mofslQueryResolvedDate: 'MOFSL query resolved date',
  communicationSentDate: 'Communication sent date',
};
export const dateFields = Object.keys(dateLabels);
const stageDateFields: Record<string, string[]> = {
  'Stage 1': ['resubmissionDate', 'stage1QueryRaisedDate', 'stage1ResubmissionDate'],
  'Stage 2': [
    'outwardDate',
    'formPreparedDate',
    'physicalFormSubmittedDate',
    'digitalFormSentDate',
  ],
  'Stage 3': ['signedFormDate', 'discrepancyRaisedDate', 'formReturnedToCseDate'],
  'Stage 4': [
    'resubmissionDate',
    'discrepancyResolutionReceivedDate',
    'resubmittedFormReceivedDate',
  ],
  'Stage 5': ['submittedDate', 'mofslQueryRaisedDate', 'mofslQueryResolvedDate'],
  'Stage 6': ['accountOpeningDate', 'communicationSentDate'],
};

export function visibleDateFields(stage: string, channel: string, showAll = false) {
  if (showAll) return dateFields;
  return ['inwardDate', 'statusDate', ...(stageDateFields[stage] || [])].filter(
    (name) =>
      (name !== 'physicalFormSubmittedDate' || channel === 'Physical') &&
      (name !== 'digitalFormSentDate' || channel === 'Digital') &&
      (name !== 'formReturnedToCseDate' || channel === 'Physical'),
  );
}

const automaticDateFields: Record<string, string> = {
  'Request Received from CSE': 'inwardDate',
  'Physical Form Submitted to CSE': 'outwardDate',
  'Digital Form Sent to Client': 'outwardDate',
  'Resubmitted by CSE': 'resubmissionDate',
  'Discrepancy Resolution Received': 'resubmissionDate',
  'Resubmitted Form Received - Under Review': 'resubmissionDate',
  'Signed Form Received from CSE': 'signedFormDate',
  'Submitted to MOFSL': 'submittedDate',
  'Account Opened': 'accountOpeningDate',
  'Query Raised to CSE - Missing Information': 'stage1QueryRaisedDate',
  'Application Form Under Preparation': 'formPreparedDate',
  'Discrepancy Raised to CSE': 'discrepancyRaisedDate',
  'Form Returned to CSE': 'formReturnedToCseDate',
  'Query Raised by MOFSL': 'mofslQueryRaisedDate',
  'Query Resolved - Resubmitted to MOFSL': 'mofslQueryResolvedDate',
  'Communication Sent - Case Closed': 'communicationSentDate',
};
export class ApiError extends Error {
  readonly errors: string[];
  constructor(
    message: string,
    public status: number,
    errors?: string[],
  ) {
    super(message);
    this.errors = errors || [message];
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      (body.errors || [body.error || 'Request failed']).join(' | '),
      response.status,
      body.errors || [body.error || 'Request failed'],
    );
  return body;
}

export function latestCaseEntries(entries: Row[]): Row[] {
  const latest = new Map<string, Row>();
  for (const entry of [...entries].sort(
    (a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) ||
      Number(b.id) - Number(a.id),
  )) {
    const reference = String(entry.referenceId || '').toLowerCase();
    if (!latest.has(reference)) latest.set(reference, entry);
  }
  return [...latest.values()];
}

export function fieldValidationErrors(messages: string[]): {
  fields: Record<string, string[]>;
  general: string[];
} {
  const labels: Record<string, string[]> = {
    ...Object.fromEntries(Object.entries(dateLabels).map(([field, label]) => [field, [label]])),
    referenceId: ['Reference ID', 'Create the original case'],
    requestId: ['Request ID'],
    clientName: ['Client name'],
    pan: ['PAN No'],
    entryType: ['Entry type'],
    status: ['Latest status'],
    accountType: ['Account type'],
    channel: ['Channel', 'Physical form submission', 'Digital form submission'],
    owner: ['Current owner'],
    location: ['Location'],
    segment: ['Segment'],
    discrepancyType: ['Discrepancy type'],
    stage4ReviewOutcome: ['Stage 4 review outcome', 'A pending Stage 4 review'],
    stageOverride: ['Current stage override'],
    queryDetails: ['Query / event details'],
    accountNumber: ['Account number', 'A closed case requires account number'],
    accountOpeningDate: ['Account opening date', 'A closed case requires account number'],
    physicalFormSubmittedDate: ['Physical form submitted to CSE date', 'Physical submission date'],
    digitalFormSentDate: ['Digital form sent to client date', 'Digital submission date'],
  };
  const fields: Record<string, string[]> = {};
  const general: string[] = [];
  for (const message of messages) {
    const matching = Object.entries(labels).filter(([field, names]) =>
      [field, ...names].some((label) => message.toLowerCase().startsWith(label.toLowerCase())),
    );
    if (!matching.length) general.push(message);
    for (const [field] of matching) (fields[field] ||= []).push(message);
  }
  return { fields, general };
}
export function formatDate(value: unknown): string {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';
}
export function defaults(user: User, meta: Meta): Record<string, string> {
  const now = new Date();
  const today =
    meta.today ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    ...Object.fromEntries(dateFields.map((field) => [field, ''])),
    referenceId: '',
    requestId: '',
    entryType: user.role === 'mofsl' ? 'Modification' : 'New',
    clientName: '',
    pan: '',
    accountType: 'Individual',
    channel: 'Physical',
    location: meta.locations[0] || '',
    segment: meta.segments[0] || '',
    cseName: user.role === 'cse' ? user.displayName : '',
    rmName: '',
    processorName: '',
    owner: user.role === 'mofsl' ? 'MOFSL' : 'Operations',
    inwardDate: user.role === 'mofsl' ? '' : today,
    outwardDate: '',
    resubmissionDate: '',
    signedFormDate: '',
    submittedDate: '',
    accountOpeningDate: '',
    accountNumber: '',
    status: user.role === 'mofsl' ? mofslStatuses[0] : 'Request Received from CSE',
    queryDetails: '',
    remarks: '',
    stage1QueryDetails: '',
    discrepancyType: '',
    stage4ReviewOutcome: '',
    mofslQueryType: '',
    autoCaptureDates: 'false',
    autoStatus: 'true',
    stageOverride: '',
  };
}
export function submissionPayload(form: Record<string, string>, user: User, current: Row | null) {
  const payload = { ...form };
  // Display the saved state; CSE response statuses take effect only when saving.
  if (user.role === 'cse' && current) {
    if (current.status === 'Query Raised to CSE - Missing Information') {
      payload.entryType = 'Resubmission';
      payload.status = 'Resubmitted by CSE';
    } else if (
      ['Discrepancy Raised to CSE', 'Form Returned to CSE'].includes(String(current.status))
    ) {
      payload.entryType = 'Discrepancy Resolution';
      payload.status = 'Discrepancy Resolution Received';
    }
  }
  return payload;
}
export function validate(
  payload: Record<string, string>,
  meta: Meta,
  references: Set<string>,
): string[] {
  const errors: string[] = [];
  for (const [key, label] of Object.entries({
    requestId: 'Request ID',
    clientName: 'Client name',
    pan: 'PAN No',
    inwardDate: 'Inward date',
    status: 'Latest status',
  }))
    if (!payload[key]?.trim()) errors.push(`${label} is required`);
  if (payload.entryType !== 'New' && !payload.referenceId?.trim())
    errors.push('Reference ID is required for related entries');
  if (payload.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(payload.pan))
    errors.push('PAN No must use the standard PAN format');
  for (const [field, label, values] of [
    ['entryType', 'Entry type', entryTypes],
    ['accountType', 'Account type', accountTypes],
    ['channel', 'Channel', channels],
    ['owner', 'Current owner', owners],
  ] as const)
    if (!values.includes(payload[field])) errors.push(`${label} is invalid`);
  if (!meta.statuses.some((x) => x.status === payload.status))
    errors.push('Latest status is not in the Status Master');
  if (!meta.locations.includes(payload.location))
    errors.push('Location is not in the Location Master');
  if (!meta.segments.includes(payload.segment)) errors.push('Segment is not in the Segment Master');
  for (const field of dateFields) {
    const value = payload[field];
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors.push(`${dateLabels[field]} is invalid`);
  }
  const autoField =
    payload.autoCaptureDates === 'true' ? automaticDateFields[payload.status] : undefined;
  for (const [field, label] of Object.entries(
    meta.statuses.find((item) => item.status === payload.status)?.requiredFields || {},
  )) {
    if (['accountNumber', 'accountOpeningDate', 'queryDetails'].includes(field)) continue;
    const sendingDate = ['digitalFormSentDate', 'physicalFormSubmittedDate'].includes(field);
    if (
      !payload[field]?.trim() &&
      !(sendingDate && payload.outwardDate?.trim()) &&
      !(payload.autoCaptureDates === 'true' && dateFields.includes(field))
    )
      errors.push(`${label} is required for ${payload.status}`);
  }
  if (
    payload.status === 'Form Found in Order - Ready for MOFSL Submission' &&
    payload.stage4ReviewOutcome &&
    payload.stage4ReviewOutcome !== 'Found in Order'
  )
    errors.push('Stage 4 review outcome must be Found in Order for readiness');
  if (
    payload.accountOpeningDate &&
    payload.inwardDate &&
    payload.accountOpeningDate < payload.inwardDate
  )
    errors.push('Account opening date cannot precede inward date');
  if (
    closed.includes(payload.status) &&
    (!payload.accountNumber || (!payload.accountOpeningDate && autoField !== 'accountOpeningDate'))
  )
    errors.push('A closed case requires account number and account opening date');
  if (
    queryStatuses.includes(payload.status) &&
    !(
      payload.queryDetails ||
      (payload.status === queryStatuses[0] ? payload.stage1QueryDetails : '') ||
      (payload.status === 'Query Raised by MOFSL' ? payload.mofslQueryType : '')
    )?.trim()
  )
    errors.push('Query / event details are required for query or discrepancy statuses');
  if (payload.status === 'Physical Form Submitted to CSE' && payload.channel !== 'Physical')
    errors.push('Physical form submission requires the Physical channel');
  if (payload.status === 'Digital Form Sent to Client' && payload.channel !== 'Digital')
    errors.push('Digital form submission requires the Digital channel');
  if (payload.discrepancyType && !discrepancyTypes.includes(payload.discrepancyType))
    errors.push('Discrepancy type is invalid');
  if (payload.stage4ReviewOutcome && !reviewOutcomes.includes(payload.stage4ReviewOutcome))
    errors.push('Stage 4 review outcome is invalid');
  if (payload.physicalFormSubmittedDate && payload.channel !== 'Physical')
    errors.push('Physical submission date requires the Physical channel');
  if (payload.digitalFormSentDate && payload.channel !== 'Digital')
    errors.push('Digital submission date requires the Digital channel');
  if (
    payload.referenceId &&
    payload.entryType !== 'New' &&
    !references.has(payload.referenceId.trim().toLowerCase())
  )
    errors.push('Create the original case before adding a related entry');
  return errors;
}

// CSV quoting includes embedded newlines and escaped quotes.
export function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((x) => x.trim())) records.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  row.push(value);
  if (row.some((x) => x.trim())) records.push(row);
  return records;
}
export function parseCsv(
  text: string,
  user: User,
  meta: Meta,
  references: Set<string>,
): ImportRow[] {
  const records = csvRecords(text);
  const headers = (records.shift() || []).map((x) => x.trim().toLowerCase().replace(/\s+/g, ''));
  return records.map((values) => {
    const raw = Object.fromEntries(headers.map((header, i) => [header, (values[i] || '').trim()]));
    const payload = defaults(user, meta);
    const defaultInwardDate = payload.inwardDate;
    payload.inwardDate = '';
    for (const field of Object.keys(payload))
      if (raw[field.toLowerCase()] !== undefined) payload[field] = raw[field.toLowerCase()];
    for (const [field, label] of Object.entries(dateLabels)) {
      const header = label.toLowerCase().replace(/\s+/g, '');
      if (raw[header] !== undefined) payload[field] = raw[header];
    }
    payload.pan = raw.panno || raw.pan || '';
    payload.status = raw.lateststatus || raw.status || '';
    payload.submittedDate = raw.submittedtomofsldate || raw.submitteddate || payload.submittedDate;
    if (payload.entryType === 'New' && !payload.inwardDate) payload.inwardDate = defaultInwardDate;
    for (const field of dateFields)
      payload[field] = payload[field].replace(/^(\d{2})-(\d{2})-(\d{4})$/, '$3-$2-$1');
    payload.autoCaptureDates = 'false';
    return { payload, errors: validate(payload, meta, references) };
  });
}
export function downloadTemplate() {
  const headers = [
    'Reference ID',
    'Request ID',
    'Entry Type',
    'Client Name',
    'PAN No',
    'Account Type',
    'Channel',
    'Location',
    'Segment',
    'RM Name',
    'CSE Name',
    'Processor Name',
    'Owner',
    'Latest Status',
    ...Object.values(dateLabels),
    'Account Number',
    'Stage 1 Query Details',
    'Discrepancy Type',
    'Stage 4 Review Outcome',
    'MOFSL Query Type',
    'Query Details',
    'Remarks',
  ];
  const content = headers.join(',') + '\n';
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  anchor.href = url;
  anchor.download = 'client-onboarding-upload-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
