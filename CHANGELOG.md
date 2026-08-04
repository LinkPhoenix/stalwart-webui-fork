# Change Log

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

### Added
- Middle-click / “Open in new tab” on admin navigation: sidebar links, section switcher, TopBar sections/Appearance/Changelog, list Create and row primary cells (plus Ctrl/Cmd-click and middle-click on the whole row), view/query row actions, command palette results, form Back/Cancel, read-only view and trace Back buttons, and dashboard tabs ([webui#7](https://github.com/stalwartlabs/webui/issues/7)).
- Summary columns on inbound/outbound DMARC and TLS report lists, and on ARF reports: Pass/Quarantine/Reject (DMARC), Successful/Failed Sessions (TLS), Incidents + Feedback Type (ARF), derived from the nested `report` property ([webui#13](https://github.com/stalwartlabs/webui/issues/13); tracked as `report-summary-columns` in SCHEMA_DEVIATIONS.md).
- Coloured badges on report summary cells when Quarantine, Reject, or Failed Sessions are greater than zero (amber / red) so problems stand out without opening each row.
- Report list Subject column truncates at a max width (full text on hover) so long subjects no longer force horizontal scrolling.
- `scripts/dev-seed-reports.ps1` to SMTP-inject Stalwart test-suite sample DMARC/TLS/ARF reports into the local disposable server (JMAP create is forbidden for external reports).

## [1.1.3] - 2026-08-01

### Fixed
- Column sort headers now cycle unsorted → ascending → descending → unsorted, so a third click clears the sort and restores the list's default order (previously stuck alternating between ascending and descending).

## [1.1.2] - 2026-08-01

### Added
- Brand-accurate "Stalwart" color theme (red/pink accent from the official site tokens). The previous theme named "Stalwart" was only the neutral black/white look and is now labeled "Default".
- Changelog page in the header user dropdown, rendering this repository's `CHANGELOG.md` so release notes stay in sync with every release.
- Usage/Quota column on the Groups list (same synthetic column as Accounts); unlimited quota renders as ∞ instead of the word "Unlimited".
- Aliases count column on Accounts, Groups, Mailing Lists, and Domains (resolved from each object's real `aliases` property).
- Enabled Permissions and Disabled Permissions count columns on the Roles list.
- Client-side column sorting on Accounts, Groups, Mailing Lists, Roles, and Domains for the most useful columns (Email/Name/Description, Usage/Quota, Aliases, permission counts, Domain Name, Enabled). The backend rejects sort on these properties (`unsupportedSort`), so lists fetch then sort/paginate locally when a sortable header is clicked — same approach as mailbox hierarchy sort.
- `scripts/dev-seed` (`.sh` / `.ps1`) to populate the local test server with sample Users, Groups, Mailing Lists, and Roles after `dev-server-init` (idempotent; documented in DEVELOPMENT.md).

### Changed
- Default color theme is now the new Stalwart theme (previously Ocean since 1.0.9); existing saved preferences are unaffected.
- Client-side sort is driven by a shared `clientSortable` column flag instead of hardcoded view/column maps, so any list can opt in without touching `DynamicList` branching.

### Fixed
- Sidebar: expanding a collapsible group (e.g. Directory) and then navigating to an unrelated top-level link (e.g. Cluster) now collapses that group instead of leaving it open.
- Vite respects the `$PORT` environment variable so preview/dev tooling that assigns a free port can bind the same port Vite actually listens on.

## [1.1.1] - 2026-08-01

### Fixed
- Mobile sidebar no longer snaps shut when switching between Management/Settings/Account — it now stays open so you can pick a page in the new section, and only closes once you actually navigate to one.
- Favicon replaced with upstream's original: this fork's had drifted to a mis-cropped export (visible padding around the logo, lower color depth) despite showing the same logo and color.

### Changed
- The "Active WebUI" card (Settings > Web Applications) now also shows the resource URL the active WebUI was installed from, alongside its description and version.

## [1.1.0] - 2026-07-30

### Fixed
- Mobile admin shell and lists: wide tables no longer expand/clip the page. The shared ScrollArea constrains content width, tables scroll horizontally inside their card, and list Create / pagination actions stay visible in the mobile viewport.
- Form and detail layouts wrap more cleanly on narrow screens (action bars, label/value rows).
- Date/time picker in dark mode: replaced the native time input (invisible clock icon + always-light popup) with themed hour/minute selects and a visible Clock icon; set `color-scheme` on light/dark themes so remaining native date controls follow the UI.
- Empty date/time fields open prefilled with the current date and time so the calendar and hour/minute selects start on a useful default.

### Changed
- Negative account disk-usage values (stale Stalwart quota counters) are shown in red with an info tooltip that explains how to recalculate usage via Tasks (Perform account maintenance operations → Recalculate storage quota usage, or store-wide Reset all user quotas).

## [1.0.9] - 2026-07-30

### Added
- Level and Event filters on the Log Entries list, applied client-side since the backend doesn't support filtering on these properties yet. Event uses a searchable combobox given its ~600 possible values.
- Rate-limited manual Refresh button on the Log Entries list (one click per 5 seconds) ([webui#8](https://github.com/stalwartlabs/webui/issues/8)).
- Role and Usage/Quota columns on the Accounts list, replacing Created At ([webui#12](https://github.com/stalwartlabs/webui/issues/12)).
- Mailbox hierarchy: mailboxes are now indented under their parent instead of shown as a flat list ([webui#16](https://github.com/stalwartlabs/webui/issues/16)).
- Three additional color themes — Rose, Amber, Teal — alongside Stalwart/Ocean/Forest/Violet.
- "Remember last visited page" per section (localStorage), so switching sections returns to where you left off.
- Username and email shown directly in the TopBar user menu trigger.
- "Active WebUI" info card and column in the Web Applications list, showing which web app is currently serving the admin UI.
- Backend/provider icons across the variant selectors (DNS providers, storage/directory backends, Redis/Valkey).

### Changed
- Default color theme is now Ocean with square corners (previously Stalwart with rounded corners); existing saved preferences are unaffected.
- Active account is preserved across page reloads instead of resetting to the primary account, and switching accounts fully remounts the current view (and clears cached display-name/list lookups) so account-scoped data refreshes immediately instead of requiring a tab switch first ([webui#17](https://github.com/stalwartlabs/webui/issues/17); reviewed against upstream's own fix for the same issue in [stalwartlabs/webui@189e270](https://github.com/stalwartlabs/webui/commit/189e270785a6953a99d11c958fd52daa94e1f5c7) and aligned with it).
- WebUI label renamed to "Stalwart WebUI Fork" to distinguish this fork from upstream.
- Appearance settings moved from the sidebar to the header user dropdown.
- Dynamic page titles prefixed with "Stalwart |".
- x:Application list layout aligned with Domains (Description first, Enabled second).
- Updated Vite to 8.2.0, `@vitejs/plugin-react` to 6.0.5, and `lucide-react` to 1.28.0.

### Fixed
- Custom logos no longer flash the default Stalwart logo while loading. Loading is encapsulated in `logoCache` (shared fetch + AbortController + blob URL revoke), keeping `uiStore` free of logo state while still caching across TopBar/Login remounts.
- Icon/label alignment in backend select triggers.
- Web Applications list shows an Enabled column again.
- Appearance Corners preview: only the Rounded choice forces rounded radius on its card and sample; Square stays sharp even when the global theme is square.
- Removed the experimental PWA/service worker: it precached `index.html` with `<base href="/">`, which broke Stalwart's mount-path rewrite (`/admin`, `/account`) and produced a blank UI. Aligns with upstream webui, which does not ship a service worker.
- iOS home-screen Web App support without a service worker: `apple-touch-icon` plus `apple-mobile-web-app-title` set to "Stalwart".

### Known limitations (confirmed backend-side, not fixable from this fork)
- Level/Event filters on Log Entries are client-side only (see Added above) because the backend's JMAP query engine rejects `level`/`event` as filter conditions ([webui#15](https://github.com/stalwartlabs/webui/issues/15)).
- Text filters across the admin API (Spam Rules & Scores, Accounts, Domains, ...) only support exact match, not partial/glob/wildcard search — confirmed systemic across the whole `x:` filter engine, requires a server-side change.

## [1.0.8] - 2026-07-29

### Added
- Appearance settings page (linked at the bottom of the sidebar) with light/dark mode, four selectable color themes (Stalwart, Ocean, Forest, Violet) and a rounded/square corners option that applies globally across all themes.
- Light/dark toggle on the login pages.
- Dynamic document titles per page, mirroring the sidebar navigation labels.
- Square corners toggle for a border-radius-free interface.
- Full-width sidebar hover with a separated footer in square mode.

### Changed
- The light/dark toggle is a single-click button again, in the top bar and on the login pages.
- The logout menu item is marked as destructive.
- Updated react-router-dom to 7.18.2 and migrated the date picker to `@daypicker/react` 10 (the new react-day-picker package name).

### Fixed
- Section URLs without a view (e.g. /admin) redirect to the first accessible page instead of the "Select a view" empty state.

### Removed
- The Web Applications list no longer shows a "Version" column or an "Update" button, because Stalwart does not expose the installed version of each web application and `/latest/` GitHub URLs hide it.

## [1.0.7] - 2026-07-29

### Added
- Ctrl+K / Cmd+K command palette to search pages, form sections and fields across the admin panel, with an ESC hint badge instead of the close cross.
- WebUI version and update action with a confirmation modal in the Web Applications list.
- Calendar date picker with time input replacing native datetime inputs in all schema-driven forms.
- Shared styled ScrollArea used app-wide, including the sidebar and the command palette.
- Development proxy forwarding API and JMAP requests to a local Stalwart server.

### Changed
- Renamed the package to `stalwart-webui-fork` to identify the community fork.
- Sidebar behaves as an animated accordion: expanding a section collapses the others at the same level, with a softer hover.
- Main content is horizontally centered.
- Form fields now use a background color distinct from card surfaces.
- Feature pages and the admin shell are code-split with React.lazy to reduce the initial bundle size.
- Switches show green when enabled and red when disabled.

### Fixed
- Table header background is clipped inside the rounded border, removing the square corner visible behind the radius.
- Sidebar section stays synced with the URL on programmatic navigation and full page loads.

## [1.0.6] - 2026-07-28

### Added
- WebUI version is now displayed when hovering over the logo.

### Changed

### Fixed
- Properly serialize `date` filters when applying them to the list filter.

## [1.0.5] - 2026-06-21

### Added

### Changed

### Fixed
- Redirect to `/login` when there is no refresh token.
- Include required JMAP capabilities in `using`.
- Default scopes omit `offline_access`.

## [1.0.4] - 2026-05-11

### Added

### Changed

### Fixed
- Align `base32` alphabet with the server.

## [1.0.3] - 2026-05-05

### Added

### Changed

### Fixed
- Broken "Delivery History" link on OSS/Community editions.
- Resolve object ids in map keys.

## [1.0.2] - 2026-04-30

### Added
- OIDC:
    - Include `email` and `profile` scopes in OIDC authentication requests.
- TOTP:
    - Add "Copy Secret" button to TOTP setup flow.

### Changed

### Fixed
- Display validation errors returned by the server.

## [1.0.1] - 2026-04-25

### Added
- OIDC:
    - Logout users from IdP when logging out of the app.
    - Include `openid` scope in OIDC authentication requests.

### Changed

### Fixed
- Mobile display issues.
- Editing a secret clears its masked value.
- Array label properties crashes app.

## [1.0.0] - 2026-04-20

### Added
- Initial release.

### Changed

### Fixed

