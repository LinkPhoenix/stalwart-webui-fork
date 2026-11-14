# Releases

How to cut a version so GitHub Release notes match `CHANGELOG.md`. Applies to every AI agent (Cursor, Claude Code, Codex, ChatGPT, cloud agents, etc.).

## Why this exists

The release workflow builds the GitHub release body from `CHANGELOG.md`. It must use the section for **the tagged version** (e.g. `## [1.1.4] - …`), **never** `## [Unreleased]`.

v1.1.4 shipped with only `## [Unreleased]` in the GitHub release because CI used `awk '/^## \[/{c++} c==1'`, which always takes the **first** `## [` heading — and that heading is always `[Unreleased]` (often empty after a cut). That was a CI bug; agents must still verify the published notes.

## Version numbers

- The fork versions as **`X.Y.Z-rN`** (lowercase `r`, like [anonaddy/docker](https://github.com/anonaddy/docker/releases)): the upstream WebUI version `X.Y.Z` it is based on, plus a fork revision counter. The tag is `vX.Y.Z-rN`.
- **`X.Y.Z-r0`** is the first fork release on upstream `X.Y.Z` — the upstream sync plus the fork's standing additions. Each later fork feature release on the same base increments the revision: `X.Y.Z-r1`, `X.Y.Z-r2`, … When upstream publishes a new `X'.Y'.Z'`, start again at `X'.Y'.Z'-r0`.
- Example: `2.0.6-r0` = official WebUI 2.0.6 + the fork's additions; `2.0.6-r1` adds one more fork change on the same base, and so on.
- Because the `-rN` suffix never matches an upstream tag, fork tags `vX.Y.Z-rN` and upstream tags `vX.Y.Z` no longer collide. Still fetch upstream with `git fetch upstream --no-tags` so a stray upstream tag can never shadow a fork tag locally, and never push tags with `--tags`.
- `scripts/validate-release-tag.mjs` (CI gate in `.github/workflows/build.yml`) accepts `vMAJOR.MINOR.PATCH` and `vMAJOR.MINOR.PATCH-rN` only — no uppercase `R`, no `-rc.1`, no leading zeros.
- `stalwart.minServerVersion` in `package.json` is the oldest Stalwart server the build supports. Keep it equal to upstream's.

## Cutting a release (checklist)

1. Move every bullet under `## [Unreleased]` into a new `## [X.Y.Z-rN] - YYYY-MM-DD` section. Leave `## [Unreleased]` empty (heading only).
2. Bump `version` in `package.json` **and** the matching fields in `package-lock.json` to `X.Y.Z-rN`.
3. Commit (e.g. `chore: release vX.Y.Z-rN`), push `main`, then create and push annotated tag `vX.Y.Z-rN`.
4. Wait for the **Build and Release** workflow on that tag to finish successfully.
5. **Verify** the GitHub release body at `https://github.com/<owner>/<repo>/releases/tag/vX.Y.Z-rN`:
   - It must contain the `## [X.Y.Z-rN]` notes (Added/Changed/Fixed, etc.).
   - It must **not** be only `## [Unreleased]` or empty.
6. If the body is wrong, fix it immediately with `gh release edit vX.Y.Z-rN --notes-file …` (or paste the correct section), and fix CI/rules if the extractor is still wrong — do not leave a bad release.

## CI contract

- Workflow: `.github/workflows/build.yml`
- Body extraction must match `GITHUB_REF_NAME` with the `v` prefix stripped to a `## [X.Y.Z-rN]` section.
- The step must **fail** if that section is missing or if the body is `[Unreleased]`.

## Do not

- Tag/push a release while the new version’s notes still sit only under `## [Unreleased]`.
- Assume “CHANGELOG updated in the repo” means the GitHub Release page is correct — always open/check the published release.
- “Fix” release notes by inventing text that is not in `CHANGELOG.md`; copy the version section.

## In-app Changelog page

- The WebUI Changelog page (`src/features/changelog/`) imports `CHANGELOG.md` but **must never show** the `## [Unreleased]` section (heading or bullets). End users only see published `## [X.Y.Z-rN]` versions.
- Filtering is done by `stripUnreleasedChangelog` before render. Keep that behavior; do not render the raw file as-is.
- `## [Unreleased]` remains valid in the repo file for developers working on the next cut.
