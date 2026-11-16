# Ally

A calm healthcare navigation prototype for women with new autoimmune diagnoses. The product and its fixed advocate are both named **Ally**.

**Project site:** https://ashleytagge.github.io/Ally/  
**Repository:** https://github.com/ashleytagge/Ally

## Run and validate

Node.js 22 or newer. The application and build have **no package dependencies**.

```sh
npm run dev
# Open http://127.0.0.1:4173/Ally/
npm test
npm run build
npm run preview
```

The preview server deliberately supports `/Ally/` to catch project-subpath asset issues. `dist/` is the deployable output and is ignored in Git. All paths are relative; there is no client-side history router or server requirement.

Optional full browser regression (start the preview server first):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/browser.mjs
```

`ALLY_URL` selects a different local or deployed URL. `SCREENSHOTS` selects the output directory. `CHROME_PATH` optionally selects an installed Chrome executable. `PLAYWRIGHT_MODULE` optionally points to an existing Playwright module. The browser regression exercises onboarding, exploration, all provider filters, sorting, saving/reload, comparison and its three-provider limit, phone link preview, demo booking/removal, checklist, resources, preference changes, fresh-session behavior, and narrow layouts. Unit tests cover matching, unknown insurance, combined filters, locations, and malformed session storage.

## What works

- Welcome screen with onboarding and immediate demo exploration.
- Editable diagnosis, insurance company, and sample-area preferences.
- Personalized dashboard with a scripted note from Ally and a care preparation checklist.
- Six fictional providers, filtered for the selected diagnosis. Search name/specialty; filter specialty, sample plan match, distance, availability; sort by plan match, distance, or opening.
- Up to three providers compared side by side, with explicit sample values and matching explanations.
- Saved shortlist retained across reloads in the same browser session.
- Provider profiles with a functional simulated booking form, session-only demo appointments, and removal.
- Phone-app links using reserved fictional 202-555-01xx numbers, behind an explicit sample-phone preview. They do not reach real providers.
- Condition-specific NIH educational resources with topic/search controls.
- Responsive layouts, keyboard-operable controls, native modal dialogs, status announcements, visible focus styles, skip navigation, reduced-motion support.

## Deliberate prototype limits

**This is not a clinical or insurance product.** Every provider, plan association, distance, opening, and phone number is fictional. Booking is a simulation; no request is transmitted. There is no live provider API, AI model, geolocation, exact-plan lookup, or real appointment connection. Location is limited to three explicit sample areas: Denver, Salt Lake City, and Phoenix. Distances are fixtures scaled for those areas, not calculated geography. An insurance company match cannot establish coverage for a specific plan, clinician, facility, or service. Unknown/self-pay choices never receive a positive plan match.

The advocate is named Ally and uses transparent deterministic rules, not AI. Medical decisions remain with healthcare professionals. Educational links open external NIH pages with their own privacy policies.

Preferences, saved provider IDs, checklist values, and demo appointments use `sessionStorage` under `ally-session-v1`. They survive refreshes in the same tab and can be cleared through **About this prototype → Clear session & return to welcome**. Browsers can restore sessions or copy session state into duplicated tabs; this is not secure clinical storage. If storage is blocked, the UI continues in memory. No backend, accounts, analytics, cookies, tracking scripts, or external font requests. Avoid real sensitive medical data in this prototype. Fonts are self-hosted under SIL Open Font Licenses in `src/fonts/`.

## Architecture / Claude Code handoff

| File | Responsibility |
| --- | --- |
| `src/data.js` | Fictional provider fixtures, diagnoses, insurers, sample areas, NIH resources |
| `src/model.js` | Pure matching/filtering/sorting, plan labels, distance fixtures, session validation |
| `src/app.js` | Named rendering functions for screens/cards/dialogs and delegated UI events |
| `src/styles.css` | Sage palette, typography, layouts, responsive rules, focus and motion handling |
| `src/fonts.css`, `src/fonts/` | Local fonts and licenses |
| `scripts/build.mjs` | Copies static assets to `dist/`, checks relative entry paths |
| `scripts/serve.mjs` | Small local-only preview server |
| `tests/model.test.mjs` | Dependency-free domain tests |
| `tests/browser.mjs` | End-to-end desktop/mobile regression with optional Playwright |
| `.github/workflows/pages.yml` | Tests/builds main and deploys to this repository’s Pages site |

To extend the prototype, start by reading `src/data.js` and `src/model.js`. Keep data access out of rendering functions when adding a real provider service. Replace fictional plan matches only with explicit evidence for exact plan/location, including verification timestamps and unknown states. Replace simulated booking only after a real integration exists. Never put provider-service or model API keys in this static client. Any future AI integration needs a server-side boundary, reviewed prompts, source attribution, uncertainty handling, and a clear clinical scope. Update the demo labels only when the corresponding data is actually verified.

The first implementation intentionally uses vanilla JavaScript modules rather than a framework. Named screen and card functions keep future extraction into components straightforward. User-controlled strings are escaped before insertion into HTML; fixture IDs drive actions. No build tool or package lock is needed for the dependency-free shipped site.

## GitHub Pages deployment and homepage preservation

Deploy **only `ashleytagge/Ally`**. The Pages workflow runs on pushes to `main` or manual dispatch. In this repository’s Settings → Pages, select **GitHub Actions** as the source. The published path must be `/Ally/`. No `CNAME`, domain changes, or writes to the root homepage repository are needed or intended. See [GitHub’s Pages setup documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

For changes: run tests/build, commit, push `main`, wait for **Deploy Ally to GitHub Pages**, and exercise the published URL. To revert a future change, revert its commit and let the same workflow deploy the prior behavior.

## Design rationale and research status

The source brief is the uploaded **Ally.pdf** pitch by Carley Andelin and Ashley Thornton, plus the owner’s explicit preferences: sage aesthetic, minimal/simple language, both entry paths, sample-data priority, fixed Ally advocate name, and project-subpath deployment.

**No prior user study exists for this project, and no findings are claimed.** The rubric’s 16-point previous-study criterion cannot honestly be fulfilled by invented evidence. The following are design hypotheses from the pitch, pending user evaluation:

| Brief statement or requirement | Visible design decision | Validation still needed |
| --- | --- | --- |
| Newly diagnosed women face disconnected care and insurance systems | Preferences, provider options, resources, and next steps share one dashboard | Can participants find their first useful action without coaching? |
| Complex systems can feel overwhelming | Quiet sage palette, short copy, progressive profile details, one main dashboard action | Does the layout improve clarity for intended users, including those with fatigue? |
| Users need to decide among providers | Search and filters plus side-by-side comparison and a saved shortlist | Can participants explain their choice and identify which facts need checking? |
| Bad medical/insurance guidance is a stated risk | Explicit fictional labels, unknown coverage, rule explanations, no clinical advice | Do participants correctly distinguish sample matches from verified coverage? |
| Resources should support access to care | NIH links plus a preparation checklist, reachable from dashboard and navigation | Can participants return to a resource through both routes? |

A suggested next study (not conducted): recruit 4–6 people representative of the audience, use fictional scenarios, ask them to onboard, find two options, compare/save, explain uncertainty, and try a demo booking. Record completion, wrong turns, whether help was needed, and trust/uncertainty interpretations. Do not collect diagnoses or insurance identifiers unnecessarily. Use actual findings to revise and document the design before claiming research grounding.

## Educational sources

These authoritative public resources were checked while building the prototype on November 16, 2026. Link descriptions identify the topics without making treatment recommendations.

- [NIAMS: Autoimmune diseases](https://www.niams.nih.gov/health-topics/autoimmune-diseases)
- [NIAMS: Rheumatoid arthritis](https://www.niams.nih.gov/health-topics/rheumatoid-arthritis)
- [NIAMS: Lupus](https://www.niams.nih.gov/health-topics/lupus)
- [NIDDK: Celiac disease](https://www.niddk.nih.gov/health-information/digestive-diseases/celiac-disease)
- [NIDDK: Hashimoto’s disease](https://www.niddk.nih.gov/health-information/endocrine-diseases/hashimotos-disease)
