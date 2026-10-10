# RealeCall Google activation

Copy `config.example.json` to the ignored private `config.json` and configure the tracker, Calendly identifiers, and website URL there. Use `https://demadahan-ux.github.io/realecall/` as the client website URL. Both page designs save inquiries in D1 first. Google syncing and confirmation emails remain disabled until the Google web app is authorised, deployed and verified.

1. Sign in to Google Apps Script with the account authorised to send RealeCall acknowledgements and edit the lead tracker.
2. Run `node scripts/generate-google.mjs` locally, then create a standalone script and paste the generated `Code.gs`. This ignored local file contains private integration identifiers and must not be committed. Regenerate after template or configuration edits.
3. In Project Settings, add Script Properties `WEBHOOK_SECRET` (a random value of at least 32 characters, also stored as a Site secret) and `EMAIL_ENABLED=true`. An optional `REPLY_TO` must be a monitored business email. The sender is the deploying Google account with display name RealeCall.
4. Use `appsscript.json` for the manifest. Run `setupRealeCall` and authorise spreadsheet editing and sending mail. No inbox-read scope is requested.
5. Deploy a Web app with Execute as Me and access Anyone. Every POST still requires the shared secret. GET exposes no lead information. Do not publish or share the spreadsheet publicly.
6. Set the Site secrets `APPS_SCRIPT_URL` and `WEBHOOK_SECRET`. Send a server-side authenticated `{action:"check",secret:...}` request and verify `version:4`, the exact spreadsheet ID, `emailEnabled:true` and a positive email quota. Set `GOOGLE_EMAIL_ENABLED=true` only after this check. Keep the Resend sender disabled to avoid duplicate providers.
7. Publish the new environment revision. Submit one labelled test inquiry to an explicitly authorised test recipient, check the matching sheet row and email acceptance, then verify receipt with the recipient. A successful provider call does not prove inbox delivery.

Inquiries are deduplicated by request ID. The script locks writes, escapes spreadsheet formulas, records email state before sending and never automatically repeats an uncertain MailApp send. Quota-limited receipts remain pending and can be retried from the inquiry desk. Transient network failures retain the original inquiry for a retry with the same reference.

Tests: `node --experimental-strip-types scripts/check-flow.mjs`, `node scripts/check-google.mjs`, `node node_modules/typescript/bin/tsc --noEmit`. These use local fixtures and do not prove live Google authorisation or email delivery.


## Calendly bookings

Configure the intended 30-minute event URL and its user, organization, and event-type URIs in the private local configuration. The actual Calendly scheduler remains the source of availability.

Clients save their inquiry, select an available time, and finish booking in Calendly. Calendly confirms the appointment and handles its calendar invitation/confirmation email. The RealeCall acknowledgement is only an inquiry receipt. The browser’s Calendly event changes the visible confirmation, but never writes a “Confirmed” sheet status by itself.

To activate verified booking updates:

1. In Calendly’s API & Webhooks settings, create a personal access token with the needed read scopes (`users:read`, `scheduled_events:read`) and `webhooks:read`/`webhooks:write`. Put it directly in the Google script’s **Script Properties** as `CALENDLY_API_TOKEN`; never paste it into chat or source. The connected host must match `config.json`. Calendly currently requires an eligible paid plan for webhook subscriptions; do not purchase or upgrade automatically.
2. Deploy the generated `Code.gs` with its updated `appsscript.json`. After Google authorisation, run `setupCalendlyWebhook`. The script creates a user-scoped subscription for created/canceled invitees and a five-minute retry trigger for temporary failures. It checks existing subscriptions first. It returns no secrets. Keep this callback URL private; it contains an authentication token.
3. The webhook token only permits a provider-event wake-up. The script retrieves the invitee and scheduled event directly from Calendly, checks the configured event type and host, then matches the site reference plus the invitee email to the existing lead row. It records confirmed/canceled status, start/end UTC, the invitee’s time zone, and the meeting link in **AI:AS**. It follows reschedules and ignores old bookings, unrelated event types and mismatched recipients. It records the email provider, not a claim of inbox delivery.
4. Verify a labelled booking using a user-approved test slot/recipient, check that the actual Calendly email arrives, and confirm the matching tracker row. Test cancellation/rescheduling only for that explicitly disposable test booking. Enable `CALENDLY_SHEET_SYNC_ENABLED=true` in Sites only after a live update succeeds, then deploy the environment revision.

