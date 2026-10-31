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

### Nova individual-mode handheld object detection

Nova's current primary object model is MediaPipe EfficientDet Lite0 trained with the COCO 80-class
label set. It includes `cell phone`, but has no wallet, calculator, notebook, or ID-card class.
Consequently, a wallet that resembles a phone can be mislabeled as `cell phone`; raising a score
threshold cannot create the missing distinction.

The primary detector's label, category index, confidence, and bounding box are logged in development
tools. Its generic `cell phone` prediction is not shown as a possible phone: without a custom
classification result, the status is uncertain because this model cannot distinguish a wallet from a
phone. Phone warnings are fail-closed: EfficientDet alone cannot confirm a phone. To enable
confirmation, provide both MediaPipe-compatible TFLite models:

- Object detector: `public/models/visionmentor-handheld-detector.tflite`
- Crop image classifier: `public/models/visionmentor-handheld-classifier.tflite`

Both models must have TFLite metadata and labels `PHONE`, `WALLET`, `CALCULATOR`, `NOTEBOOK`, and
`OTHER` (the classifier may also include `ID_CARD`). The detector classifies the frame and supplies
the object box; the image classifier evaluates only that crop. A phone is considered verified only
when both models identify PHONE above their configured thresholds on at least 5 of the last 8
processed object frames. A wallet or conflicting classification resets phone history. Without both
models, detections are shown as uncertain and cannot create phone warnings.

No custom model or training dataset is included. Before enabling the classifier, gather labeled,
consented examples of phones, wallets, calculators, notebooks, ID cards, and other objects across
orientations, hands/table placement, lighting, and partial occlusion. Split training and validation
sets by physical item and capture session. Train a compact object detector and a crop image
classifier, export both as TensorFlow Lite models with MediaPipe ObjectDetector/ImageClassifier
metadata and the required labels, then place them at the paths above. Validate with held-out webcam
examples; model performance and wallet false-positive rate have not been measured by this
repository.

### Schedule confirmation email

Company interview scheduling uses the existing EmailJS service. Configure a separate EmailJS template for candidate confirmations with these template variables:

`to_email`, `candidate_name`, `candidate_email`, `role`, `interview_date`, `interview_time`, `duration`, `notes`, `timezone`, `google_calendar_url`, and `app_name`.

Set its template ID as `EMAILJS_SCHEDULE_TEMPLATE_ID` in `.env`. The candidate receives the confirmation email with a prefilled Google Calendar link. The link uses the scheduler's browser timezone.

### Assessment invitation email

Assessment publishing can email the test link to up to 25 registered candidates or manually entered email addresses. Recipients need to sign in or create an individual account with the invited email before starting the test. Configure `EMAILJS_ASSESSMENT_SERVICE_ID`, `EMAILJS_ASSESSMENT_TEMPLATE_ID`, `EMAILJS_ASSESSMENT_PUBLIC_KEY`, and `EMAILJS_ASSESSMENT_PRIVATE_KEY`; the EmailJS template uses `to_email`, `candidate_name`, `candidate_email`, `assessment_title`, `test_link`, `company_name`, and `app_name`. Connect the service to a verified shared Gmail account; invitations are sent from that configured account, not from each company's mailbox. Set `APP_BASE_URL` to the deployed site's public origin so invitation links point to the correct environment. Assessment invitations are sent only after MongoDB confirms the assessment was saved.
