/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { FilterEnum } from '@/types/schema';

/**
 * Type augmentations for tracked schema deviations (see SCHEMA_DEVIATIONS.md).
 *
 * `src/types/schema.ts` mirrors the server's schema contract and must stay
 * aligned with the official webui/server types — it is never edited to
 * accommodate a deviation. When a deviation needs to carry extra data on an
 * otherwise-official schema shape, the augmented type lives here instead,
 * as an intersection with the official type, and is imported only by the
 * deviation's own code.
 */

// SCHEMA-DEVIATION: log-client-filters (see SCHEMA_DEVIATIONS.md)
export type ClientOnlyFilterEnum = FilterEnum & { clientOnly?: boolean };

export function isClientOnlyFilterEnum(f: FilterEnum): f is ClientOnlyFilterEnum {
  return (f as ClientOnlyFilterEnum).clientOnly === true;
}
