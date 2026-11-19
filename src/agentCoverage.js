/**
 * Coverage Agent — Financial Aid per Treatment
 * Posts a treatment name to /api/agent-coverage and returns structured
 * financial assistance options.
 *
 * Returns:
 * {
 *   options: [{ name, type, description, eligibility, url, note }],
 *   summary: string
 * }
 */
export async function fetchCoverage({ treatmentName, profile }) {
  const res = await fetch('/Ally/api/agent-coverage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ treatmentName, profile }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Coverage agent returned ${res.status}`);
  }

  return res.json();
}
