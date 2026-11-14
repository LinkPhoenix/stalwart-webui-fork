/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useReducer } from 'react';

import { useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { useSchemaStore } from '@/stores/schemaStore';

import { usePermissionCheckers } from '@/hooks/usePermissions';

import { useResolvedView } from '@/hooks/useResolvedView';

import { toast } from '@/hooks/use-toast';

import { buildEmbeddedDefaults } from '@/lib/schemaResolver';

import { layoutViewFor } from '@/lib/layout';

import { switchVariantValues } from '@/lib/embeddedSchema';

import { errorMessage, friendlySetError, validationErrorMessage } from '@/lib/jmapErrors';

import { logFormChange } from '@/lib/debug';

import { useJmapObject } from '@/data/objects';

import { useJmapSet } from '@/data/mutations';

import {
  buildCreatePayload,
  buildUpdatePatch,
  collectBlobUploads,
  collectFetchProperties,
  formFieldNames,
  isOtpAuthValid,
  mapSetError,
  validateRequired,
} from '@/components/forms/formLogic';

import { formReducer, isFormDirty } from '@/components/forms/formReducer';

import { useUnsavedChangesGuard } from '@/components/forms/useUnsavedChangesGuard';

import {
  computeLoadState,
  computeRecordLabel,
  createDefaults,
  extractCreatedExtras,
  initialCreateVariant,
  initialState,
  loadedVariant,
  resolveFormParts,
} from '@/components/forms/formModel';

import type { FormMode } from '@/components/forms/formContext';

import type { JmapSetError } from '@/types/jmap';

const CREATE_ID = 'new-0';

export function useDynamicForm(viewName: string, objectId: string | null) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const { canGet } = usePermissionCheckers();
  const resolved = useResolvedView(viewName);
  const mode: FormMode = objectId === null ? 'create' : 'edit';
  const isSingleton = resolved?.object.objectType.type === 'singleton';
  const objectName = resolved?.object.objectName;

  const [state, dispatch] = useReducer(formReducer, null, () => initialState(schema, resolved, mode));
  const isDirty = isFormDirty(state);

  if (mode === 'create' && schema && resolved && state.source !== resolved) {
    const variant = initialCreateVariant(resolved);
    dispatch({
      type: 'load',
      data: createDefaults(schema, resolved, variant),
      variant: variant ?? '',
      source: resolved,
    });
  }

  const objectQuery = useJmapObject(
    objectName,
    mode === 'create' ? null : isSingleton ? 'singleton' : objectId,
    schema && resolved ? collectFetchProperties(schema, resolved, viewName) : ['id'],
    { staleTime: 0, refetchOnMount: 'always' },
  );
  if (objectQuery.data && objectQuery.data !== state.source && !isDirty && resolved) {
    dispatch({
      type: 'load',
      data: { ...objectQuery.data },
      variant: loadedVariant(resolved, objectQuery.data),
      source: objectQuery.data,
    });
  }

  useEffect(() => {
    logFormChange(`${viewName}${objectId ? ` (${objectId})` : ' (new)'}`, state.data);
  }, [state.data, viewName, objectId]);

  const setMutation = useJmapSet(objectName);
  const saving = setMutation.isPending;
  const guard = useUnsavedChangesGuard(isDirty && !saving);

  const { fields, parentForm, variantForm, form, sections } = resolveFormParts(
    schema,
    resolved,
    viewName,
    state.variant,
    mode,
    canGet,
  );

  const { loading, loadError, loadFailed } = computeLoadState(
    {
      mode,
      fetchStatus: objectQuery.fetchStatus,
      isFetchedAfterMount: objectQuery.isFetchedAfterMount,
      isError: objectQuery.isError,
      error: objectQuery.error,
      isSuccess: objectQuery.isSuccess,
      hasData: objectQuery.data !== undefined,
    },
    (key, fallback) => t(key, fallback),
  );
  const retryLoad = () => void objectQuery.refetch();

  const recordLabel = computeRecordLabel(schema, viewName, resolved, state.data);

  const listView = schema ? layoutViewFor(schema, viewToSection, viewName) : null;
  const listPath = listView ? `/${viewToSection[listView]}/${listView}` : '/';
  const leaveToList = () => {
    guard.allowNextNavigation();
    navigate(listPath);
  };

  const applySetError = (error: JmapSetError) => {
    const { general, fieldErrors } = mapSetError(error, new Set(Object.keys(fields?.properties ?? {})), {
      general: friendlySetError(error),
      invalidValue: t('form.invalidValue', 'Invalid value.'),
      validation: validationErrorMessage,
    });
    dispatch({ type: 'setErrors', generalError: general, fieldErrors });
  };

  const notConfirmed = () =>
    dispatch({ type: 'setErrors', generalError: t('form.notConfirmed', 'The server did not confirm the change.') });

  const setField = (name: string, value: unknown) => dispatch({ type: 'setField', name, value });

  const setVariant = (next: string) => {
    if (!schema || !resolved || resolved.resolvedSchema.type !== 'multiple') return;
    const { variants } = resolved.resolvedSchema;
    const defaults =
      mode === 'create'
        ? createDefaults(schema, resolved, next)
        : buildEmbeddedDefaults(schema, resolved.object.objectName, {}, next);

    const data = switchVariantValues(
      variants.find((v) => v.name === state.variant)?.fields,
      variants.find((v) => v.name === next)?.fields,
      state.data,
      defaults,
      mode === 'edit' ? state.original : undefined,
    );

    dispatch({ type: 'setVariant', variant: next, data });
  };

  const save = async () => {
    if (!resolved || saving) return;
    if (fields) {
      const visible = formFieldNames(parentForm, variantForm);
      const errors = validateRequired(
        state.data,
        fields,
        mode,
        t('form.required', 'This field is required.'),
        visible.size > 0 ? visible : undefined,
        schema ?? undefined,
      );
      if (Object.keys(errors).length > 0) {
        dispatch({
          type: 'setErrors',
          generalError: t('form.correctErrorsBelow', 'Please correct the errors below.'),
          fieldErrors: errors,
        });
        return;
      }
    }
    if (!isOtpAuthValid(state.data)) {
      dispatch({
        type: 'setErrors',
        generalError: t('form.otpCodeRequired', 'Enter your current authenticator code to authorise this change.'),
      });
      return;
    }
    dispatch({ type: 'setErrors', generalError: null });

    try {
      if (mode === 'create') {
        const { blobs, payload } = collectBlobUploads(
          buildCreatePayload(state.data, fields, {
            filtersStatic: resolved.list?.filtersStatic,
            variant: resolved.resolvedSchema.type === 'multiple' ? state.variant : undefined,
          }),
          fields,
        );
        const result = await setMutation.mutateAsync({ create: { [CREATE_ID]: payload }, blobs });
        const created = result.created?.[CREATE_ID];

        if (created) {
          const extras = extractCreatedExtras(created);
          if (Object.keys(extras).length > 0) {
            dispatch({ type: 'created', result: { id: String(created.id), values: extras } });
          } else {
            toast({ title: t('form.createdSuccess', 'Created successfully'), variant: 'success' });
            dispatch({ type: 'commit' });
            leaveToList();
          }
        } else if (result.notCreated?.[CREATE_ID]) {
          applySetError(result.notCreated[CREATE_ID]);
        } else {
          notConfirmed();
        }
        return;
      }

      const patch = buildUpdatePatch(state.original, state.data, fields);
      if (Object.keys(patch).length === 0) {
        toast({ title: t('form.noChangesToSave', 'No changes to save'), variant: 'default' });
        return;
      }
      const { blobs, payload } = collectBlobUploads(patch, fields, state.original);
      const updateId = isSingleton ? 'singleton' : objectId!;
      const result = await setMutation.mutateAsync({ update: { [updateId]: payload }, blobs });
      if (result.updated && updateId in result.updated) {
        toast({ title: t('form.savedSuccess', 'Saved successfully'), variant: 'success' });
        dispatch({ type: 'commit' });
        if (!isSingleton) leaveToList();
      } else if (result.notUpdated?.[updateId]) {
        applySetError(result.notUpdated[updateId]);
      } else {
        notConfirmed();
      }
    } catch (err) {
      dispatch({ type: 'setErrors', generalError: errorMessage(err, t('form.failedToSave', 'Failed to save.')) });
    }
  };

  const remove = async () => {
    if (!resolved || !objectId) return;
    dispatch({ type: 'setErrors', generalError: null });
    try {
      const result = await setMutation.mutateAsync({ destroy: [objectId] });
      if (result.destroyed?.includes(objectId)) {
        const label = resolved.list?.singularName ?? resolved.object.objectType.description;
        toast({
          title: t('form.deletedSuccess', '{{name}} deleted successfully', {
            name: label.charAt(0).toUpperCase() + label.slice(1),
          }),
          variant: 'success',
        });
        dispatch({ type: 'commit' });
        leaveToList();
      } else if (result.notDestroyed?.[objectId]) {
        dispatch({ type: 'setErrors', generalError: friendlySetError(result.notDestroyed[objectId]) });
      } else {
        notConfirmed();
      }
    } catch (err) {
      dispatch({ type: 'setErrors', generalError: errorMessage(err, t('form.failedToDelete', 'Failed to delete.')) });
    }
  };

  const continueAfterCreate = () => {
    dispatch({ type: 'commit' });
    leaveToList();
  };

  return {
    schema,
    resolved,
    mode,
    isSingleton,
    state,
    isDirty,
    saving,
    loading,
    loadError,
    loadFailed,
    retryLoad,
    fields,
    parentForm,
    variantForm,
    form,
    sections,
    recordLabel,
    guard,
    setField,
    setVariant,
    save,
    remove,
    continueAfterCreate,
  };
}

export type DynamicFormModel = ReturnType<typeof useDynamicForm>;
