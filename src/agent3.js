/**
 * Agent 3 — Ask Your Doctor About
 * Posts the user's symptoms and treatments to /api/agent3 and returns
 * a structured list of personalized questions and topics for their next
 * appointment.
 *
 * Returns:
 * {
 *   suggestions: [{ category, question, context }],
 *   summary: string
 * }
 */
export async function askDoctor({ symptoms, treatments, profile }) {
  const res = await fetch('/Ally/api/agent3', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ symptoms, treatments, profile }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Agent 3 returned ${res.status}`);
  }

  return res.json();
}
