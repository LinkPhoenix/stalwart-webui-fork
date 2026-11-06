/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import type { Blocker } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title={t('form.unsavedChangesTitle', 'Unsaved changes')}
      description={t('form.unsavedChanges', 'You have unsaved changes. Are you sure you want to leave?')}
      cancelLabel={t('form.stay', 'Stay')}
      confirmLabel={t('form.leave', 'Leave')}
      onCancel={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
