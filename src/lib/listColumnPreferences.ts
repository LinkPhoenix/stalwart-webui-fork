export interface ListColumnPreferences {
  order: string[];
  hidden: string[];
}

const emptyPreferences = (): ListColumnPreferences => ({ order: [], hidden: [] });

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
}

export function parseListColumnPreferences(raw: string | null): ListColumnPreferences {
  if (raw === null) return emptyPreferences();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPreferences();

    const preferences = parsed as Record<string, unknown>;
    return {
      order: stringList(preferences.order),
      hidden: stringList(preferences.hidden),
    };
  } catch {
    return emptyPreferences();
  }
}
