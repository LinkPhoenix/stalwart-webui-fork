/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { isValidTarget } from '../stages';

interface DeliveryTraceFormProps {
  target: string;
  onTargetChange: (target: string) => void;
  starting: boolean;
  onStart: (target: string) => void;
}

export function DeliveryTraceForm({ target, onTargetChange, starting, onStart }: DeliveryTraceFormProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    if (starting) return;
    if (!isValidTarget(target)) {
      setInvalid(true);
      return;
    }
    onStart(target.trim());
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3.5 pt-6">
      <div className="space-y-1 px-1 pb-1 pt-3">
        <h1 className="page-title">{t('deliveryTrace.title', 'Delivery Trace')}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            'deliveryTrace.subtitle',
            'Run a real outbound SMTP delivery attempt and watch every DNS lookup, TLS handshake, and SMTP command as it happens.',
          )}
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-5">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Label htmlFor={inputId}>{t('deliveryTrace.targetLabel', 'Target address or domain')}</Label>
            <div className="flex gap-2">
              <Input
                id={inputId}
                placeholder={t('deliveryTrace.targetPlaceholder', 'john@example.org or example.org')}
                value={target}
                onChange={(e) => {
                  onTargetChange(e.target.value);
                  setInvalid(false);
                }}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? errorId : undefined}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={starting}>
                {starting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
                <span>{t('deliveryTrace.startTrace', 'Start trace')}</span>
              </Button>
            </div>
            {invalid && (
              <p id={errorId} className="text-xs text-destructive">
                {t('deliveryTrace.invalidTarget', 'Enter a valid email address or domain.')}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
