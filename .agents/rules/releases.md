# Releases

How to cut a version so GitHub Release notes match `CHANGELOG.md`. Applies to every AI agent (Cursor, Claude Code, Codex, ChatGPT, cloud agents, etc.).

## Why this exists

The release workflow builds the GitHub release body from `CHANGELOG.md`. It must use the section for **the tagged version** (e.g. `## [1.1.4] - …`), **never** `## [Unreleased]`.

v1.1.4 shipped with only `## [Unreleased]` in the GitHub release because CI used `awk '/^## \[/{c++} c==1'`, which always takes the **first** `## [` heading — and that heading is always `[Unreleased]` (often empty after a cut). That was a CI bug; agents must still verify the published notes.

## Cutting a release (checklist)

1. Move every bullet under `## [Unreleased]` into a new `## [X.Y.Z] - YYYY-MM-DD` section. Leave `## [Unreleased]` empty (heading only).
2. Bump `version` in `package.json` **and** the matching fields in `package-lock.json`.
3. Commit (e.g. `chore: release vX.Y.Z`), push `main`, then create and push annotated tag `vX.Y.Z`.
4. Wait for the **Build and Release** workflow on that tag to finish successfully.
5. **Verify** the GitHub release body at `https://github.com/<owner>/<repo>/releases/tag/vX.Y.Z`:
   - It must contain the `## [X.Y.Z]` notes (Added/Changed/Fixed, etc.).
   - It must **not** be only `## [Unreleased]` or empty.
6. If the body is wrong, fix it immediately with `gh release edit vX.Y.Z --notes-file …` (or paste the correct section), and fix CI/rules if the extractor is still wrong — do not leave a bad release.

## CI contract

- Workflow: `.github/workflows/build.yml`
- Body extraction must match `GITHUB_REF_NAME` with the `v` prefix stripped to a `## [X.Y.Z]` section.
- The step must **fail** if that section is missing or if the body is `[Unreleased]`.

## Do not

- Tag/push a release while the new version’s notes still sit only under `## [Unreleased]`.
- Assume “CHANGELOG updated in the repo” means the GitHub Release page is correct — always open/check the published release.
- “Fix” release notes by inventing text that is not in `CHANGELOG.md`; copy the version section.

## In-app Changelog page

- The WebUI Changelog page (`src/features/changelog/`) imports `CHANGELOG.md` but **must never show** the `## [Unreleased]` section (heading or bullets). End users only see published `## [X.Y.Z]` versions.
- Filtering is done by `stripUnreleasedChangelog` before render. Keep that behavior; do not render the raw file as-is.
- `## [Unreleased]` remains valid in the repo file for developers working on the next cut.
