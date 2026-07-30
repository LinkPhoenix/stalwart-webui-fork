# Change Log

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org/).

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

