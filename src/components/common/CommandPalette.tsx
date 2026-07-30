/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { friendlyName, getActionInfo, getObjectKind, useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { SearchIndexEntry } from '@/stores/schemaStore';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation();
  const closePalette = useCallback(() => onOpenChange(false), [onOpenChange]);
  const { query, setQuery, debouncedQuery, groups, selectEntry, reset, schema } = useGlobalSearch(closePalette);

  const groupLabels: Record<SearchIndexEntry['type'], string> = useMemo(
    () => ({
      link: t('globalSearch.pages', 'Pages'),
      form: t('globalSearch.formSections', 'Form Sections'),
      field: t('globalSearch.fields', 'Fields'),
    }),
    [t],
  );

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] translate-y-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{t('globalSearch.title', 'Search')}</DialogTitle>
        <Command
          shouldFilter={false}
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={t('globalSearch.placeholder', 'Search pages, fields, settings...')}
            value={query}
            onValueChange={setQuery}
            trailing={
              <kbd className="pointer-events-none ml-2 inline-flex h-5 shrink-0 select-none items-center rounded-md border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            }
          />
          <CommandList>
            <CommandEmpty>
              {debouncedQuery.trim()
                ? t('globalSearch.noResults', 'No results found.')
                : t('globalSearch.typeToSearch', 'Type to search the admin panel.')}
            </CommandEmpty>
            {Array.from(groups.entries()).map(([type, entries]) => (
              <CommandGroup key={type} heading={groupLabels[type]}>
                {entries.map((entry, idx) => {
                  const objectKind = schema ? getObjectKind(schema, entry.viewName) : null;
                  const { label: actionLabel, Icon: ActionIcon } = getActionInfo(entry.type, objectKind, t);
                  const itemValue = `${type}-${idx}-${entry.viewName}`;

                  return (
                    <CommandItem key={itemValue} value={itemValue} onSelect={() => selectEntry(entry)}>
                      <ActionIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate font-medium">{friendlyName(entry.text)}</span>
                        <span className="truncate text-xs text-muted-foreground">{entry.breadcrumb}</span>
                      </div>
                      <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{actionLabel}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
