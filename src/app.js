import { conditions, insurers, locations, providers, resources, demoProfile } from './data.js';
import { askAlly } from './agent1.js';
import { initialFilters, findProviders, networkLabel, distance, readState } from './model.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let session;
try { session = readState(sessionStorage); } catch { session = readState({ getItem: () => null }); }
let view = session.profile ? 'dashboard' : 'welcome';
let filters = initialFilters();
let comparison = [];
let resourceQuery = '';
let resourceTopic = 'all';
const aiCache = {};
function getAIState(cond) { const k = cond || focusedCondition(); return aiCache[k] || { results: null, loading: false, error: null }; }
let agentProviderCache = {};
let activeCondition = null;
function focusedCondition() {
  if (!session.profile) return '';
  const list = Array.isArray(session.profile.conditions) ? session.profile.conditions : [session.profile.condition].filter(Boolean);
  return activeCondition && list.includes(activeCondition) ? activeCondition : (list[0] || '');
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icons = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  book: '<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Zm0 0v15"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M20 3C9 1 1 8 5 16s17 3 15-13ZM4 21 16 8"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m0-10H4v16h16v-6"/>',
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.heart}</svg>`;
const brand = `<span class="brand-mark">${icon('heart')}</span><span class="wordmark">ally<span>·</span></span>`;
const options = (items, current) => items.map(v => `<option ${v === current ? 'selected' : ''}>${escape(v)}</option>`).join('');
function persist() {
  try { sessionStorage.setItem('ally-session-v1', JSON.stringify(session)); }
  catch { toast('Session storage is unavailable. Your changes will last until you reload.'); }
}
let toastTimeout;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('visible'), 4000); }
function navigate(next) {
  view = next; filters = initialFilters(); render(); window.scrollTo(0, 0); document.querySelector('h1')?.focus();
  // AI results are pre-fetched for all conditions on init
}
async function fetchAIForCondition(cond) {
  if (!cond) return;
  const existing = aiCache[cond];
  if (existing && (existing.loading || existing.results)) return;
  aiCache[cond] = { results: null, loading: true, error: null };
  render();
  try {
    const results = await askAlly({ ...session.profile, condition: cond });
    aiCache[cond] = { results, loading: false, error: null };
  } catch (err) {
    aiCache[cond] = { results: null, loading: false, error: err.message };
    console.error('Agent 1:', err);
  }
  render();
}
function switchCondition(cond) {
  activeCondition = cond;
  agentProviderCache = {};
  render();
  // Fetch only if not already cached or in-flight
  if (!aiCache[cond]?.results && !aiCache[cond]?.loading) fetchAIForCondition(cond);
}
function showDialog(content) { dialog.innerHTML = `<button class="icon-button dialog-close" data-action="close" aria-label="Close dialog">${icon('close')}</button>${content}`; dialog.showModal(); }
function render() {
  if (view === 'welcome') { app.innerHTML = welcome(); return; }
  app.innerHTML = `<div class="shell"><aside class="sidebar"><button class="brand" data-action="home" aria-label="Ally home">${brand}</button><div class="sidebar-caption">A LITTLE SUPPORT. A WAY FORWARD.</div><nav aria-label="Main navigation">${[['dashboard', 'grid', 'My dashboard'], ['providers', 'search', 'Find care'], ['saved', 'bookmark', 'Saved providers'], ['resources', 'book', 'Learn & prepare']].map(([v, i, label]) => `<button data-view="${v}" ${view === v ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${v === 'saved' ? `<span class="nav-count">${session.saved.length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="mini-ally">${icon('leaf')}<strong>Your advocate, Ally</strong></div><p>One step at a time.<br>You set the pace.</p><button class="text-button" data-action="about">About this prototype ${icon('external')}</button></div></aside><div class="workspace"><header class="topbar"><span>Your care, a little clearer.</span><div><span class="demo-dot"></span> Interactive prototype <button class="profile-button" data-action="profile" aria-label="Edit your care preferences">${icon('heart')}</button></div></header><main id="main" tabindex="-1">${view === 'dashboard' ? dashboard() : view === 'resources' ? resourcePage() : directory()}</main><footer>Made for the next step, whatever that looks like. <span>Ally helps you navigate care. It does not provide medical advice.</span></footer></div></div>${comparison.length ? compareBar() : ''}`;
  document.title = `Ally · ${ {dashboard: 'My dashboard', providers: 'Find care', saved: 'Saved providers', resources: 'Learn & prepare'}[view] }`;
}
function botanical() {
  return `<svg class="botanical" viewBox="0 0 360 340" fill="none" aria-hidden="true"><circle cx="183" cy="169" r="131" fill="#e3e9da"/><circle cx="223" cy="128" r="82" fill="#d9e3cf"/><path d="M170 301c8-71 21-133 57-222M179 241c-35-17-55-43-68-76M194 192c28-12 57-23 84-57" stroke="#5d7b5e" stroke-width="2"/><path d="M215 109c-15-51 27-74 48-70 6 34-8 60-48 70ZM200 157c-36-20-36-62-13-80 23 20 28 47 13 80ZM198 180c44 4 75-15 81-45-36-13-65 5-81 45ZM178 236c-41-3-68-30-65-66 36 4 59 29 65 66ZM178 257c46 9 80-4 92-34-34-20-70-6-92 34Z" fill="#99af88"/><path d="M215 109c10-11 25-23 36-46M200 157c-5-28-9-44-13-61M198 180c30-12 46-19 68-34M178 236c-27-24-42-42-55-58M178 257c31-10 50-15 78-26" stroke="#5d7b5e" stroke-width="1.4"/><circle cx="89" cy="101" r="5" fill="#bdc9ad"/><circle cx="290" cy="238" r="4" fill="#bdc9ad"/></svg>`;
}
function welcome() {
  document.title = 'Ally · A little clarity, a next step';
  return `<div class="welcome"><header><div class="brand">${brand}</div><button class="text-button" data-action="about">About the prototype ${icon('external')}</button></header><main id="main"><section class="welcome-copy"><span class="eyebrow">YOUR HEALTHCARE ADVOCATE</span><h1 tabindex="-1">A new diagnosis.<br>A little clarity.<br><em>An ally by your side.</em></h1><p>Finding care can feel like a lot. Ally helps women with new autoimmune diagnoses explore providers, organize options, and take the next small step.</p><div class="welcome-actions"><button class="primary" data-action="onboard">Let’s get started ${icon('arrow')}</button><button class="secondary" data-action="demo">Explore the demo</button></div><small>No account needed. Use example information to try it out.</small></section><div class="welcome-illustration">${botanical()}<div class="welcome-note">${icon('leaf')}<span>You don’t have to figure<br>everything out today.</span></div></div><div class="welcome-details"><div><span>01</span><strong>Tell us a little</strong><p>Your diagnosis, plan, and location.</p></div><div><span>02</span><strong>Explore your options</strong><p>Find, compare, and save care.</p></div><div><span>03</span><strong>Take your next step</strong><p>Prepare for a conversation.</p></div></div><p class="welcome-disclaimer">A working prototype with fictional providers. Insurance, distances, and availability are sample values, never verified. Ally does not provide medical advice.</p></main></div>`;
}
function profileForm(edit = false) {
  const p = session.profile || demoProfile;
  showDialog(`<span class="eyebrow">${edit ? 'YOUR PREFERENCES' : 'LET’S START SIMPLY'}</span><h2>${edit ? 'Make this feel like you.' : 'A little about your care.'}</h2><p>These choices shape the sample options you see. Example information is welcome.</p><form id="profile-form"><fieldset class="diagnosis-fieldset"><legend>My diagnoses <span class="small muted">(select all that apply)</span></legend><div class="diagnosis-checks">${conditions.map(c => `<label class="check-label"><input type="checkbox" name="conditions" value="${escape(c)}" ${(Array.isArray(p.conditions) ? p.conditions : (p.condition ? [p.condition] : [])).includes(c) ? 'checked' : ''}>${escape(c)}</label>`).join('')}</div></fieldset><label>Insurance company<select name="insurance" required>${options(insurers, p.insurance)}</select></label><label>Location<select name="location" required>${Object.entries(locations).map(([key, loc]) => `<option value="${key}" ${key === p.location ? 'selected' : ''}>${loc.label} · ${loc.zip}</option>`).join('')}</select></label><p class="small muted">The demo supports three sample areas. Distances are fictional; no location tracking or real provider lookup is used. Insurance company selection cannot establish coverage for your specific plan.</p><div class="privacy-note">${icon('bookmark')}<span>Stored only in this browser session. No account, tracking, or AI service. Avoid entering personal medical information.</span></div><button class="primary full" type="submit">${edit ? 'Save preferences' : 'See my dashboard'} ${icon('arrow')}</button></form>`);
}
function banner() { return `<div class="sample-banner"><span class="sample-tag">DEMO DATA</span><p>All providers are fictional. Plan matches, distances, and appointment times are examples. <button data-action="about">How this works</button></p></div>`; }
function pageHeading(eyebrow, title, sub, action = '') { return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1 tabindex="-1">${title}</h1><p>${sub}</p></div>${action}</div>`; }
function dashboard() {
  const p = session.profile;
  const matches = findProviders({ ...p, condition: focusedCondition() }, initialFilters());
  return `<section class="advocate-card"><div>${(() => { const s = getAIState(); return `<div class="ally-label">${icon('leaf')} A NOTE FROM ALLY${s.results ? '' : s.loading ? ' <span>Loading…</span>' : ' <span>Scripted demo</span>'}</div><h2>${s.results ? 'Here’s what I found for you.' : 'Let’s make finding care<br>feel a little more manageable.'}</h2><p>${s.results ? escape(s.results.meta.summary) : 'I’ve organized sample care options around your preferences. You can explore, compare, and decide what feels right for you.'}</p>`; })()} <button class="primary" data-view="providers">Explore care options ${icon('arrow')}</button></div>${botanical()}</section><section class="preferences" aria-label="Your care preferences"><div class="pref-diagnoses"><span>My diagnoses</span><div class="diagnosis-pills">${(Array.isArray(p.conditions) ? p.conditions : [p.condition]).map(c => `<button class="diagnosis-pill${focusedCondition()===c?' active':''}" data-condition-switch="${escape(c)}">${escape(c)}</button>`).join('')}</div></div><div><span>Your insurance</span><strong>${escape(p.insurance)}</strong></div><div><span>Your area</span><strong>${locations[p.location].label}</strong></div><button class="text-button" data-action="profile">Edit preferences</button></section><div class="dashboard-columns"><section><div class="section-heading"><div><h2>A place to start</h2><p>Care options for ${escape(focusedCondition())}.</p></div><button class="text-button" data-view="providers">View all ${icon('arrow')}</button></div>${(() => { const s = getAIState(); return s.loading ? '<div class="provider-list"><div class="ai-loading" role="status" aria-live="polite"><div class="loading-pulse"></div><p>Ally is finding care options for you…</p></div></div>' : '<div class="provider-list">' + (s.results ? s.results.providers.slice(0, 2).map(p => agentProviderCard(p, true)) : matches.slice(0, 2).map(p => providerCard(p, true))).join('') + '</div>'; })()} <div class="section-heading resources-heading"><div><h2>A little knowledge helps</h2><p>Reliable information, at your own pace.</p></div><button class="text-button" data-view="resources">All resources ${icon('arrow')}</button></div>${resourceCard(resources.find(r => r.condition === p.condition) || resources[0])}</section><aside><section class="next-steps"><span class="eyebrow">AT YOUR PACE</span><h2>Your next small steps</h2><p>There’s no rush to do it all.</p>${[['coverage', 'Check your coverage', 'Ask your insurer about your exact plan, referral needs, and costs.'], ['questions', 'Write down your questions', 'What would help you feel more prepared for a first visit?'], ['records', 'Gather the basics', 'Keep your referral, medication list, and prior records handy.']].map(([id, title, text]) => `<label class="task"><input type="checkbox" data-task="${id}" ${session.tasks.includes(id) ? 'checked' : ''}><span><strong>${title}</strong><small>${text}</small></span></label>`).join('')}<span class="small muted">${session.tasks.length} of 3 steps checked · just for you</span></section><section class="saved-note">${icon('bookmark')}<h3>Your shortlist, in one place.</h3><p>${session.saved.length ? `You’ve saved ${session.saved.length} sample provider${session.saved.length === 1 ? '' : 's'}. Pick up where you left off.` : 'Save a provider whenever you want to come back to them.'}</p><button class="text-button" data-view="saved">View saved providers ${icon('arrow')}</button></section>${appointments()}</aside></div>`;
}
function providerCard(p, compact = false) {
  const saved = session.saved.includes(p.id);
  return `<article class="provider-card ${compact ? 'compact' : ''}"><div class="provider-top"><div class="avatar ${p.color}">${p.initials}</div><div class="provider-name"><h3>Dr. ${p.name}</h3><p>${p.specialty} <span>· Sample provider</span></p></div><button class="icon-button save ${saved ? 'is-saved' : ''}" data-save="${p.id}" aria-label="${saved ? 'Unsave' : 'Save'} Dr. ${p.name}" aria-pressed="${saved}">${icon('bookmark')}</button></div><div class="provider-facts"><span class="network ${networkLabel(p, session.profile) === 'Sample plan match' ? 'match' : ''}">${icon('check')} ${networkLabel(p, session.profile)}</span><span>${icon('pin')} ${distance(p, session.profile)} mi · sample</span><span>${icon('clock')} ${p.days} days · sample</span></div>${!compact ? `<p class="provider-description">${p.description}</p><p class="why">Why shown: sample ${p.specialty.toLowerCase()} option tagged for ${escape(session.profile.condition.toLowerCase())}. This is a rule-based demo, not an AI recommendation.</p>` : ''}<div class="provider-bottom"><label class="compare-check"><input type="checkbox" data-compare="${p.id}" ${comparison.includes(p.id) ? 'checked' : ''}> Compare</label><button class="text-button" data-provider="${p.id}">View sample profile ${icon('arrow')}</button></div></article>`;
}
function filterControls() {
  const userConds = Array.isArray(session.profile?.conditions) ? session.profile.conditions : [session.profile?.condition].filter(Boolean);
  return `<div class="filter-panel"><div class="search-field">${icon('search')}<input type="search" id="provider-search" aria-label="Search providers by name or specialty" placeholder="Search name or specialty" value="${escape(filters.query)}"></div><div class="filter-row">${userConds.length > 1 ? `<label>Diagnosis<select id="condition-filter">${userConds.map(c => `<option value="${escape(c)}" ${focusedCondition() === c ? 'selected' : ''}>${escape(c)}</option>`).join('')}</select></label>` : ''}<label>Sort<select data-filter="distance"><option value="any" ${filters.distance === 'any' ? 'selected' : ''}>Any distance</option><option value="near" ${filters.distance === 'near' ? 'selected' : ''}>Closest first</option></select></label><label class="filter-toggle"><input type="checkbox" data-filter="inNetwork" ${filters.inNetwork ? 'checked' : ''}> In-network only</label></div></div>`;
}
function directory() {
  const saved = view === 'saved';
  return `${pageHeading(saved ? 'YOUR SHORTLIST' : 'FIND YOUR NEXT STEP', saved ? 'Care worth coming back to.' : 'Find care, with a little clarity.', saved ? 'Your saved sample providers. Explore the details when you’re ready.' : `Care options for ${escape(focusedCondition())} in ${locations[session.profile.location].label}.`, `<button class="secondary" data-action="profile">Edit preferences</button>`)}${saved ? '<p class="small muted">Saved providers follow your diagnosis preference. Change it back to see providers saved for another diagnosis.</p>' : ''}${filterControls()}<div id="provider-results">${providerResults()}</div>`;
}
function providerResults() {
  const aiS = getAIState();
  if (view !== 'saved' && aiS.loading) {
    return '<div class="ai-loading" role="status" aria-live="polite"><div class="loading-pulse"></div><p>Ally is finding care options for you…</p></div>';
  }
  if (view !== 'saved' && aiS.results) {
    let list = aiS.results.providers;
    if (filters.query) list = list.filter(p => `${p.name} ${p.specialty || ''}`.toLowerCase().includes(filters.query.toLowerCase()));
    if (filters.inNetwork) list = list.filter(p => p.insurance?.status === 'in_network');
    if (filters.distance === 'near') list = [...list].sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));
    return `<div class="results-toolbar"><p role="status"><strong>${list.length}</strong> provider${list.length === 1 ? '' : 's'} found <span>· ${escape(locations[session.profile.location]?.label || session.profile.location)}</span></p></div>${list.length ? `<div class="provider-grid">${list.map(p => agentProviderCard(p)).join('')}</div>` : `<div class="empty">${icon('search')}<h2>No providers found.</h2><p>Try adjusting your preferences.</p></div>`}<p class="small muted" style="margin-top:1.5rem;text-align:center">Results from Ally’s AI · Always call providers to verify insurance, availability, and details before booking.</p>`;
  }
  const list = findProviders({ ...session.profile, condition: focusedCondition() }, filters, view === 'saved' ? session.saved : null);
  return `<div class="results-toolbar"><p role="status"><strong>${list.length}</strong> sample provider${list.length === 1 ? '' : 's'} <span>· ${locations[session.profile.location].label}</span></p><label>Sort by <select data-filter="sort">${[['relevance', 'Plan match first'], ['distance', 'Closest first'], ['availability', 'Soonest sample opening']].map(([v, t]) => `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>${list.length ? `<div class="provider-grid">${list.map(p => providerCard(p)).join('')}</div>` : `<div class="empty">${icon(view === 'saved' ? 'bookmark' : 'search')}<h2>${view === 'saved' && !session.saved.length ? 'Your shortlist starts here.' : 'No sample options fit these filters.'}</h2><p>${view === 'saved' && !session.saved.length ? 'Save a provider from Find care to keep them close.' : 'Try a broader search or reset your filters. This demo has a small fictional directory.'}</p><button class="secondary" data-action="${view === 'saved' && !session.saved.length ? 'find' : 'reset-filters'}">${view === 'saved' && !session.saved.length ? 'Explore sample providers' : 'Reset filters'}</button></div>`}`;
}
function resourceCard(r) { return `<a class="resource-card" href="${r.url}" target="_blank" rel="noopener noreferrer"><span class="resource-icon">${icon('book')}</span><div><span class="eyebrow">${r.source}</span><h3>${r.title}</h3><p>${r.text}</p><small>Read at the source · opens a new tab</small></div>${icon('external')}</a>`; }
function resourcePage() {
  return `${pageHeading('LEARN & PREPARE', 'Understanding, at your own pace.', 'A few reliable starting points, plus space to prepare for your next conversation.')}<div class="resource-notice">${icon('book')}<p>Educational information from NIH. These links can support a conversation with your care team; they do not replace medical advice.</p></div><div class="resource-tools"><div class="search-field">${icon('search')}<input id="resource-search" type="search" aria-label="Search educational resources" placeholder="Search resources" value="${escape(resourceQuery)}"></div><label>Show<select id="resource-topic"><option value="all" ${resourceTopic === 'all' ? 'selected' : ''}>All topics</option><option value="mine" ${resourceTopic === 'mine' ? 'selected' : ''}>My diagnosis & the basics</option></select></label></div><div class="resource-grid" id="resource-results">${resourceResults()}</div><section class="prepare-card"><span class="eyebrow">A CONVERSATION STARTER</span><h2>Questions you can bring to a first visit</h2><ul><li>What should I bring to my first appointment?</li><li>Do I need a referral or prior authorization?</li><li>Is this exact clinician and location in my plan’s network?</li><li>What costs should I confirm with my insurer?</li><li>Who can I contact with questions after my visit?</li></ul></section>`;
}
function resourceResults() {
  const list = resources.filter(r => resourceTopic === 'all' || !r.condition || r.condition === session.profile.condition).filter(r => `${r.title} ${r.text} ${r.source}`.toLowerCase().includes(resourceQuery.toLowerCase()));
  return list.length ? list.map(resourceCard).join('') : '<p class="empty">No resources match. Try another search or choose All topics.</p>';
}
function compareBar() { return `<div class="compare-bar" aria-label="Provider comparison"><strong>${comparison.length} of 3 selected</strong><span>See your options side by side.</span><button class="primary" data-action="compare" ${comparison.length < 2 ? 'disabled' : ''}>Compare providers ${icon('arrow')}</button><button class="text-button" data-action="clear-compare">Clear</button></div>`; }
function showComparison() {
  const list = comparison.map(id => providers.find(p => p.id === id));
  showDialog(`<span class="eyebrow">YOUR OPTIONS, SIDE BY SIDE</span><h2>A clearer comparison.</h2><p>Every value below is fictional sample data. Verify your exact plan and current availability with a real provider before booking.</p><div class="table-scroll"><table><caption class="sr-only">Comparison of selected fictional providers</caption><thead><tr><th scope="col">Compare</th>${list.map(p => `<th scope="col">Dr. ${p.name}</th>`).join('')}</tr></thead><tbody>${[['Specialty', p => p.specialty], ['Plan compatibility', p => networkLabel(p, session.profile)], ['Sample plans', p => p.plans.join(', ')], ['Sample distance', p => `${distance(p, session.profile)} miles`], ['Sample opening', p => `In ${p.days} days`], ['Next step', p => `<button class="text-button" data-provider="${p.id}">View sample profile</button>`]].map(([label, fn]) => `<tr><th scope="row">${label}</th>${list.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
}
function showProvider(id) {
  const p = providers.find(p => p.id === id);
  showDialog(`<span class="sample-tag">FICTIONAL SAMPLE PROVIDER</span><div class="detail-heading"><span class="avatar ${p.color}">${p.initials}</span><div><h2>Dr. ${p.name}</h2><p>${p.specialty} · ${locations[session.profile.location].label}</p></div></div><p>${p.description}</p><dl class="detail-facts"><div><dt>Insurance</dt><dd>${networkLabel(p, session.profile)}<small>Example plans: ${p.plans.join(', ')}. Not verified for any real clinician or exact plan.</small></dd></div><div><dt>Distance</dt><dd>${distance(p, session.profile)} miles <small>Fictional distance from the selected sample area.</small></dd></div><div><dt>Availability</dt><dd>In ${p.days} days <small>Illustrative only. No live scheduling system.</small></dd></div></dl><div class="why-box"><strong>Why Ally surfaced this option</strong><p>The fixture is tagged for ${escape(session.profile.condition.toLowerCase())}. Plan matching compares your company selection with a fictional list. This is a deterministic demonstration, not medical guidance or live AI.</p></div><div class="detail-actions"><button class="primary" data-book="${p.id}">Try demo booking ${icon('arrow')}</button><button class="secondary" data-phone="${p.id}">Preview phone action</button><button class="text-button" data-save="${p.id}">${session.saved.includes(p.id) ? 'Unsave provider' : 'Save provider'}</button></div><p class="small muted">A demo booking creates a session-only reminder, never a real appointment.</p>`);
}
function showBooking(id) {
  const p = providers.find(p => p.id === id);
  const dates = [p.days, p.days + 1, p.days + 3].map(offset => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; });
  showDialog(`<span class="sample-tag">DEMO BOOKING · NO REAL APPOINTMENT</span><h2>Try taking the next step.</h2><p>Choose an illustrative time with fictional Dr. ${p.name}. Nothing is sent to a provider.</p><form id="booking-form" data-id="${p.id}"><label>Sample date<select name="date">${dates.map(date => `<option value="${date}">${new Date(`${date}T12:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</option>`).join('')}</select></label><label>Sample time (selected area’s local time)<select name="time"><option>9:00 AM</option><option>11:30 AM</option><option>2:00 PM</option></select></label><button type="submit" class="primary full">Add demo appointment ${icon('arrow')}</button></form><p class="small muted">For real care, contact your insurer and provider to verify network status, referrals, costs, and scheduling.</p>`);
}
function appointments() {
  return session.appointments.length ? `<section class="appointment-panel"><span class="eyebrow">PRACTICE YOUR NEXT STEP</span><h3>Demo appointments</h3><p class="small muted">Not real bookings. Nothing was sent.</p>${session.appointments.map((a, i) => `<div class="appointment"><strong>Dr. ${providers.find(p => p.id === a.id).name}</strong><span>${escape(a.date)} · ${escape(a.time)}</span><button class="text-button" data-cancel="${i}">Remove demo appointment</button></div>`).join('')}</section>` : '';
}
function about() { showDialog(`<span class="eyebrow">ABOUT THIS PROTOTYPE</span><h2>Support, with clear boundaries.</h2><p>Ally is an initial healthcare navigation prototype for women with new autoimmune diagnoses, based on the Ally product pitch.</p><ul class="about-list"><li><strong>Fictional care directory.</strong> Names, plans, distances, phone numbers, and appointment openings are sample data. They are not verified.</li><li><strong>A scripted advocate.</strong> Ally uses simple matching rules. There is no live AI, diagnosis, or treatment advice.</li><li><strong>Session-only preferences.</strong> Your selections, saves, checklist, and demo appointments stay in this browser session. No analytics or account.</li><li><strong>Real educational links.</strong> Resources open NIH websites. Those sites have their own privacy policies.</li><li><strong>Research status.</strong> No prior user study was provided. Design choices are hypotheses from the product brief, not validated findings.</li></ul><button class="secondary" data-action="clear-session">Clear session & return to welcome</button>`); }

// --- Agent 1 provider rendering ---
function agentProviderCard(p, compact = false) {
  agentProviderCache[p.id] = p;
  const statusClass = { in_network: 'match', verify: 'verify', out_of_network: 'out', unknown: '' }[p.insurance.status] || '';
  const statusLabel = { in_network: '✔ In network', verify: 'Call to verify', out_of_network: 'Out of network', unknown: 'Coverage unknown' }[p.insurance.status] || 'Unknown';
  const words = p.name.trim().split(/\s+/);
  const initials = (words[0][0] + (words[words.length - 1][0] || '')).toUpperCase();
  const palette = ['teal', 'sage', 'rose', 'warm', 'slate'];
  const colorClass = palette[p.id.split('').reduce((a, c) => (a + c.charCodeAt(0)) & 0xff, 0) % palette.length];
  return `<article class="provider-card">
    <div class="provider-top">
      <div class="avatar ${colorClass}">${initials}</div>
      <div class="provider-name">
        <h3>${escape(p.name)}</h3>
        <p>${escape(p.specialty)}</p>
      </div>
    </div>
    <div class="provider-facts">
      <span class="network ${statusClass}">${icon('check')} ${statusLabel}</span>
      <span>${icon('pin')} ~${p.distanceMiles} mi</span>
      ${p.hours ? `<span>${icon('clock')} ${escape(p.hours.split(/[,;]/)[0])}</span>` : ''}
    </div>
    ${!compact ? `<p class="provider-description">${escape(p.insurance.note || '')}</p>` : ''}
    ${!compact && p.providers && p.providers.length ? `<p class="why">Providers: ${p.providers.slice(0, 3).map(pr => escape(pr.name)).join(' · ')}</p>` : ''}
    <div class="provider-bottom">
      <span></span>
      <button class="text-button" data-agent-provider="${escape(p.id)}">View details ${icon('arrow')}</button>
    </div>
  </article>`;
}
function showAgentProvider(id) {
  const p = agentProviderCache[id];
  if (!p) return;
  showDialog(`<span class="eyebrow">HEALTHCARE PROVIDER</span>
    <div class="detail-heading" style="margin-bottom:1rem">
      <h2 style="margin:0">${escape(p.name)}</h2>
      <p style="margin:.25rem 0 0">${escape(p.specialty)}</p>
    </div>
    ${p.address ? `<p>${escape(p.address)}</p>` : ''}
    <dl class="detail-facts">
      <div><dt>Insurance</dt><dd>${escape(p.insurance.note || p.insurance.status)}</dd></div>
      <div><dt>Distance</dt><dd>~${p.distanceMiles} miles</dd></div>
      ${p.phone ? `<div><dt>Phone</dt><dd>${escape(p.phone)}</dd></div>` : ''}
      ${p.hours ? `<div><dt>Hours</dt><dd>${escape(p.hours)}</dd></div>` : ''}
      ${p.rating ? `<div><dt>Rating</dt><dd>${p.rating}★</dd></div>` : ''}
    </dl>
    ${p.providers && p.providers.length ? `<div class="why-box"><strong>Providers at this location</strong><ul style="margin:.5rem 0 0;padding-left:1.25rem">${p.providers.map(pr => `<li>${escape(pr.name)} · ${escape(pr.role)}</li>`).join('')}</ul></div>` : ''}
    ${p.bookingNote ? `<p class="small muted" style="margin-top:1rem">${escape(p.bookingNote)}</p>` : ''}
    <div class="detail-actions">
      ${p.phone ? `<a class="primary" href="tel:${escape(p.phone)}">Call to book ${icon('arrow')}</a>` : ''}
    </div>
    <p class="small muted" style="margin-top:1rem">AI-generated results. Always call ahead to verify insurance coverage, provider availability, and referral requirements before booking.</p>`);
}

// Delegated events keep repeated cards and dialogs consistent without a UI framework.
document.addEventListener('click', event => {
  const target = event.target.closest('button, a'); if (!target) return;
  if (target.dataset.view) { if (dialog.open) dialog.close(); navigate(target.dataset.view); }
  if (target.dataset.save) {
    const id = target.dataset.save; session.saved = session.saved.includes(id) ? session.saved.filter(s => s !== id) : [...session.saved, id]; persist();
    const openDetail = dialog.open; render(); if (openDetail) showProvider(id); toast(session.saved.includes(id) ? 'Sample provider saved to your shortlist.' : 'Provider removed from your shortlist.');
  }
  if (target.dataset.provider) showProvider(target.dataset.provider);
  if (target.dataset.agentProvider) showAgentProvider(target.dataset.agentProvider);
  if (target.dataset.conditionSwitch) { switchCondition(target.dataset.conditionSwitch); }
  if (target.dataset.book) showBooking(target.dataset.book);
  if (target.dataset.phone) {
    const p = providers.find(p => p.id === target.dataset.phone);
    showDialog(`<span class="sample-tag">SAMPLE PHONE ACTION</span><h2>A call, with a little preparation.</h2><p>Dr. ${p.name} is fictional. The number below is a reserved example number, not a care office.</p><p>For a real appointment, use your insurer’s directory to find an office number and verify your exact plan.</p><a class="primary" href="tel:${p.phone}">Open phone app · sample number ${p.phone}</a><p class="small muted">This demonstrates a phone link. It will not connect you to a real provider.</p>`);
  }
  if (target.dataset.cancel !== undefined) { session.appointments.splice(Number(target.dataset.cancel), 1); persist(); render(); toast('Demo appointment removed.'); }
  switch (target.dataset.action) {
    case 'close': dialog.close(); break;
    case 'home': navigate(session.profile ? 'dashboard' : 'welcome'); break;
    case 'demo': session.profile = { ...demoProfile }; persist(); navigate('dashboard'); break;
    case 'onboard': profileForm(); break;
    case 'profile': profileForm(true); break;
    case 'about': about(); break;
    case 'find': navigate('providers'); break;
    case 'reset-filters': filters = initialFilters(); render(); break;
    case 'compare': showComparison(); break;
    case 'clear-compare': comparison = []; render(); break;
    case 'clear-session': session = { profile: null, saved: [], appointments: [], tasks: [] }; comparison = []; persist(); dialog.close(); navigate('welcome'); break;
  }
});
document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.filter) { filters[el.dataset.filter] = el.type === 'checkbox' ? el.checked : el.value; document.querySelector('#provider-results').innerHTML = providerResults(); }
  if (el.dataset.compare) {
    if (el.checked && comparison.length === 3) { el.checked = false; toast('Compare up to three providers. Uncheck one to choose another.'); return; }
    comparison = el.checked ? [...comparison, el.dataset.compare] : comparison.filter(id => id !== el.dataset.compare);
    document.querySelector('.compare-bar')?.remove(); if (comparison.length) app.insertAdjacentHTML('beforeend', compareBar());
  }
  if (el.dataset.task) { session.tasks = el.checked ? [...session.tasks, el.dataset.task] : session.tasks.filter(t => t !== el.dataset.task); persist(); const count = document.querySelector('.next-steps > .small'); count.textContent = `${session.tasks.length} of 3 steps checked · just for you`; }
  if (el.id === 'resource-topic') { resourceTopic = el.value; document.querySelector('#resource-results').innerHTML = resourceResults(); }
  if (el.id === 'condition-filter') { switchCondition(el.value); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'provider-search') { filters.query = event.target.value; document.querySelector('#provider-results').innerHTML = providerResults(); }
  if (event.target.id === 'resource-search') { resourceQuery = event.target.value; document.querySelector('#resource-results').innerHTML = resourceResults(); }
});
document.addEventListener('submit', event => {
  if (event.target.id === 'profile-form') { event.preventDefault(); const fd = new FormData(event.target); const profileData = Object.fromEntries(fd); profileData.conditions = fd.getAll('conditions'); delete profileData.condition; if (!profileData.conditions.length) { toast('Please select at least one diagnosis.'); return; } session.profile = profileData; activeCondition = null; for (const k in aiCache) delete aiCache[k]; agentProviderCache = {}; comparison = []; persist(); dialog.close(); navigate('dashboard'); }
  if (event.target.id === 'booking-form') {
    event.preventDefault(); const id = event.target.dataset.id; const values = Object.fromEntries(new FormData(event.target));
    if (!session.appointments.some(a => a.id === id && a.date === values.date && a.time === values.time)) session.appointments.push({ id, ...values });
    persist(); dialog.close(); navigate('dashboard'); toast('Demo appointment added. This is not a real booking.');
  }
});
dialog.addEventListener('click', e => { if (e.target === dialog && (e.clientX < dialog.getBoundingClientRect().left || e.clientX > dialog.getBoundingClientRect().right || e.clientY < dialog.getBoundingClientRect().top || e.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
render();
if (session.profile) {
  const initConds = Array.isArray(session.profile.conditions) ? session.profile.conditions : [session.profile.condition].filter(Boolean);
  initConds.forEach(c => fetchAIForCondition(c));
}
