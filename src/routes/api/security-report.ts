import { createFileRoute } from "@tanstack/react-router";

const REPORT = `# Vision Mentor X — Security Report

Generated for the dependency-vulnerability remediation cycle.

## 1. Original finding (critical)

| Field | Value |
| --- | --- |
| Internal ID | vulnerable_dependencies_critical |
| Severity | Critical |
| Package | seroval (transitive) |
| Vulnerable version installed | 1.5.2 |
| Advisory | GHSA-mv8w-475r-vwqw |
| Reached through | @tanstack/router-core, @tanstack/start-client-core, @tanstack/start-server-core, @tanstack/start-plugin-core (all declare "seroval": "^1.5.0") |

Because every consumer declares a caret range on 1.5.x, the vulnerable version could
not be removed by upgrading a single direct dependency.

## 2. Mitigation applied

Pinned the transitive package (and its plugin sibling) to a patched release using a
package-manager override in \`package.json\`:

\`\`\`json
"overrides": {
  "seroval": "^1.6.2",
  "seroval-plugins": "^1.6.2"
}
\`\`\`

Then regenerated the lockfile with \`bun install\`.

## 3. Updated lockfile details

\`bun.lock\` now resolves a single, patched copy of each package:

\`\`\`
"seroval": ["seroval@1.6.2", ..., "sha512-mPT+SD2TrlB6wvte1KkYOYUkubaTbd6pZ/6Kk3C9nxzrHmCZyhxOO7XGAeL7f+yLKZglzGtM9odUVvg/EhO+vQ=="]
"seroval-plugins": ["seroval-plugins@1.6.2", ..., "sha512-TfxuUjlbBESzUOWdTkTKqvSmav0ABym+itetDXLK6mDz8SmrpdI30aF8RTXE8Bvq+tH/1yIDkvy3W0lfQb1ipQ=="]
\`\`\`

No \`seroval@1.5.x\` entry remains in the lockfile, so the vulnerable code is no longer
installed or bundled.

## 4. Verification

- Dependency re-install with the regenerated lockfile: success.
- TypeScript typecheck: no errors.
- Production build: success.
- Runtime smoke test (landing page, dashboard, Nova AI chat streaming): success, no console errors.
- The finding was marked as fixed in the automated security scanner, which re-verifies the
  current lockfile before accepting the fix.

## 5. Continuous protection

\`.github/workflows/security.yml\` runs on every push, every pull request, and weekly:

1. Installs with \`bun install --frozen-lockfile\`.
2. Runs \`bun audit --audit-level=high\` — a high or critical advisory fails the build.
3. Uploads the audit log as a build artifact.
4. Opens a labelled \`security\` issue with the audit output so you are notified.
`;

export const Route = createFileRoute("/api/security-report")({
  server: {
    handlers: {
      GET: async () =>
        new Response(REPORT, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="vision-mentor-x-security-report.md"',
          },
        }),
    },
  },
});
