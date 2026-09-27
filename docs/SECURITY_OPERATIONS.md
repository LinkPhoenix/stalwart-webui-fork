# Repository and deployment security controls

The repository workflows protect the build and release process, but two important controls live outside this checkout and must be enabled in GitHub and the Stalwart deployment.

## GitHub repository settings

- Protect `main` with a ruleset that requires the `CI / Verify application` job before merge. Restrict bypasses to repository administrators and block force pushes and branch deletion.
- Protect release tags matching `v*`: restrict tag creation and updates to release maintainers, and disallow moving or deleting published version tags. The release workflow validates tag syntax and refuses to replace an existing release, but GitHub rulesets enforce who may create tags.
- Keep the repository's default `GITHUB_TOKEN` permissions read-only. The release workflow grants write access only to the job that creates a GitHub Release.

## Stalwart and reverse-proxy logging

The UI uses Stalwart's short-lived token query parameter for live Server-Sent Events because browsers cannot set an `Authorization` header on `EventSource`. The token expires after 60 seconds and is bound to its matching live endpoint, as described in the [official Stalwart API documentation](https://stalw.art/docs/development/api/).

Configure Stalwart, reverse-proxy, CDN, and observability access logs to redact the `token` query parameter on live-event requests. Keep the live stream authentication enabled; do not remove the query token to avoid logging it. Never record complete query strings for these requests in exported diagnostics or support bundles.

## Authorization boundary

The WebUI hides controls based on the permissions returned by Stalwart to make the interface easier to use. The server remains the authorization boundary: keep permissions least-privileged and verify that the Stalwart API rejects unauthorized operations independently of the UI.
