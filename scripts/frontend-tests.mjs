import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

function componentModule(path, dependencies = {}) {
  let code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  code = code.replace(
    /from ['"]([^'"]+)['"]/g,
    (_match, name) => `from ${JSON.stringify(dependencies[name] || import.meta.resolve(name))}`,
  );
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

const source = readFileSync(new URL('../frontend/lib.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const libModule = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const sharedModule = componentModule('../frontend/components/shared.tsx', { '../lib': libModule });
const navigationModule = componentModule('../frontend/navigation.ts');
const { parseRoute, routeHash } = await import(navigationModule);
const { CaseDetails } = await import(
  componentModule('../frontend/components/CaseDetails.tsx', {
    '../lib': libModule,
    './shared': sharedModule,
  })
);
const { CaseEntry } = await import(
  componentModule('../frontend/components/CaseEntry.tsx', {
    '../lib': libModule,
    './shared': sharedModule,
  })
);
const { CaseRegister } = await import(
  componentModule('../frontend/components/ReportingViews.tsx', {
    '../lib': libModule,
    './shared': sharedModule,
    './CaseDetails': componentModule('../frontend/components/CaseDetails.tsx', {
      '../lib': libModule,
      './shared': sharedModule,
    }),
    '../navigation': navigationModule,
  })
);
const {
  parseCsv,
  csvRecords,
  defaults,
  submissionPayload,
  validate,
  api,
  ApiError,
  visibleDateFields,
  dateFields,
  latestCaseEntries,
  fieldValidationErrors,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const user = { id: 1, username: 'operations', displayName: 'Operations Demo', role: 'operations' };
const meta = {
  statuses: ['Request Received from CSE', 'Account Opened', 'Query Raised by MOFSL'].map(
    (status) => ({ status, stage: 'Stage 1' }),
  ),
  locations: ['Mumbai'],
  segments: ['Retail'],
  slaDays: 7,
  today: '2026-07-10',
};
const valid = {
  ...defaults(user, meta),
  requestId: 'REQ-1',
  clientName: 'Client',
  pan: 'ABCDE1234F',
  inwardDate: '2026-07-01',
};

const processStatuses = [
  [
    'Query Raised to CSE - Missing Information',
    'Stage 1',
    'stage1QueryRaisedDate',
    'Stage 1 query raised date',
  ],
  ['Resubmitted by CSE', 'Stage 1', 'stage1ResubmissionDate', 'Stage 1 resubmission date'],
  ['Application Form Under Preparation', 'Stage 2', 'formPreparedDate', 'Form prepared date'],
  [
    'Physical Form Submitted to CSE',
    'Stage 2',
    'physicalFormSubmittedDate',
    'Physical form submitted to CSE date',
  ],
  [
    'Digital Form Sent to Client',
    'Stage 2',
    'digitalFormSentDate',
    'Digital form sent to client date',
  ],
  ['Signed Form Received from CSE', 'Stage 3', 'signedFormDate', 'Signed form received date'],
  ['Discrepancy Raised to CSE', 'Stage 3', 'discrepancyRaisedDate', 'Discrepancy raised date'],
  ['Form Returned to CSE', 'Stage 3', 'formReturnedToCseDate', 'Form returned to CSE date'],
  [
    'Discrepancy Resolution Received',
    'Stage 4',
    'discrepancyResolutionReceivedDate',
    'Discrepancy resolution received date',
  ],
  [
    'Resubmitted Form Received - Under Review',
    'Stage 4',
    'resubmittedFormReceivedDate',
    'Resubmitted form received date',
  ],
  ['Submitted to MOFSL', 'Stage 5', 'submittedDate', 'Submitted to MOFSL date'],
  ['Query Raised by MOFSL', 'Stage 5', 'mofslQueryRaisedDate', 'MOFSL query raised date'],
  [
    'Query Resolved - Resubmitted to MOFSL',
    'Stage 5',
    'mofslQueryResolvedDate',
    'MOFSL query resolved date',
  ],
  ['Account Opened', 'Stage 6', 'accountOpeningDate', 'Account opening date'],
  [
    'Communication Sent - Case Closed',
    'Stage 6',
    'communicationSentDate',
    'Communication sent date',
  ],
];
const workflowMeta = {
  ...meta,
  statuses: [
    ...meta.statuses.filter((item) => item.status === 'Request Received from CSE'),
    ...processStatuses.map(([status, stage, field, label]) => ({
      status,
      stage,
      requiredFields: {
        [field]: label,
        ...(['Account Opened', 'Communication Sent - Case Closed'].includes(status)
          ? { accountNumber: 'Account number', accountOpeningDate: 'Account opening date' }
          : {}),
      },
    })),
    {
      status: 'Form Found in Order - Ready for MOFSL Submission',
      stage: 'Stage 4',
      requiredFields: { stage4ReviewOutcome: 'Stage 4 review outcome' },
    },
  ],
};

test('API requirements mark and validate only the selected action fields', () => {
  for (const [status, , field, label] of processStatuses) {
    const payload = {
      ...valid,
      status,
      channel: status === 'Digital Form Sent to Client' ? 'Digital' : 'Physical',
      queryDetails: 'Missing proof',
      accountNumber: 'TEST26100001',
    };
    if (status === 'Communication Sent - Case Closed') payload.accountOpeningDate = '2026-10-09';
    assert(
      validate(payload, workflowMeta, new Set()).some((message) =>
        message.toLowerCase().includes(label.toLowerCase()),
      ),
      status,
    );
    assert.deepEqual(
      validate({ ...payload, [field]: '2026-10-09' }, workflowMeta, new Set()),
      [],
      status,
    );
    const html = renderToStaticMarkup(
      createElement(CaseEntry, {
        user,
        meta: workflowMeta,
        cases: [],
        selected: { ...payload, id: 1 },
        onSaved: async () => {},
        onClear: () => {},
        onError: String,
      }),
    );
    assert.match(html, new RegExp(`<input(?=[^>]*name="${field}")(?=[^>]*required="")`), status);
    assert(html.includes(`${label} *`), status);
    assert(!html.includes('name="outwardDate"'), status);
  }
  const payload = { ...valid, status: 'Form Found in Order - Ready for MOFSL Submission' };
  assert(
    validate(payload, workflowMeta, new Set()).some((message) =>
      message.includes('Stage 4 review outcome is required'),
    ),
  );
  assert(
    validate({ ...payload, stage4ReviewOutcome: 'Still Pending' }, workflowMeta, new Set()).some(
      (message) => message.includes('must be Found in Order'),
    ),
  );
  assert.deepEqual(
    validate({ ...payload, stage4ReviewOutcome: 'Found in Order' }, workflowMeta, new Set()),
    [],
  );
});

test('sending dates accept legacy outward dates and admin date capture', () => {
  const payload = { ...valid, status: 'Digital Form Sent to Client', channel: 'Digital' };
  assert.deepEqual(
    validate({ ...payload, outwardDate: '2026-10-09' }, workflowMeta, new Set()),
    [],
  );
  assert.deepEqual(validate({ ...payload, autoCaptureDates: 'true' }, workflowMeta, new Set()), []);
  const [row] = parseCsv(
    'Request ID,Client Name,PAN,Channel,Status\nREQ-CSV,Client,ABCDE1234F,Digital,Digital Form Sent to Client',
    user,
    workflowMeta,
    new Set(),
  );
  assert(
    row.errors.some((message) => message.includes('Digital form sent to client date is required')),
  );
});

test('CSE response forms show and require the resolution date before saving', () => {
  const cse = { ...user, role: 'cse', displayName: 'CSE Demo' };
  for (const [status, field] of [
    ['Query Raised to CSE - Missing Information', 'stage1ResubmissionDate'],
    ['Discrepancy Raised to CSE', 'discrepancyResolutionReceivedDate'],
    ['Form Returned to CSE', 'discrepancyResolutionReceivedDate'],
  ]) {
    const selected = { ...valid, id: 1, referenceId: 'REF-1', status };
    const html = renderToStaticMarkup(
      createElement(CaseEntry, {
        user: cse,
        meta: workflowMeta,
        cases: [selected],
        selected,
        onSaved: async () => {},
        onClear: () => {},
        onError: String,
      }),
    );
    assert.match(html, new RegExp(`<input(?=[^>]*name="${field}")(?=[^>]*required="")`));
    const payload = submissionPayload({ ...selected }, cse, selected);
    assert(
      validate(payload, workflowMeta, new Set(['ref-1'])).some((message) =>
        message.includes('is required for'),
      ),
    );
    assert.deepEqual(
      validate({ ...payload, [field]: '2026-10-09' }, workflowMeta, new Set(['ref-1'])),
      [],
    );
  }
});

test('case details renders a labelled dialog with the case metrics and close control', () => {
  const html = renderToStaticMarkup(
    createElement(CaseDetails, {
      row: {
        referenceId: 'REF-1',
        touchCount: 3,
        grossTat: 7,
        netTat: 5,
        processDates: { inwardDate: '2026-07-01' },
      },
      report: null,
      onClose: () => {},
    }),
  );
  assert.match(
    html,
    /<dialog[^>]*class="case-details-drawer"[^>]*aria-labelledby="case-details-title"/,
  );
  assert(html.includes('id="case-details-title"'));
  assert(html.includes('Case details · REF-1'));
  assert(html.includes('Close details'));
  assert(html.includes('Touch Count'));
  assert(html.includes('Not observed'));
  assert(html.includes('Gross TAT'));
});

test('New entries default inward to the server date while edits preserve supplied dates', () => {
  for (const role of ['admin', 'operations', 'cse']) {
    assert.equal(defaults({ ...user, role }, meta).inwardDate, meta.today);
  }
  assert.equal(defaults({ ...user, role: 'mofsl' }, meta).inwardDate, '');
  const html = renderToStaticMarkup(
    createElement(CaseEntry, {
      user,
      meta,
      cases: [],
      selected: { ...valid, id: 1 },
      onSaved: async () => {},
      onClear: () => {},
      onError: String,
    }),
  );
  assert.match(html, /name="inwardDate"[^>]*value="2026-07-01"/);
});

test('CSE forms display the current status and apply query responses only on submission', () => {
  const cse = { ...user, role: 'cse', displayName: 'CSE Demo' };
  const workflowMeta = {
    ...meta,
    statuses: [
      'Request Received from CSE',
      'Under Review by Operations',
      'Query Raised to CSE - Missing Information',
      'Resubmitted by CSE',
    ].map((status) => ({
      status,
      stage: 'Stage 1',
    })),
  };
  const newForm = defaults(cse, workflowMeta);
  assert.equal(newForm.status, 'Request Received from CSE');
  const props = {
    user: cse,
    meta: workflowMeta,
    onSaved: async () => {},
    onClear: () => {},
    onError: String,
  };
  const newHtml = renderToStaticMarkup(
    createElement(CaseEntry, { ...props, cases: [], selected: null }),
  );
  assert.match(newHtml, /<option selected="">Request Received from CSE<\/option>/);
  const queried = {
    ...valid,
    id: 1,
    referenceId: 'REF-1',
    status: 'Query Raised to CSE - Missing Information',
  };
  const html = renderToStaticMarkup(
    createElement(CaseEntry, {
      ...props,
      cases: [queried],
      selected: queried,
    }),
  );
  assert.match(html, /name="entryType"[^>]*><option selected="">Resubmission<\/option><\/select>/);
  assert.match(html, /<option selected="">Query Raised to CSE - Missing Information<\/option>/);
  const response = {
    ...newForm,
    referenceId: 'REF-1',
    entryType: 'Resubmission',
    status: queried.status,
  };
  const payload = submissionPayload(response, cse, queried);
  assert.equal(payload.status, 'Resubmitted by CSE');
  assert.equal(payload.entryType, 'Resubmission');
  assert.equal(response.status, queried.status);
  for (const status of ['Discrepancy Raised to CSE', 'Form Returned to CSE']) {
    const current = { ...queried, status };
    const resolution = submissionPayload({ ...response, status }, cse, current);
    assert.equal(resolution.status, 'Discrepancy Resolution Received');
    assert.equal(resolution.entryType, 'Discrepancy Resolution');
  }
  const manual = { ...response, status: 'Resubmitted Form Received - Under Review' };
  assert.equal(submissionPayload(manual, cse, queried).status, 'Resubmitted by CSE');
  assert.deepEqual(submissionPayload(response, user, queried), response);
});

test('MOFSL updates display the saved status before a new action is selected', () => {
  const current = { ...valid, id: 1, status: 'Submitted to MOFSL' };
  const html = renderToStaticMarkup(
    createElement(CaseEntry, {
      user: { ...user, role: 'mofsl' },
      meta: {
        ...meta,
        statuses: ['Submitted to MOFSL', 'Query Raised by MOFSL'].map((status) => ({
          status,
          stage: 'Stage 5',
        })),
      },
      cases: [current],
      selected: current,
      onSaved: async () => {},
      onClear: () => {},
      onError: String,
    }),
  );
  assert.match(html, /<option selected="">Submitted to MOFSL<\/option>/);
});

test('automatic status and stage override controls respect the user role', () => {
  for (const role of ['admin', 'operations', 'cse', 'mofsl']) {
    const html = renderToStaticMarkup(
      createElement(CaseEntry, {
        user: { ...user, role },
        meta,
        cases: [],
        selected: null,
        onSaved: async () => {},
        onClear: () => {},
        onError: String,
      }),
    );
    assert.match(html, /name="autoStatus"[^>]*checked=""/);
    assert.equal(html.includes('name="stageOverride"'), ['admin', 'operations'].includes(role));
    assert(html.includes('Current Stage'));
  }
});

test('new Stage 1 form does not display later-stage dates', () => {
  const html = renderToStaticMarkup(
    createElement(CaseEntry, {
      user,
      meta,
      cases: [],
      selected: null,
      onSaved: async () => {},
      onClear: () => {},
      onError: String,
    }),
  );
  assert(html.includes('name="inwardDate"'));
  assert(html.includes('name="stage1QueryRaisedDate"'));
  assert(!html.includes('name="formPreparedDate"'));
  assert(!html.includes('name="accountOpeningDate"'));
  for (const field of [
    'accountNumber',
    'discrepancyType',
    'stage4ReviewOutcome',
    'mofslQueryType',
    'resubmissionDate',
  ])
    assert(!html.includes(`name="${field}"`));
  for (const section of ['Client', 'Assignment', 'Status &amp; dates', 'Notes'])
    assert(html.includes(`<legend>${section}</legend>`));
  assert(!html.includes('Touch Count'));
  assert(!html.includes('Show all process dates'));
  assert(!html.includes('Dates follow Latest status. Previously entered dates remain saved.'));
});

test('register groups entries by reference and renders only the latest status with actions first', () => {
  const entries = [
    {
      id: 1,
      caseId: 1,
      referenceId: 'REF-1',
      status: 'Old status',
      updatedAt: '2026-07-01',
      clientName: 'Client',
    },
    {
      id: 3,
      caseId: 1,
      referenceId: 'REF-1',
      status: 'Latest status',
      updatedAt: '2026-07-03',
      clientName: 'Client',
    },
    {
      id: 2,
      caseId: 1,
      referenceId: 'REF-1',
      status: 'Earlier status',
      updatedAt: '2026-07-03',
      clientName: 'Client',
    },
    {
      id: 4,
      caseId: 2,
      referenceId: 'REF-2',
      status: 'Other case',
      updatedAt: '2026-07-02',
      clientName: 'Other',
    },
  ];
  assert.deepEqual(
    latestCaseEntries(entries).map((row) => row.id),
    [3, 4],
  );
  const html = renderToStaticMarkup(
    createElement(CaseRegister, {
      cases: entries,
      meta,
      user,
      metrics: null,
      onEdit: () => {},
      onDetails: () => {},
    }),
  );
  assert(html.includes('2 cases'));
  assert(!html.includes('Old status'));
  assert(!html.includes('Earlier status'));
  assert.equal((html.match(/class="case-row"/g) || []).length, 2);
  assert(html.includes('<th>Actions</th><th>Reference</th>'));
  assert(html.includes('href="#/cases/REF-1"'));
  assert(html.includes('tabindex="0"'));
});

test('hash routes preserve the screen and case reference and reject malformed routes', () => {
  for (const view of ['dashboard', 'cases', 'entry', 'history', 'analysis'])
    assert.equal(parseRoute(routeHash(view)).view, view);
  assert.deepEqual(parseRoute(routeHash('cases', 'REF/A B')), {
    view: 'cases',
    referenceId: 'REF/A B',
  });
  assert.deepEqual(parseRoute('#/entry/REF-1'), { view: 'entry', referenceId: 'REF-1' });
  assert.deepEqual(parseRoute('#/cases/%bad'), { view: 'cases', referenceId: null });
  assert.deepEqual(parseRoute('#/unknown'), { view: 'dashboard', referenceId: null });
});

test('field errors associate frontend and API validation messages with controls', () => {
  const result = fieldValidationErrors([
    'PAN No must use the standard PAN format',
    'stage1QueryRaisedDate is invalid',
    'A closed case requires account number and account opening date',
    'Create the original case before adding a related entry',
    'CSE users can only update their own cases',
  ]);
  assert.equal(result.fields.pan.length, 1);
  assert.equal(result.fields.stage1QueryRaisedDate.length, 1);
  assert.equal(result.fields.accountNumber.length, 1);
  assert.equal(result.fields.referenceId.length, 1);
  assert.deepEqual(result.general, ['CSE users can only update their own cases']);
});

test('entry form shows dates for each master stage and the selected channel', () => {
  const stages = [
    ['Stage 1', 'stage1ResubmissionDate'],
    ['Stage 2', 'formPreparedDate'],
    ['Stage 3', 'discrepancyRaisedDate'],
    ['Stage 4', 'discrepancyResolutionReceivedDate'],
    ['Stage 5', 'mofslQueryRaisedDate'],
    ['Stage 6', 'communicationSentDate'],
  ];
  for (const [stage, expected] of stages) {
    for (const channel of ['Physical', 'Digital']) {
      const html = renderToStaticMarkup(
        createElement(CaseEntry, {
          user,
          meta: { ...meta, statuses: [{ status: 'Selected status', stage }] },
          cases: [],
          selected: {
            ...valid,
            id: 1,
            status: 'Selected status',
            channel,
            formPreparedDate: '2026-07-02',
          },
          onSaved: async () => {},
          onClear: () => {},
          onError: String,
        }),
      );
      assert(html.includes(`name="${expected}"`), `${stage} ${channel}: missing ${expected}`);
      for (const [otherStage, otherField] of stages) {
        if (otherStage !== stage) assert(!html.includes(`name="${otherField}"`));
      }
      assert(html.includes('Show all process dates'));
      if (stage === 'Stage 2') {
        assert.equal(html.includes('name="physicalFormSubmittedDate"'), channel === 'Physical');
        assert.equal(html.includes('name="digitalFormSentDate"'), channel === 'Digital');
      }
      if (stage === 'Stage 3') {
        assert.equal(html.includes('name="formReturnedToCseDate"'), channel === 'Physical');
      }
    }
  }
  assert.deepEqual(visibleDateFields('Exception', 'Physical'), ['inwardDate', 'statusDate']);
  assert.deepEqual(visibleDateFields('', 'Physical'), ['inwardDate', 'statusDate']);
  assert.deepEqual(visibleDateFields('Stage 1', 'Digital', true), dateFields);
});

test('CSV preserves quoted names, notes, escaped quotes, BOM and multiline records', () => {
  const rows = parseCsv(
    '\uFEFFRequest ID,Client Name,PAN No,Inward Date,Latest Status,Remarks\r\nREQ-1,"Client, Inc",ABCDE1234F,29-09-2026,Request Received from CSE,"Line one\r\nLine ""two"""\r\n',
    user,
    meta,
    new Set(),
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].payload.clientName, 'Client, Inc');
  assert.equal(rows[0].payload.remarks, 'Line one\r\nLine "two"');
  assert.equal(rows[0].payload.inwardDate, '2026-09-29');
  assert.throws(() => csvRecords('a,b\n"unfinished'), /unterminated/);
});
test('CSV reports invalid calendar dates and unknown related references', () => {
  const rows = parseCsv(
    'Request ID,Client Name,PAN No,Inward Date,Latest Status,Entry Type,Reference ID\nREQ-1,Client,ABCDE1234F,31-09-2026,Request Received from CSE,Resubmission,REF-UNKNOWN',
    user,
    meta,
    new Set(),
  );
  assert(rows[0].errors.some((x) => x.includes('invalid')));
  assert(rows[0].errors.some((x) => x.includes('original case')));
});

test('CSV defaults missing inward dates only for New entries', () => {
  const header =
    'Request ID,Client Name,PAN No,Latest Status,Entry Type,Reference ID,Inward Date\n';
  const [fresh, related] = parseCsv(
    header +
      'REQ-1,Client,ABCDE1234F,Request Received from CSE,New,,\n' +
      'REQ-2,Client,ABCDE1234F,Request Received from CSE,Resubmission,REF-1,\n',
    user,
    meta,
    new Set(['ref-1']),
  );
  assert.equal(fresh.payload.inwardDate, meta.today);
  assert.deepEqual(fresh.errors, []);
  assert.equal(related.payload.inwardDate, '');
  assert(related.errors.includes('Inward date is required'));
});

test('CSV imports dedicated process dates and review fields without accepting a touch count', () => {
  const [row] = parseCsv(
    'Request ID,Client Name,PAN No,Inward Date,Latest Status,Form Prepared Date,Stage 1 Query Details,Discrepancy Type,Stage 4 Review Outcome,MOFSL Query Type,Touch Count\nREQ-2,Client,ABCDE1234F,01-07-2026,Request Received from CSE,06-07-2026,Missing proof,Document Missing,Found in Order,Address query,999',
    user,
    meta,
    new Set(),
  );
  assert.deepEqual(row.errors, []);
  assert.equal(row.payload.formPreparedDate, '2026-07-06');
  assert.equal(row.payload.stage1QueryDetails, 'Missing proof');
  assert.equal(row.payload.discrepancyType, 'Document Missing');
  assert.equal(row.payload.stage4ReviewOutcome, 'Found in Order');
  assert.equal(row.payload.mofslQueryType, 'Address query');
  assert.equal(row.payload.touchCount, undefined);
  assert(
    validate({ ...row.payload, discrepancyType: 'Unknown' }, meta, new Set()).some((x) =>
      x.includes('Discrepancy type'),
    ),
  );
});
test('new references are optional while related entries require existing IDs', () => {
  assert.deepEqual(validate(valid, meta, new Set()), []);
  assert(
    validate({ ...valid, entryType: 'Resubmission' }, meta, new Set()).some((x) =>
      x.includes('Reference ID'),
    ),
  );
  assert.deepEqual(
    validate(
      { ...valid, entryType: 'Resubmission', referenceId: 'REF-1' },
      meta,
      new Set(['ref-1']),
    ),
    [],
  );
});
test('account opening requires account details and accepts server auto-date capture', () => {
  const opened = { ...valid, status: 'Account Opened', accountNumber: '12345' };
  assert(validate(opened, meta, new Set()).some((x) => x.includes('closed case')));
  assert.deepEqual(validate({ ...opened, autoCaptureDates: 'true' }, meta, new Set()), []);
  assert(
    validate({ ...valid, status: 'Query Raised by MOFSL' }, meta, new Set()).some((x) =>
      x.includes('event details'),
    ),
  );
});
test('API retains status for session expiry and sends same-origin cookies', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.credentials, 'same-origin');
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
    };
    await assert.rejects(
      api('/api/cases'),
      (error) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.message === 'Authentication required',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
