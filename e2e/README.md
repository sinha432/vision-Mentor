# E2E checks

Playwright (Python) smoke suite for the interviewer flow. Runs with a fake
webcam/mic against the dev server on http://localhost:8080:

    python3 e2e/interviewer.e2e.py

It loads the welcome, dashboard, interviewer intro, setup and interview
screens, captures screenshots to /tmp/browser/vmx/shots, and prints any
console/page errors so route or build breakages surface immediately.
