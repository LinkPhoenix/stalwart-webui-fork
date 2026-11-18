/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense } from 'react';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { ValueProps } from '@/extensions/types';
import type { FieldTypeObject } from '@/types/schema';

const BodyEditor = lazy(() =>
  import('@/features/mailRules/components/MailRuleBodyWidget').then((m) => ({ default: m.MailRuleBodyEditor })),
);

const BodyView = lazy(() =>
  import('@/features/mailRules/components/MailRuleBodyWidget').then((m) => ({ default: m.MailRuleBodyView })),
);

export function MailRuleBodyWidget(props: WidgetProps<FieldTypeObject>) {
  return (
    <Suspense fallback={null}>
      <BodyEditor {...props} />
    </Suspense>
  );
}

export function MailRuleBodyValue(props: ValueProps) {
  return (
    <Suspense fallback={null}>
      <BodyView {...props} />
    </Suspense>
  );
}
