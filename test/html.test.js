import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sanitizePolicyHtml } from '../src/util/html.js';

test('escapeHtml escapes the dangerous characters', () => {
  assert.equal(escapeHtml('<b>"x"&\'y\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;');
});

test('sanitizePolicyHtml keeps safe formatting markup', () => {
  const ok = '<h3>Rules</h3><ul><li>Wear a <strong>badge</strong></li></ul><p>Thanks</p>';
  assert.equal(sanitizePolicyHtml(ok), ok);
});

test('sanitizePolicyHtml strips <script> blocks', () => {
  const out = sanitizePolicyHtml('<p>ok</p><script>alert(1)</script>');
  assert.ok(!/script/i.test(out));
  assert.ok(out.includes('<p>ok</p>'));
});

test('sanitizePolicyHtml removes inline event handlers', () => {
  const out = sanitizePolicyHtml('<img src="x" onerror="alert(1)"><p onclick=\'x()\'>hi</p>');
  assert.ok(!/onerror/i.test(out));
  assert.ok(!/onclick/i.test(out));
});

test('sanitizePolicyHtml neutralises javascript: URLs', () => {
  const out = sanitizePolicyHtml('<a href="javascript:alert(1)">x</a>');
  assert.ok(!/javascript:/i.test(out));
});

test('sanitizePolicyHtml strips iframes and forms', () => {
  const out = sanitizePolicyHtml('<iframe src="evil"></iframe><form action="x"></form><p>safe</p>');
  assert.ok(!/iframe|<form/i.test(out));
  assert.ok(out.includes('<p>safe</p>'));
});
