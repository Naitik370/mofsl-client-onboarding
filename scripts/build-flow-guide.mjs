import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chapters, topics } from './flow-guide-content.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('documents/client-onboarding-flow.html', root);
const template = readFileSync(new URL('documents/flow-guide-template.html', root), 'utf8');

function sourceExcerpt({ file, marker, end }) {
  const source = readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');
  const found = source.indexOf(marker);
  if (found < 0) throw new Error(`Guide source marker missing: ${file} → ${marker}`);
  const start = source.lastIndexOf('\n', found) + 1;
  let finish;
  if (end) {
    finish = source.indexOf(end, found + marker.length);
    if (finish < 0) throw new Error(`Guide end marker missing: ${file} → ${end}`);
    finish = source.lastIndexOf('\n', finish) + 1;
    if (finish <= start) finish = source.indexOf(end, found + marker.length);
  } else if (file.endsWith('.cs')) {
    // C# members are formatted at four spaces; a following member ends this excerpt.
    const rest = source.slice(source.indexOf('\n', found) + 1);
    const next = /^    (?:public|private|internal) /m.exec(rest);
    finish = next ? source.indexOf('\n', found) + 1 + next.index : source.length;
  } else {
    finish = source.length;
  }
  const snippet = source.slice(start, finish).trimEnd();
  if (!snippet) throw new Error(`Empty guide excerpt: ${file} → ${marker}`);
  const firstLine = source.slice(0, start).split('\n').length;
  return {
    file,
    marker,
    code: snippet,
    firstLine,
    lastLine: firstLine + snippet.split('\n').length - 1,
    hash: createHash('sha256').update(source).digest('hex').slice(0, 10),
  };
}

const ids = new Set();
const compiledTopics = topics.map((topic, index) => {
  if (ids.has(topic.id)) throw new Error(`Duplicate guide topic: ${topic.id}`);
  ids.add(topic.id);
  if (!chapters.some((chapter) => chapter.id === topic.chapter))
    throw new Error(`Unknown chapter: ${topic.chapter}`);
  if (!topic.sources.length) throw new Error(`Topic has no source evidence: ${topic.id}`);
  return { ...topic, number: index + 1, sources: topic.sources.map(sourceExcerpt) };
});
const payload = JSON.stringify({ chapters, topics: compiledTopics }).replace(/</g, '\\u003c');
const html = template.replace(
  '<!-- GUIDE_DATA -->',
  `<script id="guide-data" type="application/json">${payload}</script>`,
);

if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== html)
    throw new Error('Flow guide is stale. Run npm run guide.');
  console.log(`Guide is current: ${compiledTopics.length} segments with verified source excerpts.`);
} else {
  writeFileSync(output, html);
  console.log(
    `Created ${fileURLToPath(output)} with ${compiledTopics.length} interactive segments.`,
  );
}
