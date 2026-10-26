# Quick App Launch

Unzip the project and run it locally.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 5000
```

The app is configured to run on port 5000 for local development.

### Interview coaching features

Interview questions can be grounded in an optional job description and resume excerpts. The app
validates every displayed citation against the supplied source text; the full job description is
kept in the local draft/session and only cited excerpts are included when a signed-in interview is
synced to MongoDB. The dashboard also builds a transparent, BKT-style skill estimate from scored
answers and shows interview model latency, retry and fallback metadata without storing answer text
in telemetry.

Cloud camera/audio analysis is off by default. Candidates can opt in during setup and revoke
consent during the interview; revocation prevents future media-analysis requests, but cannot recall
a request already sent. Local on-device metrics and typed answers remain available without opt-in.
Model-call telemetry contains operational metadata only and excludes raw media and candidate text.
Live coaching does not assess appearance, hair, or grooming. The report's optional appearance review
has separate consent and sends saved camera frames, without audio, to the configured AI provider.
Deleting an interview from the dashboard removes its local copy and, when signed in, its
owner-scoped MongoDB copy.

Run the focused interview feature regression suite with `npm run test:interview`.

### Schedule confirmation email

Company interview scheduling uses the existing EmailJS service. Configure a separate EmailJS template for candidate confirmations with these template variables:

`to_email`, `candidate_name`, `candidate_email`, `role`, `interview_date`, `interview_time`, `duration`, `notes`, `timezone`, `google_calendar_url`, and `app_name`.

Set its template ID as `EMAILJS_SCHEDULE_TEMPLATE_ID` in `.env`. The candidate receives the confirmation email with a prefilled Google Calendar link. The link uses the scheduler's browser timezone.

### Assessment invitation email

Assessment publishing can email the test link to up to 25 selected registered candidates. Configure `EMAILJS_ASSESSMENT_TEMPLATE_ID` with an EmailJS template using `to_email`, `candidate_name`, `candidate_email`, `assessment_title`, `test_link`, `company_name`, and `app_name`. Connect the existing EmailJS service to a verified shared Gmail account; invitations are sent from that configured account, not from each company's mailbox. Set `APP_BASE_URL` to the deployed site's public origin so invitation links point to the correct environment. Assessment invitations are sent only after MongoDB confirms the assessment was saved.
