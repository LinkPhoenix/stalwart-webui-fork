/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/** SCHEMA-DEVIATION: bulk-quota-change-action (see SCHEMA_DEVIATIONS.md) */

export type PromptPropertyFormat = 'size';

export interface PromptSetPropertyConfig {
  property: string;
  format: PromptPropertyFormat;
  titleKey: [string, string];
  descriptionOneKey: [string, string];
  descriptionOtherKey: [string, string];
}

export const QUOTA_PROMPT_CONFIG: PromptSetPropertyConfig = {
  property: 'quotas/maxDiskQuota',
  format: 'size',
  titleKey: ['list.changeQuotaTitle', 'Change disk quota'],
  descriptionOneKey: ['list.changeQuotaDescription_one', 'Set a new maximum disk quota for {{count}} account.'],
  descriptionOtherKey: ['list.changeQuotaDescription_other', 'Set a new maximum disk quota for {{count}} accounts.'],
};
