import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env (Node 22+ supports process.loadEnvFile)
try {
  process.loadEnvFile(resolve(fileURLToPath(new URL('../.env', import.meta.url))));
} catch {}

const root = resolve(process.argv[2] || '.');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

// --- Location map ---
const locationMap = {
  slc: 'Salt Lake City, UT',
  denver: 'Denver, CO',
  phoenix: 'Phoenix, AZ',
};

// --- Agent 1 system prompt ---
const AGENT1_SYSTEM = `You are Ally's Resource Finder — an expert in US healthcare insurance networks and local medical resources for people newly diagnosed with autoimmune and thyroid conditions.

When given a user's condition, insurance plan, and location, return a comprehensive list of nearby providers organized by insurance coverage.

ALWAYS respond with valid JSON only — no markdown, no explanation, no extra text — in this exact structure:
{
  "providers": [
    {
      "id": "kebab-case-unique-id",
      "name": "Full clinic or practice name",
      "specialty": "e.g. Endocrinology / Thyroid Specialist",
      "type": "clinic|specialist|functional|support",
      "address": "Full street address, City, State ZIP",
      "phone": "(xxx) xxx-xxxx",
      "fax": "(xxx) xxx-xxxx or null",
      "email": "email or null",
      "hours": "e.g. Mon–Fri 8am–5pm",
      "distanceMiles": 2.4,
      "insurance": {
        "status": "in_network|verify|out_of_network|unknown",
        "note": "Short plain-language explanation of coverage status"
      },
      "providers": [
        { "name": "Dr. Jane Smith, MD", "role": "Endocrinologist" }
      ],
      "languages": ["English"],
      "rating": 4.7,
      "bookingNote": "Requires referral; call to schedule"
    }
  ],
  "meta": {
    "condition": "as given",
    "insurance": "as given",
    "location": "as given",
    "summary": "1–2 sentence warm summary Ally says to the user about these results"
  }
}

Rules:
- Include 5–10 providers when possible
- Sort: in_network first, then verify, then others; within each group sort by distanceMiles ascending
- insurance.status must be exactly one of: in_network, verify, out_of_network, unknown
- Use "verify" when you know a provider exists but cannot confirm current network status
- distanceMiles: realistic estimate from the city center
- Include a mix: endocrinologists, primary care, functional/integrative, and support resources when relevant
- The meta.summary is what Ally says to the user — warm, 1–2 sentences, first person ("I found…")
- Never output anything outside the JSON`;

// --- Agent 2 system prompt ---
// This prompt and endpoint are intentionally independent of Agent 1.
const AGENT2_SYSTEM = `You are a healthcare appointment availability assistant.

Given a provider and location, find publicly available appointment openings that a patient could schedule themselves.

Return valid JSON only — no markdown, no explanation, no extra text — in this exact structure:
{
  "providerId": "id supplied in the request",
  "providerName": "provider name",
  "slots": [
    {
      "date": "YYYY-MM-DD",
      "time": "h:mm AM",
      "timezone": "America/Denver",
      "mode": "in_person|telehealth",
      "bookingUrl": "https://...",
      "note": "Short scheduling note"
    }
  ],
  "meta": {
    "location": "as given",
    "searchedAt": "ISO 8601 timestamp",
    "disclaimer": "Availability may change; verify before booking"
  }
}

Rules:
- Only include appointments that are publicly described as open or directly self-bookable.
- Never invent availability, appointment URLs, provider information, or a date.
- If you cannot verify a provider or live openings, return "slots": [].
- Include at most 10 of the soonest openings.
- Use the timezone for the requested location.
- mode must be exactly in_person or telehealth.
- bookingUrl may be null when no direct booking link is available.
- Do not include personal or sensitive user information.
- Never output anything outside the JSON`;

