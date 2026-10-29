# Verification record

Environment: Node **24.19.0**, npm **11.9.0**, SQLite via `node:sqlite`, Linux system Chromium; tests use fictional data. Verification performed on **29 October 2026 (Asia/Kolkata)**. This records actual executed checks, not a production certification.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed; no ESLint errors or warnings |
| `npm test` | **20 passed, 0 failed, 0 skipped**; real HTTP + isolated SQLite |
| `npm run build` | Passed with Vite 7.3.7 |
| `npm run test:browser` | **10 steps passed** in real Chromium; seven required-view screenshots plus a focused discovery screenshot |
| Browser console / server logs | No unexpected console errors, page exceptions, HTTP 5xx responses, or server exceptions during the walkthrough; the intentionally rejected login generates an expected 401 |
| Clean source copy | `npm ci`, initialization and seeding twice, build, production start, health, six events, and demo login passed; no duplicate fixtures |
| `npm run dev` | Vite HTML and `/api/health` + six events passed through its proxy; processes stopped afterward |
| Report validation | All required headings; both template images preserved; six embedded genuine figures; PDF rendered and sampled visually |
| `npm audit --audit-level=low` | Passed; zero reported vulnerabilities at verification time |

## API scenarios exercised

The 20 tests in `tests/api.test.js` cover repeatable migration/seeding, database health, signup/password hashing, ignored role escalation, unique case-insensitive emails, invalid fields and Unicode password limits, invalid login, successful login, safe cookie attributes, database search/filter/empty results/date ordering, anonymous and student organizer-access rejection, event validation and creation, a second organizer's ownership rejection, successful and duplicate registration, another student's private-data isolation, confirmed attendees, capacity reduction limits, full-event rejection, cancellation and reactivation without duplicate rows, closed/past events, cancellation cutoff, competing last-seat requests (one 201 and one 409), malformed requests, origin and content-type protections, cascading event deletion, reopening persistent SQLite, logout, and auth throttling.

A first run found a typo in the race test's attendee URL. That test was corrected to use the actual organizer endpoint and rerun. No failing test was removed or disabled. Initially selected router/Vite versions had dependency advisories; they were updated before the final successful run.

## Browser walkthrough

The ten named steps in `tests/browser.js` exercise:

1. Six seeded events and the real discovery screenshot.
2. Search, category filters, and empty-state reset.
3. A fresh student's signup and logout.
4. Wrong-password feedback and a successful student login.
5. Booking, updated seats, confirmation, and details screenshot.
6. Dashboard, cancellation, reload persistence, and re-registration.
7. Student denial on the organizer page.
8. Organizer statistics and the private confirmed-attendee list.
9. Organizer event creation, editing, closing, and deletion.
10. Mobile discovery at **390 × 844**, no horizontal page overflow, and custom 404.

Screenshots are captured from this walkthrough's temporary database. The temporary browser server runs on 3101, then shuts down and deletes that database. It does not change normal demo data. The browser is fixed to Asia/Kolkata for consistent report screenshots; the application itself displays viewer-local times.

## Boundaries

- Source uses JavaScript; a TypeScript type-check is not applicable.
- Checks are focused API integration tests and a Chromium walkthrough. No separate unit suite, Firefox/WebKit run, Lighthouse/WAVE score, full assistive-technology audit, load test, or independent penetration test is claimed.
- The capacity test exercises simultaneous HTTP requests against SQLite's serialized writer path; it is not a distributed load benchmark.
- Keyboard focus, semantic labels, status/error announcements, skip link, mobile layout, local assets, and high-contrast primary controls are implemented. Do not infer formal WCAG certification from these checks.
- No public hosting or deployment was performed. Git publication and environment publication are separate operations.
