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

function uniqueEntries(entries: SearchIndexEntry[]): Array<[string, SearchIndexEntry]> {
  const seen = new Map<string, SearchIndexEntry>();
  for (const entry of entries) {
    const key = [entry.type, entry.section, entry.viewName, entry.breadcrumb, entry.text].join('|');
    if (!seen.has(key)) seen.set(key, entry);
  }
  return Array.from(seen);
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation();
  const closePalette = useCallback(() => onOpenChange(false), [onOpenChange]);
  const { query, setQuery, deferredQuery, groups, selectEntry, reset, schema } = useGlobalSearch(closePalette);

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
          className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-dim [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-xl [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-2 [&_[cmdk-item][data-selected=true]]:bg-muted [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4 [&_[cmdk-list]]:max-h-[min(60vh,420px)] [&_[cmdk-list]]:pb-2"
        >
          <CommandInput
            placeholder={t('globalSearch.placeholder', 'Search pages, fields, settings...')}
            value={query}
            onValueChange={setQuery}
            trailing={
              <kbd
                aria-hidden="true"
                className="pointer-events-none ml-2 inline-flex h-5 shrink-0 select-none items-center rounded-md bg-muted px-1.5 font-mono text-[10px] font-medium text-dim"
              >
                ESC
              </kbd>
            }
          />
          <CommandList>
            <CommandEmpty>
              {deferredQuery.trim()
                ? t('globalSearch.noResults', 'No results found.')
                : t('globalSearch.typeToSearch', 'Type to search the admin panel.')}
            </CommandEmpty>
            {Array.from(groups.entries()).map(([type, entries]) => (
              <CommandGroup key={type} heading={groupLabels[type]}>
                {uniqueEntries(entries).map(([itemValue, entry]) => {
                  const objectKind = schema ? getObjectKind(schema, entry.viewName) : null;
                  const { label: actionLabel, Icon: ActionIcon } = getActionInfo(entry.type, objectKind, t);

                  return (
                    <CommandItem key={itemValue} value={itemValue} onSelect={() => selectEntry(entry)}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-highlight text-highlight-foreground">
                        <ActionIcon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate font-medium">{friendlyName(entry.text)}</span>
                        <span className="truncate text-xs text-dim">{entry.breadcrumb}</span>
                      </div>
                      <span className="ml-auto shrink-0 pl-2 text-xs font-medium text-dim">{actionLabel}</span>
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
