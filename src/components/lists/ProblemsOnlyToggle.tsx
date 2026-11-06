import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PROBLEMS_ONLY_KEY } from './clientList';

interface ProblemsOnlyToggleProps {
  filters: Record<string, string>;
  onApplyFilters: (filters: Record<string, string>) => void;
}

/**
 * SCHEMA-DEVIATION: report-problems-only-filter (see SCHEMA_DEVIATIONS.md)
 *
 * Narrows DMARC / TLS / ARF report lists to rows with quarantine or reject
 * dispositions, failed sessions or incidents. The state lives in the list
 * URL (`f.problemsOnly=1`) and is applied in the browser (fetch-all mode).
 */
export function ProblemsOnlyToggle({ filters, onApplyFilters }: ProblemsOnlyToggleProps) {
  const { t } = useTranslation();
  const id = useId();
  const checked = filters[PROBLEMS_ONLY_KEY] === '1';

  const toggle = (next: boolean) => {
    const rest = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== PROBLEMS_ONLY_KEY));
    onApplyFilters(next ? { ...rest, [PROBLEMS_ONLY_KEY]: '1' } : rest);
  };

  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={toggle} />
      <Label htmlFor={id} className="text-[13px] font-medium">
        {t('list.problemsOnly', 'Problems only')}
      </Label>
    </div>
  );
}