// --- Anthropic API helper ---
async function callAnthropic(systemPrompt, userMessage, apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  // Strip possible markdown code fences
  const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

// --- HTTP server ---
http.createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // POST /Ally/api/agent1 — Resource Finder
  if (req.method === 'POST' && pathname === '/Ally/api/agent1') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { profile } = JSON.parse(Buffer.concat(chunks).toString());

      const city = locationMap[profile.location] || profile.location || 'unknown location';
      const userMessage =
        `Find healthcare providers for:\n- Condition: ${profile.condition}\n- Insurance: ${profile.insurance}\n- Location: ${city}`;

      const result = await callAnthropic(AGENT1_SYSTEM, userMessage);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Agent 1 error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /Ally/api/agent2 — Booking Agent (partner's work)
  if (req.method === 'POST' && pathname === '/Ally/api/agent2') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const provider = body.provider || body;
      const providerId = provider.id || body.providerId || 'unknown-provider';
      const providerName = provider.name || body.providerName || 'Unknown provider';
      const location = body.location || body.meta?.location || 'unknown location';
      const condition = body.condition || body.meta?.condition || null;

      if (!providerName || providerName === 'Unknown provider') {
        throw new Error('providerName is required');
      }

      const userMessage =
        `Find publicly self-bookable appointment openings for:\n` +
        `- Provider: ${providerName}\n` +
        `- Address: ${provider.address || 'not provided'}\n` +
        `- Phone: ${provider.phone || 'not provided'}\n` +
        `- Location: ${location}\n` +
        `- Specialty: ${provider.specialty || 'not provided'}\n` +
        `${condition ? `- Visit type: ${condition}\n` : ''}` +
        `- Search date: ${new Date().toISOString()}`;

      const result = await callAnthropic(
        AGENT2_SYSTEM,
        userMessage,
        process.env.AGENT2_API_KEY || process.env.ANTHROPIC_API_KEY,
      );
      result.providerId = providerId;
      result.providerName = providerName;
      result.slots = Array.isArray(result.slots) ? result.slots : [];
      result.meta = {
        location,
        searchedAt: new Date().toISOString(),
        disclaimer: 'Availability may change; verify before booking',
        ...result.meta,
      };

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Agent 2 error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /Ally/api/agent3 — Ask Your Doctor About
  if (req.method === 'POST' && pathname === '/Ally/api/agent3') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { symptoms, treatments, profile } = JSON.parse(Buffer.concat(chunks).toString());

      const symLines = (symptoms || []).map(s => `- ${s.name} (${s.severity === 3 ? 'Significant' : s.severity === 2 ? 'Moderate' : 'Mild'})`).join('\n');
      const treatLines = (treatments || []).map(t => `- ${t.name} (${t.type || 'Medication'}) — ${t.status === 'working' ? 'Working well' : t.status === 'partial' ? 'Partially working' : t.status === 'not-working' ? 'Not working' : 'Too early to tell'}${t.sideEffects ? ', side effects noted' : ''}`).join('\n');
      const condLine = Array.isArray(profile?.conditions) ? profile.conditions.join(', ') : (profile?.condition || 'autoimmune condition');

      const userMessage = `Patient profile:\n- Diagnosis: ${condLine}\n\nSymptoms:\n${symLines || 'None logged'}\n\nTreatments:\n${treatLines || 'None logged'}`;

      const result = await callAnthropic(
        `You are Ally's Appointment Prep agent — a specialist in helping patients with autoimmune conditions prepare for doctor's appointments.

Given a patient's logged symptoms (with severity) and treatments (with effectiveness ratings and side effect flags), generate a focused, personalized list of questions and topics they should bring up at their next appointment.

ALWAYS respond with valid JSON only — no markdown, no explanation, no extra text — in this exact structure:
{
  "suggestions": [
    {
      "category": "Symptoms | Treatments | Next Steps | Monitoring",
      "question": "The specific question or topic to raise with their doctor",
      "context": "One sentence explaining why this matters based on their data"
    }
  ],
  "summary": "One sentence framing what this appointment should focus on"
}

Rules:
- Be specific to the actual symptoms and treatments provided — never generic
- Prioritize treatments marked as 'not-working' or that have side effects
- Flag symptoms with severity 3 (Significant) as high priority
- Include 4-8 suggestions total
- Keep questions conversational and patient-friendly, not overly clinical
- Never output anything outside the JSON`,
        userMessage,
        process.env.AGENT3_API_KEY || process.env.ANTHROPIC_API_KEY,
      );
      result.suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Agent 3 error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /Ally/api/agent-coverage — Financial Aid per Treatment
  if (req.method === 'POST' && pathname === '/Ally/api/agent-coverage') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const { treatmentName, profile } = JSON.parse(Buffer.concat(chunks).toString());

      const condLine = Array.isArray(profile?.conditions) ? profile.conditions.join(', ') : (profile?.condition || 'autoimmune condition');
      const userMessage = `Find financial assistance options for: ${treatmentName}\nPatient diagnosis: ${condLine}\nInsurance: ${profile?.insurance || 'unknown'}`;

      const result = await callAnthropic(
        `You are Ally's Coverage Agent — a specialist in finding financial assistance for patients with autoimmune conditions in the United States.

Given a specific treatment or medication, find real financial assistance options including manufacturer patient assistance programs, copay cards, nonprofit grants, and insurance coverage tips.

ALWAYS respond with valid JSON only — no markdown, no explanation, no extra text — in this exact structure:
{
  "options": [
    {
      "name": "Program or resource name",
      "type": "Manufacturer PAP | Copay Card | Nonprofit Grant | Insurance Tip | General Resource",
      "description": "What it offers and how it helps",
      "eligibility": "Brief eligibility criteria",
      "url": "Real website URL or null",
      "note": "Important caveat or null"
    }
  ],
  "summary": "One sentence overview of what financial help is available for this treatment"
}

Rules:
- Include 3-6 options
- Only include programs that genuinely exist for this medication or condition
- If the treatment is a generic medication with no PAP, say so and suggest alternatives
- Be honest about eligibility — don't suggest programs the patient likely won't qualify for
- Never output anything outside the JSON`,
        userMessage,
        process.env.COVERAGE_API_KEY || process.env.ANTHROPIC_API_KEY,
      );
      result.options = Array.isArray(result.options) ? result.options : [];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('Coverage agent error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static file serving
  if (pathname === '/Ally') { res.writeHead(302, { Location: '/Ally/' }); return res.end(); }
  pathname = pathname.replace(/^\/Ally\//, '/');
  const file = resolve(root, `.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`);
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(process.env.PORT || 4173, '0.0.0.0', () => console.log(`Ally: http://0.0.0.0:${process.env.PORT || 4173}/Ally/`));
