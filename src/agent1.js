/**
 * Agent 1 — Resource Finder
 * Client-side module. Posts the user's profile to the server-side
 * /api/agent1 endpoint and returns structured provider results.
 *
 * Returns the data contract:
 * {
 *   providers: [{ id, name, specialty, type, address, phone, fax, email,
 *                 hours, distanceMiles, insurance: { status, note },
 *                 providers: [{ name, role }], languages, rating, bookingNote }],
 *   meta: { condition, insurance, location, summary }
 * }
 *
 * Agent 2 (Booking) can receive any provider object from this list
 * directly from app.js — the two agents never communicate with each other.
 */
export async function askAlly(profile) {
  const res = await fetch('/Ally/api/agent1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Agent 1 returned ${res.status}`);
  }

  return res.json();
}
