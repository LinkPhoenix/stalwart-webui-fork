import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, ChevronDown, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  deleteLogFilterPreset,
  listLogFilterPresets,
  saveLogFilterPreset,
  type LogFilterPreset,
} from '@/lib/logFilterPresets';
import { PROBLEMS_ONLY_KEY } from './clientList';

/** One manual refresh per this long, so the log is not hammered. */
const REFRESH_COOLDOWN_MS = 5000;
const AUTO_REFRESH_MS = 10_000;

interface LogListToolsProps {
  filters: Record<string, string>;
  isFirstPage: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onApplyFilters: (filters: Record<string, string>) => void;
}

/**
 * Log Entries tools: rate-limited Refresh, 10 s auto-refresh (first page
 * only, paused in background tabs) and named filter presets kept in
 * localStorage.
 */
export function LogListTools({ filters, isFirstPage, isFetching, onRefresh, onApplyFilters }: LogListToolsProps) {
  const { t } = useTranslation();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [presets, setPresets] = useState<LogFilterPreset[]>(() => listLogFilterPresets());

  useEffect(() => {
    if (!cooling) return;
    const id = window.setTimeout(() => setCooling(false), REFRESH_COOLDOWN_MS);
    return () => window.clearTimeout(id);
  }, [cooling]);

  const refresh = () => {
    if (cooling) return;
    setCooling(true);
    onRefresh();
  };

  const tick = useEffectEvent(() => {
    if (document.visibilityState !== 'hidden') onRefresh();
  });
  useEffect(() => {
    if (!autoRefresh || !isFirstPage || isFetching) return;
    const id = window.setInterval(tick, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, isFirstPage, isFetching]);

  const presetFilters = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== PROBLEMS_ONLY_KEY));
  const canSave = Object.keys(presetFilters).length > 0;

  const savePreset = () => {
    const name = window.prompt(t('list.filterPresetNamePrompt', 'Name for this filter preset'));
    if (!name?.trim()) return;
    saveLogFilterPreset(name, presetFilters);
    setPresets(listLogFilterPresets());
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch id="log-auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        <Label htmlFor="log-auto-refresh" className="text-[13px] font-medium">
          {t('list.autoRefresh', 'Auto-refresh')}
        </Label>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={refresh}
        disabled={cooling || isFetching}
        title={cooling ? t('list.refreshCooldown', 'Please wait a few seconds before refreshing again') : undefined}
      >
        <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
        {t('list.refresh', 'Refresh')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="sm">
            <Bookmark aria-hidden />
            {t('list.filterPresets', 'Presets')}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {presets.length === 0 ? (
            <DropdownMenuItem disabled>{t('list.filterPresetsEmpty', 'No saved presets')}</DropdownMenuItem>
          ) : (
            presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                className="flex items-center justify-between gap-2"
                onSelect={() => onApplyFilters(preset.filters)}
              >
                <span className="truncate">{preset.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t('list.filterPresetDelete', 'Delete preset')}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteLogFilterPreset(preset.id);
                    setPresets(listLogFilterPresets());
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canSave} onSelect={savePreset}>
            {t('list.filterPresetSave', 'Save preset')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
