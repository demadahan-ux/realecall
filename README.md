# RealeCall website

Real people. Clear processes. An extension of your team.

Source repository: https://github.com/demadahan-ux/realecall

This repository contains the website source. Hosting and account-specific integration settings are configured separately.

A responsive RealeCall website with two presentations of the original blue brand:

- `/` and `/royal-blue`: Royal Blue & White
- `/soft-ice`: Soft Ice & Ocean
- `/ops`: owner-only inquiry desk

The page includes an original conversation illustration, interactive service explorer, founder introduction, swipeable feedback cards, team results, tool icons, support-team choices, FAQ answers and a three-step inquiry form. The feedback slider supports touch, keyboard navigation, previous/next buttons, and reduced motion. Stars appear only on supplied rated reviews; the team commendation is shown as a quote without an invented rating. A footer link switches palettes. Quick Answers is an FAQ interface; AI is intentionally deferred.

## Inquiry flow

Visitors may request a discovery call, proposal, or written answer. The form collects contact preferences, business and support requirements, and consent. Discovery calls can be booked through the configured Calendly event, RealeCall Discovery Call. Calendly checks live availability and sends its booking confirmation; a submitted inquiry alone does not reserve an appointment. A manual date preference remains a request for the team to confirm. Inquiry acknowledgements are implemented and send only after the selected email provider is configured.

The server validates submissions, saves them in the website database and returns a reference. Retries with the same request ID are idempotent. Owner review at `/ops` includes full requirements and CSV export. The view is limited to the 200 highest-priority inquiries and is protected using Sites-authenticated identity and the configured owner allowlist.

Requests for four or more agents are flagged P1. Other inquiries use a transparent 100-point starting rubric: team size 25/10, timing 20/10, ongoing work 20 or short projects 5, budget 15/5, decision role 15/10, and service needs 5. P1 begins at 75; P2 at 45. Qualification is a review aid, never an automatic promise or rejection.

## Current scope

The website source is maintained in this repository and packaged for Sites hosting. Publishing a GitHub commit does not automatically deploy the website; Sites source packaging and publication remain a separate step. The supplied GitHub repository's original README description is retained above. This public source export excludes the private hosting manifest, connected-account identifiers, generated account-specific Apps Script, runtime credentials, and lead records.

The lead form saves to the website database. The Google Sheets integration supports Leads, Follow-ups, Overdue, No Show, Closed Slots, and Follow-up Setup tabs. Apps Script templates and the no-show email sequence are prepared in `automation/`; they require deployment and account authorization before they run. Calendly uses the event URL supplied in runtime configuration. No SMS provider is connected.

The follow-up sequence requires an actual host-marked no-show, offers live Calendly availability over the next three customer-local days, follows up three local days after the first accepted email, and closes after another three days if the client has not rebooked. It stops on a new booking, cancellation, attendance, or a team stop flag. Before activation, configure the persistent Calendly credential, sender/reply address, Apps Script deployment, and a website URL clients can access. See `automation/README.md`.

Runtime configuration uses Sites environment variables. `ADMIN_EMAILS` is the authorised account list. `RATE_LIMIT_SALT` is a server secret. Integration settings and activation steps are documented in `automation/README.md`; never include credential values in source control. Runtime environment files, database contents, and lead exports are excluded from this repository.

Hosting access is managed separately from this public source repository. Metadata intentionally prevents indexing until the owner chooses to enable it.

## Verification

`node --experimental-strip-types scripts/check-flow.mjs` checks persistent intake, qualification boundaries, validation, duplicate handling, rate limits, and owner access in an in-memory database. `node scripts/check-google.mjs` and `node scripts/check-followups.mjs` exercise the automation with in-memory mocks. `tsc --noEmit` checks the source. Build and package with the Sites build helper in its managed environment. For a fresh standalone checkout, install with the package manager version declared in `package.json` and use `pnpm dev` / `pnpm build`; production needs the declared Cloudflare bindings and runtime secrets. Browser QA was unavailable in the managed environment; no visual browser pass is claimed.

## Brand

The supplied logo reference is displayed with its original blue tones in the header, footer and intake. The hero illustration and service visuals are native SVG/CSS, with no fabricated partner logos, testimonials or performance statistics.

## Confirmation emails

New inquiries are saved before attempting their email acknowledgement. The receipt includes the reference, selected services, agent band, preferred contact method and requested date/time/time zone. It does not include internal qualification scores or free-text client messages. It clearly distinguishes a received request from a confirmed appointment.

The server uses Resend over HTTPS, with a domain-scoped sending key kept in runtime secrets. Configure `CONFIRMATION_EMAIL_FROM` as a verified plain email address, optional `CONFIRMATION_EMAIL_REPLY_TO`, secret `RESEND_API_KEY`, and set `CONFIRMATION_EMAIL_ENABLED=true` only after sender verification. No credentials or sender address are assumed from the website owner's personal email.

Each receipt uses the recipient in the saved inquiry, a frozen message payload, a unique idempotency key and an atomic send lease. Email failures never undo a saved inquiry. The owner desk has a preview and an explicit retry button. A maximum of three attempts is permitted. Uncertain sends older than 23 hours require provider-history review, because the provider's idempotency window expires after 24 hours. Provider acceptance is labelled accurately and does not assert inbox delivery. Existing inquiries are not automatically backfilled; the owner can explicitly send their receipt after activation.

The confirmation preview is owner-only and uses a restrictive Content Security Policy. The test suite mocks the email service and verifies sender gating, recipient selection, template escaping, duplicate prevention, failure isolation, stable retry content and expired-key protection without sending real messages.

Provider references: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys .

## Local configuration

1. Copy `.openai/hosting.example.json` to `.openai/hosting.json`. Keep the real Sites project identifier in the ignored local file and use the Sites workflow to configure it for publication.
2. Copy `automation/config.example.json` to `automation/config.json` and fill in the private tracker and Calendly identifiers plus the intended website URL. Never commit this file.
3. Run `node scripts/generate-google.mjs` to produce the ignored `automation/Code.gs` for Apps Script deployment and local automation checks.
4. Keep API tokens and signing secrets in runtime secrets or Google Script Properties. This repository contains no live account connection or customer records.

Changes to the feedback UI are in `app/client-feedback.tsx` and `app/client-feedback.css`. Review content provenance is documented in `assets/feedback-sources.md`.
