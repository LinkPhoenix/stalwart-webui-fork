/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { changedKeys, valuesEqual, type FieldErrors, type FieldValues } from '@/components/forms/formLogic';

export interface CreatedResult {
  id: string;
  values: FieldValues;
}

export interface FormState {
  data: FieldValues;
  original: FieldValues;
  variant: string;
  dirty: ReadonlySet<string>;
  fieldErrors: FieldErrors;
  generalError: string | null;
  created: CreatedResult | null;
  source: unknown;
}

export type FormAction =
  | { type: 'load'; data: FieldValues; variant: string; source: unknown }
  | { type: 'setField'; name: string; value: unknown }
  | { type: 'setVariant'; variant: string; data: FieldValues }
  | { type: 'setErrors'; generalError: string | null; fieldErrors?: FieldErrors }
  | { type: 'commit' }
  | { type: 'created'; result: CreatedResult };

const NO_ERRORS: FieldErrors = {};
const CLEAN: ReadonlySet<string> = new Set();

export function initialFormState(data: FieldValues = {}, variant = '', source: unknown = null): FormState {
  return {
    data,
    original: data,
    variant,
    dirty: CLEAN,
    fieldErrors: NO_ERRORS,
    generalError: null,
    created: null,
    source,
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'load':
      return initialFormState(action.data, action.variant, action.source);
    case 'setField': {
      const data = { ...state.data, [action.name]: action.value };
      const isChanged = !valuesEqual(state.original[action.name], action.value);
      let dirty = state.dirty;
      if (isChanged !== dirty.has(action.name)) {
        const next = new Set(dirty);
        if (isChanged) next.add(action.name);
        else next.delete(action.name);
        dirty = next;
      }
      let fieldErrors = state.fieldErrors;
      if (action.name in fieldErrors) {
        fieldErrors = { ...fieldErrors };
        delete fieldErrors[action.name];
      }
      return { ...state, data, dirty, fieldErrors };
    }
    case 'setVariant':
      return {
        ...state,
        variant: action.variant,
        data: action.data,
        dirty: changedKeys(state.original, action.data),
        fieldErrors: NO_ERRORS,
      };
    case 'setErrors':
      return { ...state, generalError: action.generalError, fieldErrors: action.fieldErrors ?? NO_ERRORS };
    case 'commit':
      return { ...state, original: state.data, dirty: CLEAN, created: null };
    case 'created':
      return { ...state, original: state.data, dirty: CLEAN, created: action.result };
  }
}

export function isFormDirty(state: FormState): boolean {
  return state.dirty.size > 0;
}
