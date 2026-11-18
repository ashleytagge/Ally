import test from 'node:test';
import assert from 'node:assert/strict';
import { findAppointmentSlots } from '../src/agent2.js';

test('Agent 2 posts only the selected provider and scheduling context', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      providerId: 'clinic-1',
      providerName: 'Example Clinic',
      slots: [{ date: '2026-12-01', time: '9:00 AM', mode: 'in_person' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const provider = { id: 'clinic-1', name: 'Example Clinic', address: '123 Main St' };
    const result = await findAppointmentSlots({
      provider,
      location: 'Denver, CO',
      condition: 'Hashimoto\'s thyroiditis',
    });
    assert.equal(request.url, '/Ally/api/agent2');
    assert.equal(request.options.method, 'POST');
    assert.deepEqual(JSON.parse(request.options.body), {
      provider,
      location: 'Denver, CO',
      condition: 'Hashimoto\'s thyroiditis',
    });
    assert.equal(result.slots.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Agent 2 normalizes missing slot arrays', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ providerId: 'clinic-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const result = await findAppointmentSlots({
      provider: { id: 'clinic-1', name: 'Example Clinic' },
      location: 'Denver, CO',
      condition: 'Hashimoto\'s thyroiditis',
    });
    assert.deepEqual(result.slots, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
