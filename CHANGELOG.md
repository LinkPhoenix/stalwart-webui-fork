# Change Log

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org/).

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

