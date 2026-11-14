/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import {
  buildCreateDefaults,
  getDisplayProperty,
  resolveForm,
  resolveVariantForm,
  type ResolvedView,
} from '@/lib/schemaResolver';

import { coerceLabel } from '@/lib/objectOptions';

import { errorMessage } from '@/lib/jmapErrors';

import {
  buildSections,
  combineForms,
  filterAccessibleFields,
  VARIANT_FIELD,
  type FieldValues,
  type RenderableSection,
} from '@/components/forms/formLogic';

import { initialFormState, type FormState } from '@/components/forms/formReducer';

import type { FormMode } from '@/components/forms/formContext';

import type { Fields, Form, Schema } from '@/types/schema';

/** Fields the server returns on create that are pure noise in the UI. */
const NOISY_CREATED_KEYS = new Set(['id', 'blobId']);

/** Strip id/blobId from a server-created object, keeping the rest as form values. */
export function extractCreatedExtras(created: Record<string, unknown>): FieldValues {
  const extras: FieldValues = {};
  for (const [key, value] of Object.entries(created)) {
    if (!NOISY_CREATED_KEYS.has(key)) extras[key] = value;
  }
  return extras;
}

export function createDefaults(schema: Schema, view: ResolvedView, variant: string | undefined): FieldValues {
  const data = buildCreateDefaults(schema, view.object, view.resolvedSchema, variant, view.list?.filtersStatic);
  if (variant) data[VARIANT_FIELD] = variant;
  return data;
}

export function initialCreateVariant(view: ResolvedView): string | undefined {
  const { resolvedSchema, list } = view;
  if (resolvedSchema.type !== 'multiple') return undefined;
  const fromFilter = list?.filtersStatic?.[VARIANT_FIELD];
  return typeof fromFilter === 'string' ? fromFilter : (resolvedSchema.variants[0]?.name ?? '');
}

export function initialState(schema: Schema | null, view: ResolvedView | null, mode: FormMode): FormState {
  if (mode !== 'create' || !schema || !view) return initialFormState();
  const variant = initialCreateVariant(view);
  return initialFormState(createDefaults(schema, view, variant), variant ?? '', view);
}

export function loadedVariant(view: ResolvedView, data: FieldValues): string {
  if (view.resolvedSchema.type !== 'multiple') return '';
  const type = data[VARIANT_FIELD];
  return typeof type === 'string' ? type : (view.resolvedSchema.variants[0]?.name ?? '');
}

export interface FormParts {
  fields: Fields | null;
  parentForm: Form | null;
  variantForm: Form | null;
  form: Form | null;
  sections: RenderableSection[];
}

/** Resolve the accessible fields, the parent/variant forms and the rendered sections for a view. */
export function resolveFormParts(
  schema: Schema | null,
  resolved: ResolvedView | null,
  viewName: string,
  variantName: string,
  mode: FormMode,
  canGet: (permissionPrefix: string) => boolean,
): FormParts {
  const sch = resolved?.resolvedSchema ?? null;
  const variant = sch?.type === 'multiple' ? sch.variants.find((v) => v.name === variantName) : undefined;
  const rawFields: Fields | null = !sch ? null : sch.type === 'single' ? sch.fields : (variant?.fields ?? null);
  const fields = schema ? filterAccessibleFields(rawFields, schema, canGet) : null;

  let parentForm: Form | null = null;
  let variantForm: Form | null = null;
  if (schema && resolved && sch) {
    if (sch.type === 'single') {
      variantForm = resolveForm(schema, viewName, resolved.object.objectName, sch.schemaName);
    } else {
      parentForm = schema.forms[viewName] ?? schema.forms[resolved.object.objectName] ?? null;
      variantForm = variant
        ? resolveVariantForm(schema, viewName, resolved.object.objectName, variant.schemaName)
        : null;
    }
  }
  const form = sch?.type === 'multiple' ? combineForms(parentForm, variantForm) : variantForm;
  const sections = buildSections(form, fields, mode);
  return { fields, parentForm, variantForm, form, sections };
}

export interface LoadStateInput {
  mode: FormMode;
  fetchStatus: string;
  isFetchedAfterMount: boolean;
  isError: boolean;
  error: unknown;
  isSuccess: boolean;
  hasData: boolean;
}

export interface LoadState {
  loading: boolean;
  loadError: string | null;
  loadFailed: boolean;
}

type Translate = (key: string, fallback: string) => string;

/** Derive the loading / error state of the object query for a form. */
export function computeLoadState(
  input: LoadStateInput,
  t: Translate,
): LoadState {
  const loading = input.mode === 'edit' && input.fetchStatus !== 'idle' && !input.isFetchedAfterMount;
  const loadError =
    input.mode === 'create'
      ? null
      : input.isError
        ? errorMessage(input.error, t('form.failedToLoadData', 'Failed to load data.'))
        : input.isSuccess && !input.hasData
          ? t('form.objectNotFound', 'Object not found.')
          : null;
  const loadFailed = input.mode === 'edit' && loadError !== null && !input.hasData;
  return { loading, loadError, loadFailed };
}

/** Display label of the record being edited, from the list label property or the schema default. */
export function computeRecordLabel(
  schema: Schema | null,
  viewName: string,
  resolved: ResolvedView | null,
  data: FieldValues,
): string {
  const labelProperty = schema ? (resolved?.list?.labelProperty ?? getDisplayProperty(schema, viewName)) : undefined;
  return labelProperty ? coerceLabel(data[labelProperty], '') : '';
}
