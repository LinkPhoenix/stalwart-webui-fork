/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronsUpDown, Check, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  marker?: ReactNode;
  keywords?: string[];
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  contentClassName?: string;
  nullable?: boolean;
  nullLabel?: string;
  onFirstOpen?: () => void;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No matches.',
  disabled,
  contentClassName,
  nullable,
  nullLabel = 'None',
  onFirstOpen,
  className,
  ...ariaProps
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined);
  const firstOpenRef = useRef(false);

  useEffect(() => {
    if (open && triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (next && !firstOpenRef.current) {
      firstOpenRef.current = true;
      onFirstOpen?.();
    }
    setOpen(next);
  };

  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          {...ariaProps}
          ref={triggerRef}
          type="button"
          variant="field"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between px-3', !selected && 'text-dim', className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.marker}
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-0', contentClassName)}
        align="start"
        style={triggerWidth ? { width: triggerWidth } : undefined}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {nullable && (
                <CommandItem
                  value="__null__"
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4 opacity-50" />
                  <span className="text-muted-foreground">{nullLabel}</span>
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex flex-1 items-center gap-2 truncate">
                    {option.marker}
                    <span className="flex flex-col truncate">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="truncate text-xs text-muted-foreground">{option.description}</span>
                      )}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
