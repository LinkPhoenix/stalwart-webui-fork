/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SECRET_MASK } from '@/lib/jmapUtils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObject } from '@/types/schema';

interface OtpAuthValue {
  otpUrl?: string | null;
  otpCode?: string | null;
}

const STALWART_IMAGE_URL = 'https://stalw.art/img/favicon-32x32.png';

function buildOtpAuthUrl(totp: OTPAuth.TOTP): string {
  const base = totp.toString();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}image=${encodeURIComponent(STALWART_IMAGE_URL)}`;
}

function generateTotp(): { totp: OTPAuth.TOTP; url: string } {
  const totp = new OTPAuth.TOTP({
    issuer: 'Stalwart',
    label: 'account',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });
  return { totp, url: buildOtpAuthUrl(totp) };
}

export function OtpAuthField({ value, onChange, readOnly }: WidgetProps<FieldTypeObject>) {
  const { t } = useTranslation();
  const codeId = useId();
  const objValue = (value as OtpAuthValue | null | undefined) ?? {};
  const isConfigured = objValue.otpUrl != null && objValue.otpUrl !== '';

  const [setupTotp, setSetupTotp] = useState<OTPAuth.TOTP | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);

  const setupSecret = useMemo(() => {
    if (!setupTotp) return null;
    return setupTotp.secret.base32.replace(/(.{4})/g, '$1 ').trim();
  }, [setupTotp]);

  useEffect(() => {
    if (!setupUrl) return;
    let cancelled = false;
    QRCode.toDataURL(setupUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Failed to render QR code', err);
      });
    return () => {
      cancelled = true;
    };
  }, [setupUrl]);

  const startSetup = () => {
    const { totp, url } = generateTotp();
    setSetupTotp(totp);
    setSetupUrl(url);
    setSetupCode('');
    setSetupError(null);
  };

  const confirmSetup = () => {
    if (!setupTotp || !setupUrl) return;
    if (!setupCode.trim()) {
      setSetupError(t('otp.enterCodePrompt', 'Enter the code shown in your authenticator.'));
      return;
    }
    const delta = setupTotp.validate({ token: setupCode.trim(), window: 1 });
    if (delta === null) {
      setSetupError(t('otp.codeIncorrect', 'That code is incorrect. Make sure your authenticator clock is in sync.'));
      return;
    }
    setSetupError(null);
    onChange({ otpUrl: setupUrl, otpCode: setupCode.trim() });
    setSetupTotp(null);
    setSetupUrl(null);
    setSetupCode('');
  };

  const cancelSetup = () => {
    setSetupTotp(null);
    setSetupUrl(null);
    setSetupCode('');
    setSetupError(null);
  };

  const otpCodeValue = useMemo(
    () => (typeof objValue.otpCode === 'string' && objValue.otpCode !== SECRET_MASK ? objValue.otpCode : ''),
    [objValue.otpCode],
  );

  const handleCodeChange = (code: string) => {
    onChange({ ...objValue, otpCode: code });
  };

  const handleDisable = () => {
    onChange({ ...objValue, otpUrl: null });
  };

  if (readOnly) {
    return (
      <div className="text-sm text-muted-foreground">
        {isConfigured
          ? t('otp.statusEnabled', 'Two-factor authentication is enabled.')
          : t('otp.statusDisabled', 'Two-factor authentication is not enabled.')}
      </div>
    );
  }

  if (!isConfigured && setupUrl) {
    return (
      <div className="space-y-4 rounded-xl bg-muted p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('otp.scanPrompt', 'Scan with your authenticator app')}</p>
          <p className="text-xs text-muted-foreground">
            {t(
              'otp.scanDescription',
              'Scan the QR code below with Google Authenticator, 1Password, Authy, or any other TOTP app, then enter the 6-digit code it shows to confirm setup.',
            )}
          </p>
        </div>
        <div className="flex justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={t('otp.qrCodeAlt', 'TOTP QR code')}
              width={220}
              height={220}
              className="rounded-xl bg-white p-2 shadow-tile"
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-brand-text" aria-hidden="true" />
            </div>
          )}
        </div>
        {setupSecret && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t('otp.manualEntryLabel', 'Or enter this code manually')}</Label>
            <p className="text-xs text-muted-foreground">
              {t(
                'otp.manualEntryDescription',
                'If you cannot scan the QR code, enter this secret into your authenticator app instead.',
              )}
            </p>
            <div className="flex gap-2">
              <code className="flex-1 select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-sm">
                {setupSecret}
              </code>
              {setupTotp && <CopyButton value={setupTotp.secret.base32} label={t('otp.secret', 'secret')} />}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={codeId} className="text-sm font-medium">
            {t('otp.confirmationCodeLabel', 'Confirmation code')}
          </Label>
          <Input
            id={codeId}
            aria-invalid={setupError ? true : undefined}
            aria-describedby={setupError ? `${codeId}-error` : undefined}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value.replace(/\s+/g, ''))}
            maxLength={10}
            className="font-mono tracking-widest text-center max-w-[12rem]"
          />
          {setupError && (
            <p id={`${codeId}-error`} className="text-xs text-destructive">
              {setupError}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancelSetup}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="button" size="sm" onClick={confirmSetup}>
            <ShieldCheck aria-hidden="true" />
            {t('common.confirm', 'Confirm')}
          </Button>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t('otp.statusDisabled', 'Two-factor authentication is not enabled.')}
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={startSetup}>
          <ShieldCheck aria-hidden="true" />
          {t('otp.setUp', 'Set up TOTP')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-muted p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-[9px] bg-success-soft text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium">{t('otp.statusEnabled', 'Two-factor authentication is enabled.')}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          'otp.currentCodePrompt',
          'Enter your current 6-digit code to authorise any change to this account (including disabling two-factor authentication).',
        )}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={codeId} className="text-sm font-medium">
          {t('otp.currentCodeLabel', 'Current code')}
        </Label>
        <Input
          id={codeId}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={otpCodeValue}
          onChange={(e) => handleCodeChange(e.target.value.replace(/\s+/g, ''))}
          maxLength={10}
          className="font-mono tracking-widest text-center max-w-[12rem]"
        />
      </div>
      <div className="flex items-center justify-end">
        <Button type="button" variant="destructive" size="sm" onClick={handleDisable} disabled={!otpCodeValue.trim()}>
          <ShieldOff aria-hidden="true" />
          {t('otp.disable', 'Disable')}
        </Button>
      </div>
    </div>
  );
}
