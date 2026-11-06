import { PanelsTopLeftIcon, RocketIcon, type LucideIcon } from 'lucide-react';

/**
 * Icons used by the fork's client-side pages (Getting Started, Overview).
 * Kept apart from icons.generated.ts, which upstream regenerates from the
 * schema and would drop any hand-added entry.
 */
export const FORK_ICONS: Readonly<Record<string, LucideIcon>> = {
  rocket: RocketIcon,
  'panels-top-left': PanelsTopLeftIcon,
};
