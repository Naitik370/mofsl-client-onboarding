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
const { CaseEntry } = await import(
  componentModule('../frontend/components/CaseEntry.tsx', {
    '../lib': libModule,
    './shared': sharedModule,
  })
);
const { parseCsv, csvRecords, defaults, validate, api, ApiError, visibleDateFields, dateFields } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const user = { id: 1, username: 'operations', displayName: 'Operations Demo', role: 'operations' };
const meta = {
  statuses: ['Request Received from CSE', 'Account Opened', 'Query Raised by MOFSL'].map(
    (status) => ({ status, stage: 'Stage 1' }),
  ),
  locations: ['Mumbai'],
  segments: ['Retail'],
  slaDays: 7,
};
const valid = {
  ...defaults(user, meta),
  requestId: 'REQ-1',
  clientName: 'Client',
  pan: 'ABCDE1234F',
  inwardDate: '2026-07-01',
};

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
