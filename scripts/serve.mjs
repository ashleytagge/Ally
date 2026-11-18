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

// --- Anthropic API helper ---
async function callAnthropic(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent 2 (Booking) not yet implemented' }));
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
