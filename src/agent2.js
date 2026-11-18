/**
 * Agent 2 — Booking Assistant
 * Independent client adapter. Sends a selected provider to the server-side
 * /api/agent2 endpoint and receives only publicly described appointment slots.
 */
export async function findAppointmentSlots({ provider, location, condition }) {
  if (!provider?.name) throw new Error('A provider name is required');

  const res = await fetch('/Ally/api/agent2', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, location, condition }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Agent 2 returned ${res.status}`);
  }

  const result = await res.json();
  return {
    providerId: result.providerId || provider.id,
    providerName: result.providerName || provider.name,
    slots: Array.isArray(result.slots) ? result.slots : [],
    meta: result.meta || null,
  };
}
