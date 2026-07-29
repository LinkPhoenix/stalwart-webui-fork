/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy } from 'react';

// The admin panel (and everything reachable from it) is split out of the
// entry chunk so anonymous visitors only download the login page.
// Kept in a dedicated file so main.tsx stays component-free for fast refresh.
export const AdminPanel = lazy(() => import('./AdminPanel'));
