/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { dismissSievepadWarning, isSievepadWarningDismissed, openInSievepad } from '@/lib/sievepad';

interface SievepadButtonProps {
  scriptName: string;
  source: string;
}

export function SievepadButton({ scriptName, source }: SievepadButtonProps) {
  const { t } = useTranslation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const open = () => {
    openInSievepad(scriptName || t('sievepad.defaultName', 'Sieve script'), source).catch(() => {
      toast({ title: t('sievepad.failed', 'Failed to open Sievepad.'), variant: 'destructive' });
    });
  };

  const handleClick = () => {
    if (isSievepadWarningDismissed()) {
      open();
    } else {
      setDontShowAgain(false);
      setWarningOpen(true);
    }
  };

  const handleContinue = () => {
    if (dontShowAgain) dismissSievepadWarning();
    setWarningOpen(false);
    open();
  };

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={!source.trim()}>
          <Bug className="h-4 w-4" />
          {t('sievepad.debug', 'Debug')}
        </Button>
      </div>
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sievepad.warningTitle', 'Debug in Sievepad')}</DialogTitle>
            <DialogDescription>
              {t(
                'sievepad.warningDescription',
                'A new tab will open sievepad.com with a copy of this script. Sievepad compiles and runs the script entirely in your browser: nothing is uploaded to or stored on any server.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sievepad-dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="sievepad-dont-show-again" className="text-sm font-normal">
              {t('sievepad.dontShowAgain', "Don't show this again")}
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWarningOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleContinue}>
              {t('common.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
