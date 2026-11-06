/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DynamicView } from '@/components/views/DynamicView';
import type { ObjectVariant, Schema } from '@/types/schema';

interface ActionResultProps {
  schema: Schema;
  variant: ObjectVariant;
  data: Record<string, unknown>;
  onNewAction: () => void;
}

export function ActionResult({ schema, variant, data, onNewAction }: ActionResultProps) {
  const { t } = useTranslation();
  const hasData = !!variant.schemaName && Object.keys(data).length > 0;

  return (
    <div className="space-y-3.5">
      <div role="status" className="flex items-center gap-3.5 px-1 pb-1 pt-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="page-title break-words">{variant.label}</h1>
          <p className="text-sm text-muted-foreground">
            {t('actions.executedSuccess', 'Action executed successfully.')}
          </p>
        </div>
      </div>

      {hasData && variant.schemaName ? (
        <DynamicView
          schema={schema}
          objectName={variant.schemaName}
          viewName={variant.schemaName}
          data={data}
          visibleFields={new Set(Object.keys(data))}
        />
      ) : (
        <div className="rounded-2xl bg-muted p-10 text-center text-sm text-muted-foreground">
          {t('actions.noAdditionalData', 'No additional data returned.')}
        </div>
      )}

      <Button onClick={onNewAction}>
        <Zap aria-hidden="true" />
        {t('actions.executeAnother', 'Execute another action')}
      </Button>
    </div>
  );
}

export function ActionError({ error, onBack }: { error: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-8">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div role="alert" className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive">
              <CircleAlert aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="section-title text-lg">{t('actions.failedTitle', 'Action failed')}</h1>
              <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onBack}>
            {t('actions.backToActions', 'Back to actions')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