`CALENDLY_API_TOKEN`, `CALENDLY_WEBHOOK_SECRET`, and Google mail authority remain in Google Script Properties; they never reach the website client. Pending provider events are retained with minimal references and retried, so closing the landing page does not stop updates. Script quotas and trigger execution still apply. Inspect `CALENDLY_LAST_ERROR` and trigger failures if updates stop. No Calendly subscription, test appointment, webhook or trigger has been created by the source-only preparation.

## No-show and rescheduling sequence (prepared; activation required)

The `Follow-ups` tab is the master appointment follow-up ledger. `Overdue`, `No Show`, and `Closed Slots` are formula views. `Follow-up Setup` contains the three complete, non-promotional email drafts and the current activation status. The master `Leads` tab keeps the original inquiry and verified booking fields. Existing records do not imply that automatic sync is active.

`Followups.template.gs` is assembled into `Code.gs` by `node scripts/generate-google.mjs`. It uses the same restricted tracker, Google sender and persistent Calendly API connection as the inquiry integration. Needed Calendly permissions include reading events/invitees and availability, and canceling the original missed event. The ChatGPT Calendly connection alone is not a background website credential.

Activation, after the existing Google deployment/Calendly webhook connection has been verified:

1. Set a monitored `REPLY_TO` in Apps Script Properties. Verify that `WEBSITE_URL` in the generated script is the intended client-accessible website. Do not enable closing emails until clients can open their booking destination.
2. Set `FOLLOWUP_WEBSITE_READY=true` only after that verification. Keep Calendly's native no-show workflow off for this event type if this custom sequence is enabled, to avoid two independent sequences. Ordinary Calendly appointment confirmations remain on.
3. Run `setupNoShowFollowups`. It checks the host, sender flags and sheet headers, records an activation timestamp and creates one 15-minute trigger. It does not retroactively email no-shows from before activation.
4. Validate with an authorized test recipient and real no-show/reschedule cases. Then update the `Follow-up Setup` activation notes and the Site environment `FOLLOWUP_EMAIL_ENABLED=true`. Never set the Site flag ahead of the tested Google trigger.

Cadence: a host marks an actual missed meeting as **No show in Calendly**. An elapsed appointment alone becomes `Awaiting attendance`; it never sends a no-show message. The first email suggests up to three currently available slots across the next three days, using the invitee's actual Calendly timezone. Clients choose and confirm the replacement time; the script never books one for them. If the original reschedule URL no longer works, the same email also offers the verified event booking URL.

After the first email is accepted by Google, wait three local calendar days before the gentle check-in. After that email is accepted, wait another three local days before closing. Send between 09:00 and 18:00 in the client's timezone, preserving local time across DST. Empty near-term availability is stated honestly and the calendar offers later dates. Suggested times are not held and Calendly rechecks availability at booking.

Before every email the script verifies the original invitee, host/event type, original lead email and consent, and searches for a new future booking under the same email/event type. Rebooking, cancellation, `Team attendance=Attended`, or the `Stop follow-ups` checkbox stops the sequence. Replies are handled by the team; tick Stop follow-ups when taking over. Inbox replies are not automatically read.

On the last step, cancel only the original **past one-to-one** appointment, verify Calendly's canceled state, and then send the closing note with the website link. This never removes a future replacement booking. Calendly can also send its own cancellation notification. If cancellation cannot be confirmed, the closing email is held and the issue appears in the tracker.

Accepted means the email provider accepted the send, not confirmed delivery. A durable sending marker prevents duplicate delivery when a result is uncertain. Quota/provider failures do not advance the sequence. `Needs review` cases must be checked in Sent mail before any manual retry. SMS is not configured; the implemented channel is email.

Run `node scripts/check-followups.mjs` for isolated tests of the full cadence, timezone/DST boundaries, stop conditions, provider failures, duplicate prevention and calendar closure. These tests use fixtures; they send no real email and create/cancel no real appointments.
