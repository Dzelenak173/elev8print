import { before, beforeEach, after, mock, test } from 'node:test';
import assert from 'node:assert/strict';

let POST, messages, sendEmail;
before(async () => {
  mock.module('../src/lib/sendgrid.ts', { defaultExport: { async send(message) { messages.push(message); return sendEmail(message); } } });
  ({ POST } = await import('../src/app/api/contact/route.ts'));
});
beforeEach(() => { messages = []; sendEmail = async () => {}; });
after(() => mock.restoreAll());

function request(changes = {}) {
  return new Request('https://example.invalid/api/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Fictional visitor', email: 'visitor@example.invalid', subject: 'Fictional inquiry', message: 'This is a local test only.', ...changes }),
  });
}

test('contact inquiries go to the office while replies reach the visitor', async () => {
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'office@elev8print.com');
  assert.equal(messages[0].replyTo, 'visitor@example.invalid');
  assert.equal(messages[0].from.email, 'admin@elaborate-designs.com');
  assert.match(messages[0].text, /This is a local test only\./);
});

test('invalid contact submissions never call the email provider', async () => {
  assert.equal((await POST(request({ email: 'invalid' }))).status, 400);
  assert.equal((await POST(request({ message: '' }))).status, 400);
  assert.equal(messages.length, 0);
});

test('contact delivery failures are not reported as a successful inquiry', async () => {
  const logger = mock.method(console, 'error', () => {});
  try {
    sendEmail = async () => { throw new Error('Fictional provider rejection'); };
    const response = await POST(request());
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, error: 'Failed to send message' });
  } finally { logger.mock.restore(); }
});
