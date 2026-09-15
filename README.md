# Quick App Launch

Unzip the project and run it locally.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 5000
```

The app is configured to run on port 5000 for local development.

### Schedule confirmation email

Company interview scheduling uses the existing EmailJS service. Configure a separate EmailJS template for candidate confirmations with these template variables:

`to_email`, `candidate_name`, `candidate_email`, `role`, `interview_date`, `interview_time`, `duration`, `notes`, `timezone`, `google_calendar_url`, and `app_name`.

Set its template ID as `EMAILJS_SCHEDULE_TEMPLATE_ID` in `.env`. The candidate receives the confirmation email with a prefilled Google Calendar link. The link uses the scheduler's browser timezone.
