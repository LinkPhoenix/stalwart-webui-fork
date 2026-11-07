<p align="center">
    <a href="https://stalw.art">
    <img src="./img/logo-red.svg" height="150">
    </a>
</p>

<h3 align="center">
  Web-based User Interface for Stalwart 🛡️
</h3>

<p align="center">
  Community fork of <a href="https://github.com/stalwartlabs/webui">stalwartlabs/webui</a>: the official 2.x admin panel, plus extra tools for day-to-day administration.
</p>

<br>

<p align="center">
  <a href="https://github.com/LinkPhoenix/stalwart-webui-fork/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/LinkPhoenix/stalwart-webui-fork/ci.yml?style=flat-square&label=CI" alt="continuous integration"></a>
  &nbsp;
  <a href="https://github.com/LinkPhoenix/stalwart-webui-fork/releases/latest"><img src="https://img.shields.io/github/v/release/LinkPhoenix/stalwart-webui-fork?style=flat-square&label=release" alt="Latest release"></a>
  &nbsp;
  <img src="https://img.shields.io/badge/Stalwart-1.0%2B-red?style=flat-square" alt="Works with Stalwart 1.0 and later">
  &nbsp;
  <a href="https://www.gnu.org/licenses/agpl-3.0"><img src="https://img.shields.io/badge/License-AGPL_v3-blue.svg?label=license&style=flat-square" alt="License: AGPL v3"></a>
  &nbsp;
  <a href="https://stalw.art/docs/get-started/"><img src="https://img.shields.io/badge/read_the-docs-red?style=flat-square" alt="Documentation"></a>
</p>
<p align="center">
  <a href="https://mastodon.social/@stalwartlabs"><img src="https://img.shields.io/mastodon/follow/109929667531941122?style=flat-square&logo=mastodon&color=%236364ff&label=Follow%20on%20Mastodon" alt="Mastodon"></a>
  &nbsp;
  <a href="https://twitter.com/stalwartlabs"><img src="https://img.shields.io/twitter/follow/stalwartlabs?style=flat-square&logo=x&label=Follow%20on%20Twitter" alt="Twitter"></a>
</p>
<p align="center">
  <a href="https://discord.gg/jtgtCNj66U"><img src="https://img.shields.io/discord/923615863037390889?label=Join%20Discord&logo=discord&style=flat-square" alt="Discord"></a>
  &nbsp;
  <a href="https://matrix.to/#/#stalwart:matrix.org"><img src="https://img.shields.io/matrix/stalwartmail%3Amatrix.org?label=Join%20Matrix&logo=matrix&style=flat-square" alt="Matrix"></a>
</p>

## About this fork

