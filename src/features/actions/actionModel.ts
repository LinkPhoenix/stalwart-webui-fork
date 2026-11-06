/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isMissingValue, isRequiredField, isUnchangedSecret } from '@/lib/fieldRules';
import type { Fields, FormSection, ObjectVariant } from '@/types/schema';

export interface ActionEntry {
  variant: ObjectVariant;
  name: string;
}

export interface ActionGroup {
  label: string;
  actions: ActionEntry[];
}

export function splitActionLabel(label: string): { group: string | null; name: string } {
  const colon = label.indexOf(':');
  if (colon <= 0) return { group: null, name: label };
  return { group: label.slice(0, colon).trim(), name: label.slice(colon + 1).trim() };
}

export function groupActions(
  variants: readonly ObjectVariant[],
  isAllowed: (variant: ObjectVariant) => boolean,
  otherLabel: string,
): ActionGroup[] {
  const groups = new Map<string, ActionEntry[]>();
  for (const variant of variants) {
    if (!isAllowed(variant)) continue;
    const { group, name } = splitActionLabel(variant.label);
    const key = group ?? otherLabel;
    const list = groups.get(key);
    if (list) list.push({ variant, name });
    else groups.set(key, [{ variant, name }]);
  }
  return Array.from(groups, ([label, actions]) => ({ label, actions }));
}

export function editableSections(sections: readonly FormSection[], fields: Fields): FormSection[] {
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((ff) => fields.properties[ff.name]?.update === 'mutable'),
    }))
    .filter((section) => section.fields.length > 0);
}

export function missingRequiredFields(
  sections: readonly FormSection[],
  fields: Fields,
  data: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    for (const ff of section.fields) {
      const def = fields.properties[ff.name];
      if (def && isRequiredField(def) && isMissingValue(data[ff.name])) missing.push(ff.name);
    }
  }
  return missing;
}

export function buildActionPayload(
  variantName: string,
  fields: Fields | null,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { '@type': variantName };
  if (!fields) return payload;
  for (const [name, def] of Object.entries(fields.properties)) {
    if (def.update === 'serverSet' || !(name in data)) continue;
    if (isUnchangedSecret(def, data[name])) continue;
    payload[name] = data[name];
  }
  return payload;
}

export function extraCreatedProperties(
  created: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!created) return null;
  const entries = Object.entries(created).filter(([k]) => k !== 'id' && k !== 'blobId');
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
