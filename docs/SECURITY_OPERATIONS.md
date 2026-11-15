# Repository and deployment security controls

The repository workflows protect the build and release process, but two important controls live outside this checkout and must be enabled in GitHub and the Stalwart deployment.

## GitHub repository settings

- Protect `main` with a ruleset that requires the `CI / Verify application` job before merge. Restrict bypasses to repository administrators and block force pushes and branch deletion.
- Protect release tags matching `v*`: restrict tag creation and updates to release maintainers, and disallow moving or deleting published version tags. The release workflow validates tag syntax and refuses to replace an existing release, but GitHub rulesets enforce who may create tags.
- Keep the repository's default `GITHUB_TOKEN` permissions read-only. The release workflow grants write access only to the job that creates a GitHub Release.

## Stalwart and reverse-proxy logging

The UI uses Stalwart's short-lived token query parameter for live Server-Sent Events because browsers cannot set an `Authorization` header on `EventSource`. The token expires after 60 seconds and is bound to its matching live endpoint, as described in the [official Stalwart API documentation](https://stalw.art/docs/development/api/).

Configure Stalwart, reverse-proxy, CDN, and observability access logs to redact the `token` query parameter on live-event requests. Keep the live stream authentication enabled; do not remove the query token to avoid logging it. Never record complete query strings for these requests in exported diagnostics or support bundles.

## Content Security Policy

The OAuth access and refresh tokens are kept in `sessionStorage`, so any script that manages to run inside the page could read them. Production builds therefore embed a Content-Security-Policy as a `<meta>` tag at the top of `index.html` (`src/lib/contentSecurityPolicy.ts`). Its main effect is `script-src 'self'`: only the bundled chunks run, and injected inline scripts, `eval` and scripts loaded from other sites are refused by the browser.

Two limits to be aware of:

- `connect-src` allows `https:` in addition to the app's own origin. The identity provider's token endpoint is discovered at runtime and can be on any HTTPS origin, so it cannot be listed at build time. If your identity provider runs on a **plain-HTTP** origin different from the one serving the WebUI, sign-in will be blocked: serve it over HTTPS or send a custom policy header that lists it.
- `frame-ancestors` is ignored when a policy comes from a `<meta>` tag. Add it as an HTTP response header on the WebUI in Stalwart or your reverse proxy to stop other sites from framing the admin panel, for example `Content-Security-Policy: frame-ancestors 'none'`. A header and the embedded tag are combined: the browser applies both.

`E2E_TARGET=build npm run test:e2e` (run by CI after the build) loads the built pages, fails on any policy violation and checks that an injected inline script does not run.

## Authorization boundary

The WebUI hides controls based on the permissions returned by Stalwart to make the interface easier to use. The server remains the authorization boundary: keep permissions least-privileged and verify that the Stalwart API rejects unauthorized operations independently of the UI.

## CSV exports

CSV cells that begin with spreadsheet formula characters are prefixed with an apostrophe and quoted. This reduces formula-injection risk for common spreadsheet workflows, but it is not universal protection: spreadsheet applications can handle escaped values differently, and Excel may remove escapes after a save-and-reopen cycle. See the [OWASP CSV Injection guidance](https://community.owasp.org/attacks/CSV_Injection) before changing this policy or using exported files in automated imports.