This is a community fork of [stalwartlabs/webui](https://github.com/stalwartlabs/webui) maintained by [LinkPhoenix](https://github.com/LinkPhoenix). It tracks the official WebUI release by release and adds tools for administrators: an overview of the whole server, a first-run checklist, richer lists (quotas, aliases, report summaries, CSV export, bulk actions), a Sieve code editor, color themes and a few quality-of-life refinements. Several of these started here and were later contributed back to the official WebUI.

**Stalwart WebUI** is a schema-driven single-page application for administering [Stalwart](https://stalw.art). After authentication the panel fetches a JSON schema from the server and dynamically generates all forms, lists, navigation, and layouts from that schema — the schema is the single source of truth, not the UI code.

This fork keeps to that philosophy: any AI agent or contributor working on it follows the rules in [AGENTS.md](AGENTS.md), and the small number of deliberate exceptions where the UI does something the official schema doesn't (yet) support are tracked, with the ideal server-side fix for each, in [SCHEMA_DEVIATIONS.md](SCHEMA_DEVIATIONS.md).

### Versions and compatibility

The fork uses **the same version number as the official WebUI it is based on**: release 2.0.5 of this fork is the official 2.0.5 plus the fork's additions. Releases before 2.0.5 (1.x) followed the official 1.0.x WebUI.

| This fork | Official WebUI | Stalwart server |
|-----------|----------------|-----------------|
| 2.0.5 | 2.0.5 | **1.0.0 or later** (tested with 1.0.3) |

The minimum server version is declared as `stalwart.minServerVersion` in [package.json](package.json) and published in the app manifest (`stalwart-app.json`) that Stalwart reads when it installs a WebUI build. See [CHANGELOG.md](CHANGELOG.md) for the full list of changes.

Official Stalwart repositories:

- [stalwartlabs/stalwart](https://github.com/stalwartlabs/stalwart) — the mail server itself.
- [stalwartlabs/webui](https://github.com/stalwartlabs/webui) — the official admin WebUI this project forks.
- [stalwartlabs/cli](https://github.com/stalwartlabs/cli) — `stalwart-cli`, used below to point a server at a WebUI build.

## Features

### From the official WebUI 2.x (included)

- **Schema-driven UI**: All forms, lists, and navigation are generated from a JSON schema fetched from `/api/schema` after login. No object types, field names, or layouts are hardcoded.
- **Three sections**: **Management** (directory, domains, emails, reports, observability, tasks, cluster, actions), **Settings** (network, storage, authentication, TLS, MTA, spam filter, email, calendar and contacts, files and sharing, Sieve, security, encryption, lookups, search, telemetry, task manager, web applications) and **Account**, the self-service area for the signed-in user.
- **Account self-service**: credentials (API keys, app passwords, public keys, OAuth grants), mailboxes, calendars, address books, Sieve scripts, vacation response and spam samples, with passkey registration.
- **JMAP protocol**: All data operations (queries, creates, updates, deletes, blob uploads) use JMAP (RFC 8620) with method chaining and result references, on a TanStack Query data layer.
- **Permission-aware**: Every button, link, field, and section respects the user's permissions. Elements the user cannot access are hidden.
- **Modern sign-in**: OAuth 2.0 with client ID metadata documents (CIMD) and RFC 8707 resource indicators, and locale-aware dates and numbers.
- **Schema-defined dashboards** with live metrics and Live Tracing (Stalwart Enterprise).

### Additions in this fork

- **Community Overview**: inventory cards (directory, mail readiness, access & apps, reports) with attention badges for queue backlog, certificate expiry, and report problems — separate from the Enterprise live-metrics Dashboard.
- **Getting Started checklist**: first-run checklist (domain, DKIM, TLS cert, admin account; optional DMARC) with deep links and docs — shown in the sidebar only while required steps remain.
- **Appearance**: light and dark mode (dark by default), eight color themes (Default, Stalwart, Ocean, Forest, Violet, Rose, Amber, Teal), rounded or square corners and **list density** (comfortable or compact).
- **`Ctrl+K` / `Cmd+K` command palette** to search pages, form sections, and fields — including Overview and Appearance keywords (`queue`, `theme`, …).
- **In-app Changelog** in the header menu (published versions only; never `[Unreleased]`).
- **Usable on mobile**: lists, forms, and the navigation work on narrow viewports instead of assuming a desktop.
- **User menu**: signed-in name and email, an account switcher, Appearance and Changelog.
- **Accounts list**: Role and Usage/Quota columns with coloured progress bars, plus an explanation for stale negative disk-usage values.
- **CSV export** on the admin lists, and **bulk Change quota…** on Accounts and Groups.
- **Column and page-size preferences**: choose the visible columns and 25, 50 or 100 rows per page; both are remembered.
- **Aliases counts**: Accounts, Groups, Domains, and Mailing Lists lists all show an Aliases column.
- **Sortable columns**: the most relevant columns (Accounts, Groups, Domains, Mailing Lists, Roles) can be sorted in the browser, even when the server cannot sort on them.
- **Roles list**: Enabled/Disabled Permissions count columns, so you can see a role's scope without opening it.
- **Mailboxes list**: shown as an indented hierarchy instead of a flat list.
- **Filters that say what they do**: text filters are marked "Exact match only", and an empty result explains why and offers a reset.
- **Queued messages**: backlog and empty-queue guidance with links to Delivery Trace and Log Entries; **Size** in human units (B / KB / MB / GB / TB).
- **Sieve**: Active column on System and User script lists, and a syntax-highlighted, foldable script editor.
- **Backend icons**: brand logos for known stores (S3, PostgreSQL, Redis, RocksDB, SQLite, FoundationDB, MySQL, Cloudflare, …) in type pickers, with Lucide stand-ins for the rest. Paths respect Stalwart's `/admin` (or `/account`) mount, so icons work in production, not only in local Vite.
- **Active WebUI card**: the Web Applications list shows which WebUI build is being served, its version and where it came from.
- **Log Entries**: client-side Level and Event filters, named presets, optional auto-refresh and a rate-limited Refresh button.
- **Report lists**: Pass/Quarantine/Reject (DMARC), Successful/Failed Sessions (TLS), Incidents and Feedback Type (ARF); coloured badges when non-zero; **Problems only** toggle.
- **Open in new tab**: sidebar entries and list rows are real links, so middle-click and the browser context menu work.

### Community vs Enterprise (this fork)

| Capability | Community / OSS | Enterprise |
|------------|-----------------|------------|
| Overview inventory + attention badges | Yes | Yes |
| Getting Started checklist | Yes | Yes |
| Directory / reports / queue / logs (schema + JMAP) | Yes (per permissions) | Yes |
| Live-metrics Dashboard, Live Tracing | Locked / hidden | Yes (with permissions) |
| Appearance, Changelog, command palette | Yes | Yes |

Deliberate client workarounds where the official schema cannot express a feature yet are listed in [SCHEMA_DEVIATIONS.md](SCHEMA_DEVIATIONS.md). Merging upstream WebUI: [docs/UPSTREAM_SYNC.md](docs/UPSTREAM_SYNC.md).

Repository and reverse-proxy security settings: [docs/SECURITY_OPERATIONS.md](docs/SECURITY_OPERATIONS.md).

## Screenshots

<img src="./img/demo.gif">

Captured against a local Stalwart 1.0.3 dev server seeded with sample data (see [DEVELOPMENT.md](DEVELOPMENT.md)) — all addresses below are examples (`@example.org`), not real accounts.

| | |
|---|---|
| Overview — inventory + attention badges | Getting Started checklist |
| ![Overview](./docs/screenshots/overview.png) | ![Getting Started](./docs/screenshots/getting-started.png) |
| Accounts — Role, Usage/Quota and Aliases columns, Export CSV | Accounts — filters marked "Exact match only" |
| ![Accounts list](./docs/screenshots/accounts-list.png) | ![Accounts filters](./docs/screenshots/list-filters.png) |
| Groups — Usage/Quota + Aliases columns | Domains — Aliases column |
| ![Groups list](./docs/screenshots/groups-list.png) | ![Domains list](./docs/screenshots/domains-list.png) |
| Roles — permission counts | Mailing Lists — Aliases column |
| ![Roles list](./docs/screenshots/roles-list.png) | ![Mailing lists](./docs/screenshots/mailing-lists.png) |
| Bulk Change quota… | List empty — no filter matches |
| ![Bulk quota](./docs/screenshots/bulk-quota.png) | ![Filter empty](./docs/screenshots/list-empty-filter.png) |
| DMARC inbox — summary columns | TLS inbox — Problems only + failed sessions |
| ![DMARC reports](./docs/screenshots/dmarc-reports.png) | ![TLS problems only](./docs/screenshots/tls-problems-only.png) |
| ARF inbox — Incidents + Feedback Type | Queued messages — empty queue + ops links |
| ![ARF reports](./docs/screenshots/arf-reports.png) | ![Queued messages](./docs/screenshots/queue-messages.png) |
| System Sieve scripts — Active column | Sieve script editor (syntax highlight, folding) |
| ![Sieve list](./docs/screenshots/sieve-scripts-list.png) | ![Sieve editor](./docs/screenshots/sieve-script-editor.png) |
| Data Store — backend icons in the type picker | Web Applications — Active WebUI card |
| ![Data Store types](./docs/screenshots/data-store-types.png) | ![Web Applications](./docs/screenshots/applications.png) |
| Account — self-service section | User menu (header) |
| ![Account settings](./docs/screenshots/account-settings.png) | ![User menu](./docs/screenshots/user-menu.png) |
| Command palette (`theme` → Appearance) | Changelog (in-app) |
| ![Command palette](./docs/screenshots/command-palette.png) | ![Changelog](./docs/screenshots/changelog.png) |
| Appearance — dark mode (default) | Appearance — light mode |
| ![Appearance dark](./docs/screenshots/appearance-dark.png) | ![Appearance light](./docs/screenshots/appearance-light.png) |
| Mobile layout | |
| <img src="./docs/screenshots/mobile-accounts.png" width="260" alt="Accounts on a phone"> | |

## Get Started

Stalwart WebUI ships as part of Stalwart Mail Server. To install Stalwart Mail Server on your server, follow the instructions for your platform:

- [Linux / MacOS](https://stalw.art/docs/install/linux)
- [Windows](https://stalw.art/docs/install/windows)
- [Docker](https://stalw.art/docs/install/docker)

All documentation is available at [stalw.art/docs/get-started](https://stalw.art/docs/get-started). Note that a standard Stalwart install ships the **official** WebUI; see [Switching your server to this fork's UI](#switching-your-server-to-this-forks-ui) below to point your server at this fork instead. This fork needs Stalwart **1.0.0 or later**.

## Switching your server to this fork's UI

Stalwart serves its admin UI as a managed `WEBAPP` application, downloaded from a URL you control — switching to this fork (or back to upstream) is a server-side config change, no rebuild or redeploy of Stalwart itself required. This is done with [`stalwart-cli`](https://github.com/stalwartlabs/cli).

On your server:

```
export STALWART_URL=https://subdomain.domain.com
export STALWART_USER='user@domain.com'
export STALWART_PASSWORD='Password'
```

Find the Id of your `WEBAPP` application:

```
stalwart-cli query Application
```

In the _output_ is **Id**. Lets say its value is `somehash`.

Zooming in on _application somehash_.

```
stalwart-cli get Application somehash
```

Note the URL for switching back.

Point it at this fork's latest release instead of upstream's:

```
stalwart-cli update Application somehash \
  --field ResourceUrl=https://github.com/LinkPhoenix/stalwart-webui-fork/releases/latest/download/webui.zip
```

Then trigger the update:

```
stalwart-cli create Action/UpdateApps
```

Every tagged release of this fork publishes a `webui.zip` build via CI (see [`.github/workflows/build.yml`](.github/workflows/build.yml)), so pointing at `releases/latest/download/webui.zip` always fetches the newest tested build. To stay on a specific version, use `https://github.com/LinkPhoenix/stalwart-webui-fork/releases/download/v2.0.5/webui.zip` instead. To go back to the official UI, repeat the `update` step with `https://github.com/stalwartlabs/webui/releases/latest/download/webui.zip`.

After the update, **Settings → Web Applications** shows the version that is being served.

## Getting started

Prerequisites:

- Node.js 22.12 or later (CI runs on Node 24, the current LTS)
- A running Stalwart 1.0 or later instance (for JMAP API calls) — see [DEVELOPMENT.md](DEVELOPMENT.md) for how to spin up a disposable local test server with Docker, no manual Stalwart setup required.

Install dependencies (the repository keeps both `package-lock.json` and `bun.lock` current, so `bun install` works too):

```
npm install
```

### Environment variables

Configuration is done through Vite environment variables. Copy or edit `.env.development` in the project root:

```
VITE_API_BASE_URL=http://localhost:443
VITE_ACCESS_TOKEN=
VITE_OAUTH_SCOPES=
```

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | URL of the Stalwart server. Used for all API requests during development. In production builds (when empty or unset) requests are relative to the current origin. |
| `VITE_ACCESS_TOKEN` | Development-server-only OAuth bypass for local testing. Production builds reject a non-empty value because `VITE_` values are embedded in browser assets. |
| `VITE_OAUTH_SCOPES` | Optional OAuth scopes. Omitted from the authorization request when empty. |
| `VITE_OAUTH_CLIENT_ID` | Optional OAuth client ID that overrides everything below. |

### OAuth client ID

The OAuth 2.0 client ID is not a build-time setting. It is chosen at runtime, in this order:

1. `VITE_OAUTH_CLIENT_ID`, when set (development).
2. The `oauth-client-id` meta tag of `index.html`:

   ```html
   <meta name="oauth-client-id" content="" />
   ```

   The server rewrites the `content` attribute when it serves the page, so a single build works for any deployment.
3. A client ID metadata document (CIMD): when the server advertises support, the panel uses `<origin>/<mount path>/oauth-client.json` as its client ID, so a stock Stalwart needs no client registration.

The server can also set the requested scopes through the `oauth-scopes` meta tag.

### Bypassing OAuth for development

Set `VITE_ACCESS_TOKEN` to a valid bearer token while running `npm run dev` to skip the login page and go straight to the admin panel.
Never use this variable to provide production credentials; `npm run build` fails if it is non-empty:

```
VITE_ACCESS_TOKEN=your-bearer-token-here
```

Against the local test server from [DEVELOPMENT.md](DEVELOPMENT.md), `scripts/dev-token.ps1` / `scripts/dev-token.sh` fetch one for you automatically.

### Running the dev server

```
npm run dev
```

This starts Vite's development server with hot module replacement, typically at `http://localhost:5173`.

## Testing

Everything runs from the repository:

```
npm run typecheck   # TypeScript 7 (native compiler)
npm run lint        # Oxlint
npm test            # Vitest unit tests
npm run test:e2e    # Playwright browser tests
```

Install Chromium once with `npx playwright install chromium` before running the browser tests. Locally they use two workers; CI uses one.

## Building for production

```
npm run build
```

This runs the TypeScript compiler followed by Vite's production build. Output
goes to the `dist/` directory.

To preview the production build locally:

```
npm run preview
```

## Support

For bugs or questions about **this fork's UI changes**, please open an issue on [this repository](https://github.com/LinkPhoenix/stalwart-webui-fork).

For anything related to Stalwart Mail Server itself, do not hesitate to reach the upstream team on [Github Discussions](https://github.com/stalwartlabs/mail-server/discussions),
[Reddit](https://www.reddit.com/r/stalwartlabs), [Discord](https://discord.gg/aVQr3jF8jd) or [Matrix](https://matrix.to/#/#stalwart:matrix.org).
Additionally you may purchase a subscription to obtain priority support from Stalwart Labs LLC.

## License

This project is dual-licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0; as published by the Free Software Foundation) and the **Stalwart Enterprise License v1 (SELv1)**:

- The [GNU Affero General Public License v3.0](./LICENSES/AGPL-3.0-only.txt) is a free software license that ensures your freedom to use, modify, and distribute the software, with the condition that any modified versions of the software must also be distributed under the same license. 
- The [Stalwart Enterprise License v1 (SELv1)](./LICENSES/LicenseRef-SEL.txt) is a proprietary license designed for commercial use. It offers additional features and greater flexibility for businesses that do not wish to comply with the AGPL-3.0 license requirements. 

Each file in this project contains a license notice at the top, indicating the applicable license(s). The license notice follows the [REUSE guidelines](https://reuse.software/) to ensure clarity and consistency. The full text of each license is available in the [LICENSES](./LICENSES/) directory.

As a fork, all changes made here — including new files added by this fork — remain under the same dual license as the upstream project; this is reflected in the SPDX license notice at the top of every source file.

## Copyright

Copyright (C) 2024, Stalwart Labs LLC
