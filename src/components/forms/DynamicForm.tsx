/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react';

import { useSchemaStore } from '@/stores/schemaStore';
import { useAccountStore } from '@/stores/accountStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  resolveObject,
  resolveSchema,
  resolveList,
  resolveForm,
  resolveVariantForm,
  buildCreateDefaults,
  buildEmbeddedDefaults,
} from '@/lib/schemaResolver';
import { jmapGet, jmapSet, jmapRequest, getAccountId } from '@/services/jmap/client';
import { calculateJmapPatch } from '@/lib/jmapPatch';
import { friendlySetError, validationErrorMessage } from '@/lib/jmapErrors';
import { coerceLabel } from '@/lib/objectOptions';
import { SECRET_MASK } from '@/lib/jmapUtils';
import { toast } from '@/hooks/use-toast';
import { logFormChange } from '@/lib/debug';
import { FieldWidget } from '@/components/forms/FieldWidget';
import { BackendVariantIcon } from '@/components/common/BackendIcon';

import type { Field, Fields, Form, FormField, Schema } from '@/types/schema';
import type { JmapSetResponse, JmapSetError, JmapMethodCall } from '@/types/jmap';

interface DynamicFormProps {
  viewName: string;
  objectId: string | null;
}

export function DynamicForm({ viewName, objectId }: DynamicFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const edition = useAccountStore((s) => s.edition);
  const { canUpdateObject, canDestroyObject } = usePermissions();

  const resolved = useMemo(() => {
    if (!schema) return null;
    const obj = resolveObject(schema, viewName);
    if (!obj) return null;
    const sch = resolveSchema(schema, obj.objectName);
    if (!sch) return null;
    const list = resolveList(schema, viewName, obj.objectName);
    return { obj, sch, list };
  }, [schema, viewName]);

  const isCreate = objectId === null;
  const isSingleton = resolved?.obj.objectType.type === 'singleton';

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [originalData, setOriginalData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [selectedVariant, setSelectedVariant] = useState<string>('');

  const [serverCreatedProps, setServerCreatedProps] = useState<Record<string, unknown> | null>(null);
  const [createdObjectId, setCreatedObjectId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const currentFields = useMemo((): Fields | null => {
    if (!resolved) return null;
    const { sch } = resolved;
    let fields: Fields | null;
    if (sch.type === 'single') {
      fields = sch.fields;
    } else {
      if (!selectedVariant) return null;
      const variant = sch.variants.find((v) => v.name === selectedVariant);
      fields = variant?.fields ?? null;
    }
    if (!fields || !schema) return fields;
    const canGet = (prefix: string) => useAccountStore.getState().hasObjectPermission(prefix, 'Get');
    const filtered: Record<string, Field> = {};
    for (const [name, field] of Object.entries(fields.properties)) {
      if (fieldReferencesInaccessibleObject(field, schema, canGet)) continue;
      filtered[name] = field;
    }
    return { ...fields, properties: filtered };
  }, [resolved, selectedVariant, schema]);

  const currentForm = useMemo((): Form | null => {
    if (!schema || !resolved) return null;
    const { obj, sch } = resolved;
    if (sch.type === 'single') {
      return resolveForm(schema, viewName, obj.objectName, sch.schemaName);
    }
    if (!selectedVariant) return null;
    const variant = sch.variants.find((v) => v.name === selectedVariant);
    return resolveVariantForm(schema, viewName, obj.objectName, variant?.schemaName);
  }, [schema, resolved, viewName, selectedVariant]);

  const parentForm = useMemo((): Form | null => {
    if (!schema || !resolved) return null;
    const { obj, sch } = resolved;
    if (sch.type !== 'multiple') return null;
    return schema.forms[viewName] ?? schema.forms[obj.objectName] ?? null;
  }, [schema, resolved, viewName]);

  const fetchProperties = useMemo((): string[] => {
    if (!schema || !resolved) return ['id'];
    const { obj, sch } = resolved;
    const set = new Set<string>(['id']);

    const collectFromForm = (form: { sections: { fields: { name: string }[] }[] } | null | undefined) => {
      if (!form) return;
      for (const section of form.sections) {
        for (const ff of section.fields) {
          if (ff.name && ff.name !== '@type') set.add(ff.name);
        }
      }
    };

    if (sch.type === 'multiple') {
      set.add('@type');
      collectFromForm(schema.forms[viewName] ?? schema.forms[obj.objectName]);
      for (const variant of sch.variants) {
        if (variant.schemaName) collectFromForm(schema.forms[variant.schemaName]);
      }
    } else {
      const singleForm = resolveForm(schema, viewName, obj.objectName, sch.schemaName);
      if (singleForm) {
        collectFromForm(singleForm);
      } else {
        for (const name of Object.keys(sch.fields.properties)) set.add(name);
      }
    }
    return Array.from(set);
  }, [schema, resolved, viewName]);

  const [prevCreateInitKey, setPrevCreateInitKey] = useState<typeof resolved | undefined>(undefined);
  if (isCreate && schema && resolved) {
    if (resolved !== prevCreateInitKey) {
      setPrevCreateInitKey(resolved);
      const { obj, sch } = resolved;
      const staticFilters = resolved.list?.filtersStatic;
      if (sch.type === 'multiple') {
        const variantFromFilter = typeof staticFilters?.['@type'] === 'string' ? staticFilters['@type'] : undefined;
        const initialVariant = variantFromFilter ?? sch.variants[0]?.name ?? '';
        setSelectedVariant(initialVariant);
        const defaults = buildCreateDefaults(schema, obj, sch, initialVariant, staticFilters);
        setFormData(defaults);
        setOriginalData(defaults);
      } else {
        const defaults = buildCreateDefaults(schema, obj, sch, undefined, staticFilters);
        setFormData(defaults);
        setOriginalData(defaults);
      }
    }
  } else if (prevCreateInitKey !== undefined) {
    setPrevCreateInitKey(undefined);
  }

  useEffect(() => {
    if (!schema || !resolved || isCreate) return;
    const { obj, sch } = resolved;

    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      try {
        const accountId = getAccountId(obj.objectName);
        const ids = isSingleton ? ['singleton'] : [objectId];
        const responses = await jmapGet(obj.objectName, accountId, ids, fetchProperties, ctrl.signal);
        if (ctrl.signal.aborted) return;

        const result = responses[0]?.[1];
        const list = result?.list as Array<Record<string, unknown>> | undefined;
        if (list?.[0]) {
          const data = list[0];
          setFormData({ ...data });
          setOriginalData({ ...data });

          if (sch.type === 'multiple') {
            const variantType = (data['@type'] as string) ?? sch.variants[0]?.name ?? '';
            setSelectedVariant(variantType);
          }
        } else {
          setGeneralError(t('form.objectNotFound', 'Object not found.'));
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setGeneralError(err instanceof Error ? err.message : t('form.failedToLoadData', 'Failed to load data.'));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
    };
  }, [schema, resolved, objectId, isCreate, isSingleton, fetchProperties, t]);

  useEffect(() => {
    logFormChange(`${viewName}${objectId ? ` (${objectId})` : ' (new)'}`, formData);
  }, [formData, viewName, objectId]);

  useEffect(() => {
    return () => {
      setGeneralError(null);
      setFieldErrors({});
    };
  }, [viewName, objectId]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const blocker = useBlocker(isDirty && !saving);

  const navigateAfterCreate = useCallback(() => {
    flushSync(() => {
      setOriginalData({ ...formData });
      setServerCreatedProps(null);
    });
    const section = viewToSection[viewName] ?? '';
    navigate(`/${section}/${viewName}`);
  }, [formData, viewToSection, viewName, navigate]);

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setFieldErrors((prev) => {
      if (prev[fieldName]) {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      }
      return prev;
    });
  }, []);

  const handleVariantChange = useCallback(
    (newVariant: string) => {
      if (!schema || !resolved) return;
      const { obj, sch } = resolved;
      if (sch.type !== 'multiple') return;

      setSelectedVariant(newVariant);

      const newData = buildEmbeddedDefaults(schema, obj.objectName, {}, newVariant);
      setFormData(newData);
    },
    [schema, resolved],
  );

  const collectBlobUploads = useCallback(
    (
      payload: Record<string, unknown>,
      fields: Fields | null,
      original?: Record<string, unknown>,
    ): { blobMethodCalls: JmapMethodCall[]; patchedPayload: Record<string, unknown> } => {
      if (!fields) return { blobMethodCalls: [], patchedPayload: payload };

      const blobMethodCalls: JmapMethodCall[] = [];
      const patchedPayload = { ...payload };
      let blobIndex = 0;

      for (const [fieldName, fieldDef] of Object.entries(fields.properties)) {
        if (fieldDef.type.type !== 'blobId') continue;
        const value = payload[fieldName];
        if (typeof value !== 'string' || !value) continue;

        if (original && original[fieldName] === value) continue;

        const tag = `temp-blob-${blobIndex}`;
        const accountId = getAccountId(resolved!.obj.objectName);
        blobMethodCalls.push([
          'Blob/upload',
          {
            accountId,
            create: {
              [tag]: {
                data: [{ 'data:asText': value }],
                type: 'application/octet-stream',
              },
            },
          },
          `blob-${blobIndex}`,
        ]);
        patchedPayload[fieldName] = `#${tag}`;
        blobIndex++;
      }

      return { blobMethodCalls, patchedPayload };
    },
    [resolved],
  );

  const applySetError = useCallback(
    (error: JmapSetError) => {
      setGeneralError(friendlySetError(error));

      const newFieldErrors: Record<string, string> = {};
      const errorMsg = error.description ?? t('form.invalidValue', 'Invalid value.');

      if (error.properties && error.properties.length > 0) {
        for (const prop of error.properties) {
          const topLevel = prop.split('/')[0];
          if (topLevel && currentFields?.properties[topLevel]) {
            newFieldErrors[topLevel] = errorMsg;
          }
        }
      }

      if (error.validationErrors && error.validationErrors.length > 0) {
        for (const ve of error.validationErrors) {
          if (ve.property && currentFields?.properties[ve.property]) {
            newFieldErrors[ve.property] = validationErrorMessage(ve);
          } else if (ve.property) {
            const detail = ve.value && ve.value.length > 0 ? ve.value : ve.type;
            setGeneralError((prev) => (prev ? `${prev}\n${ve.property}: ${detail}` : `${ve.property}: ${detail}`));
          }
        }
      }

      if (Object.keys(newFieldErrors).length > 0) {
        setFieldErrors(newFieldErrors);
      }
    },
    [currentFields, t],
  );

  const validateRequired = useCallback(
    (data: Record<string, unknown>, fields: Fields, visibleFields?: Set<string>): Record<string, string> => {
      const errors: Record<string, string> = {};

      for (const [fieldName, fieldDef] of Object.entries(fields.properties)) {
        if (visibleFields && !visibleFields.has(fieldName)) continue;
        if (fieldDef.update === 'serverSet') continue;
        if (!isCreate && fieldDef.update === 'immutable') continue;

        const fieldType = fieldDef.type;
        const requiredEligible =
          fieldType.type === 'string' ||
          fieldType.type === 'number' ||
          fieldType.type === 'utcDateTime' ||
          fieldType.type === 'enum' ||
          fieldType.type === 'blobId' ||
          fieldType.type === 'objectId';
        if (!requiredEligible) continue;
        if ('nullable' in fieldType && fieldType.nullable) continue;

        const value = data[fieldName];
        const isEmpty = value === undefined || value === null || (typeof value === 'string' && value === '');
        if (isEmpty) {
          errors[fieldName] = t('form.required', 'This field is required.');
        }
      }

      return errors;
    },
    [isCreate, t],
  );

  const handleSave = useCallback(async () => {
    if (!resolved) return;
    const { obj, sch } = resolved;

    setSaving(true);
    setGeneralError(null);
    setFieldErrors({});

    if (currentFields) {
      const visibleFields = new Set<string>();
      for (const section of parentForm?.sections ?? []) {
        for (const ff of section.fields) visibleFields.add(ff.name);
      }
      for (const section of currentForm?.sections ?? []) {
        for (const ff of section.fields) visibleFields.add(ff.name);
      }
      const validationErrors = validateRequired(
        formData,
        currentFields,
        visibleFields.size > 0 ? visibleFields : undefined,
      );
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        setGeneralError(t('form.correctErrorsBelow', 'Please correct the errors below.'));
        setSaving(false);
        return;
      }
    }

    if (!isOtpAuthValid(formData)) {
      setGeneralError(t('form.otpCodeRequired', 'Enter your current authenticator code to authorise this change.'));
      setSaving(false);
      return;
    }

    try {
      const accountId = getAccountId(obj.objectName);
      const section = viewToSection[viewName] ?? '';

      if (isCreate) {
        const createPayload: Record<string, unknown> = {};

        const staticFilters = resolved.list?.filtersStatic;
        if (staticFilters) {
          const validKeys = new Set<string>(['@type']);
          if (currentFields) {
            for (const k of Object.keys(currentFields.properties)) validKeys.add(k);
          }
          for (const [k, v] of Object.entries(staticFilters)) {
            if (validKeys.has(k)) createPayload[k] = v;
          }
        }

        if (sch.type === 'multiple' && selectedVariant) {
          createPayload['@type'] = selectedVariant;
        }

        if (currentFields) {
          for (const [fieldName, fieldDef] of Object.entries(currentFields.properties)) {
            if (fieldDef.update === 'serverSet') continue;
            if (fieldName in formData) {
              const isSecret =
                fieldDef.type.type === 'string' &&
                (fieldDef.type.format === 'secret' || fieldDef.type.format === 'secretText');
              if (isSecret && formData[fieldName] === SECRET_MASK) continue;
              createPayload[fieldName] = formData[fieldName];
            }
          }
        }

        const { blobMethodCalls, patchedPayload } = collectBlobUploads(createPayload, currentFields);

        let responses;
        if (blobMethodCalls.length > 0) {
          const setCall: JmapMethodCall = [
            `${obj.objectName}/set`,
            { accountId, create: { 'new-0': patchedPayload } },
            'set-0',
          ];
          responses = await jmapRequest([...blobMethodCalls, setCall]);
        } else {
          responses = await jmapSet(obj.objectName, accountId, {
            create: { 'new-0': patchedPayload },
          });
        }

        const setResponse = responses[responses.length - 1];
        const setResult = setResponse[1] as unknown as JmapSetResponse;

        if (setResult.created && setResult.created['new-0']) {
          const createdData = setResult.created['new-0'];
          const newId = createdData.id as string;

          const noisyKeys = new Set(['id', 'blobId']);
          const extraKeys = Object.keys(createdData).filter((k) => !noisyKeys.has(k));
          if (extraKeys.length > 0) {
            const extraProps: Record<string, unknown> = {};
            for (const key of extraKeys) {
              extraProps[key] = createdData[key];
            }
            setOriginalData({ ...formData });
            setCreatedObjectId(newId);
            setServerCreatedProps(extraProps);
          } else {
            toast({
              title: t('form.createdSuccess', 'Created successfully'),
              variant: 'success',
            });
            setOriginalData({ ...formData });
            navigate(`/${section}/${viewName}`);
          }
        } else if (setResult.notCreated && setResult.notCreated['new-0']) {
          applySetError(setResult.notCreated['new-0']);
        }
      } else {
        const rawPatch = calculateJmapPatch(originalData, formData);

        const patch: Record<string, unknown> = {};
        for (const [patchKey, patchValue] of Object.entries(rawPatch)) {
          const topLevelField = patchKey.split('/')[0];
          const fieldDef = currentFields?.properties[topLevelField];
          if (fieldDef && (fieldDef.update === 'immutable' || fieldDef.update === 'serverSet')) {
            continue;
          }
          if (
            fieldDef?.type.type === 'string' &&
            (fieldDef.type.format === 'secret' || fieldDef.type.format === 'secretText') &&
            patchValue === SECRET_MASK
          ) {
            continue;
          }
          patch[patchKey] = patchValue;
        }

        if (Object.keys(patch).length === 0) {
          toast({
            title: t('form.noChangesToSave', 'No changes to save'),
            variant: 'default',
          });
          return;
        }

        const blobMethodCalls: JmapMethodCall[] = [];
        let blobIndex = 0;
        const finalPatch = { ...patch };

        for (const [patchKey, patchValue] of Object.entries(patch)) {
          const topLevelField = patchKey.split('/')[0];
          const fieldDef = currentFields?.properties[topLevelField];
          if (fieldDef?.type.type !== 'blobId') continue;
          if (typeof patchValue !== 'string') continue;

          const tag = `temp-blob-${blobIndex}`;
          const accountId = getAccountId(obj.objectName);
          blobMethodCalls.push([
            'Blob/upload',
            {
              accountId,
              create: {
                [tag]: {
                  data: [{ 'data:asText': patchValue }],
                  type: 'application/octet-stream',
                },
              },
            },
            `blob-${blobIndex}`,
          ]);
          finalPatch[patchKey] = `#${tag}`;
          blobIndex++;
        }

        const updateId = isSingleton ? 'singleton' : objectId!;
        let responses;

        if (blobMethodCalls.length > 0) {
          const setCall: JmapMethodCall = [
            `${obj.objectName}/set`,
            { accountId, update: { [updateId]: finalPatch } },
            'set-0',
          ];
          responses = await jmapRequest([...blobMethodCalls, setCall]);
        } else {
          responses = await jmapSet(obj.objectName, accountId, {
            update: { [updateId]: finalPatch },
          });
        }

        const setResponse = responses[responses.length - 1];
        const setResult = setResponse[1] as unknown as JmapSetResponse;

        if (setResult.updated && updateId in setResult.updated) {
          toast({
            title: t('form.savedSuccess', 'Saved successfully'),
            variant: 'success',
          });

          if (isSingleton) {
            const getResponses = await jmapGet(obj.objectName, accountId, ['singleton'], fetchProperties);
            const getResult = getResponses[0]?.[1];
            const list = getResult?.list as Array<Record<string, unknown>> | undefined;
            if (list?.[0]) {
              setFormData({ ...list[0] });
              setOriginalData({ ...list[0] });
            }
          } else {
            setOriginalData({ ...formData });
            navigate(`/${section}/${viewName}`);
          }
        } else if (setResult.notUpdated && setResult.notUpdated[updateId]) {
          applySetError(setResult.notUpdated[updateId]);
        }
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('form.failedToSave', 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  }, [
    resolved,
    currentFields,
    currentForm,
    parentForm,
    isCreate,
    viewName,
    objectId,
    formData,
    originalData,
    selectedVariant,
    viewToSection,
    isSingleton,
    navigate,
    collectBlobUploads,
    applySetError,
    validateRequired,
    fetchProperties,
    t,
  ]);

  const handleDelete = useCallback(async () => {
    if (!resolved || !objectId) return;

    setSaving(true);
    setGeneralError(null);

    try {
      const { obj } = resolved;
      const accountId = getAccountId(obj.objectName);
      const responses = await jmapSet(obj.objectName, accountId, { destroy: [objectId] });
      const setResponse = responses[responses.length - 1];
      const setResult = setResponse[1] as unknown as JmapSetResponse;

      if (setResult.destroyed && setResult.destroyed.includes(objectId)) {
        const list = resolveList(schema!, viewName, obj.objectName);
        const label = list?.singularName ?? obj.objectType.description;
        toast({
          title: t('form.deletedSuccess', '{{name}} deleted successfully', {
            name: label.charAt(0).toUpperCase() + label.slice(1),
          }),
          variant: 'success',
        });
        setOriginalData({ ...formData });
        const section = viewToSection[viewName] ?? '';
        navigate(`/${section}/${viewName}`);
      } else if (setResult.notDestroyed && setResult.notDestroyed[objectId]) {
        const error = setResult.notDestroyed[objectId];
        setGeneralError(friendlySetError(error));
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : t('form.failedToDelete', 'Failed to delete.'));
    } finally {
      setSaving(false);
    }
  }, [resolved, viewName, objectId, viewToSection, navigate, schema, formData, t]);

  const canEdit = isCreate || canUpdateObject(viewName);
  const canDelete = !isCreate && !isSingleton && canDestroyObject(viewName);

  const titleForm = parentForm ?? currentForm;

  const formTitle = useMemo(() => {
    if (!resolved || !schema) return '';
    const { obj } = resolved;

    if (isSingleton) return titleForm?.title ?? obj.objectType.description;

    const list = resolveList(schema, viewName, obj.objectName);
    const name = list?.singularName ?? obj.objectType.description;

    if (isCreate) return t('form.createTitle', 'Create {{name}}', { name });

    const labelProp = list?.labelProperty;
    if (labelProp) {
      const value = coerceLabel(formData[labelProp], '');
      if (value.length > 0) {
        return t('form.editTitleWithValue', 'Edit {{name}}: {{value}}', { name, value });
      }
    }
    return t('form.editTitle', 'Edit {{name}}', { name });
  }, [resolved, schema, isCreate, isSingleton, formData, viewName, titleForm, t]);

  const formSubtitle = useMemo(() => {
    return titleForm?.subtitle;
  }, [titleForm]);

  if (!schema || !resolved) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        {t('form.loadingSchema', 'Loading schema...')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        {t('form.loadingData', 'Loading data...')}
      </div>
    );
  }

  const { sch } = resolved;
  const readOnly = !canEdit;

  const combinedForm: Form | null = (() => {
    if (sch.type !== 'multiple') return currentForm;
    const parentSections = parentForm?.sections ?? [];
    const variantSections = currentForm?.sections ?? [];
    if (parentSections.length === 0 && variantSections.length === 0) return null;
    return {
      title: parentForm?.title ?? currentForm?.title,
      subtitle: parentForm?.subtitle ?? currentForm?.subtitle,
      sections: [...parentSections, ...variantSections],
    };
  })();

  const sectionsToRender = buildSections(combinedForm, currentFields, isCreate, edition);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{formTitle}</h1>
          {formSubtitle && <p className="text-sm text-muted-foreground mt-1">{formSubtitle}</p>}
        </div>
      </div>

      {generalError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-sm text-destructive">{generalError}</p>
        </div>
      )}

      {sectionsToRender.map((section, sectionIdx) => (
        <Card key={sectionIdx}>
          {section.title && (
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={section.title ? '' : 'pt-6'}>
            <div className="space-y-6">
              {section.fields.map((sf) => {
                const { formField, field, visible, enterpriseDisabled } = sf;
                if (!visible) return null;

                if (formField.name === '@type' && sch.type === 'multiple') {
                  const selectedVariantLabel = sch.variants.find((v) => v.name === selectedVariant)?.label;
                  return (
                    <div key="@type" className="space-y-1.5">
                      <Label className="text-sm font-medium">{formField.label}</Label>
                      <Select value={selectedVariant} onValueChange={handleVariantChange} disabled={readOnly}>
                        <SelectTrigger>
                          <div className="flex flex-1 items-center gap-2 overflow-hidden">
                            <BackendVariantIcon variant={{ name: selectedVariant, label: selectedVariantLabel ?? selectedVariant }} />
                            <span className="truncate">
                              {selectedVariantLabel || t('form.selectType', 'Select type...')}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {sch.variants.map((v) => (
                            <SelectItem key={v.name} value={v.name}>
                              <span className="flex items-center gap-2">
                                <BackendVariantIcon variant={v} />
                                {v.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                const fieldValue = formData[formField.name];
                const fieldError = fieldErrors[formField.name];
                const fieldReadOnly =
                  readOnly ||
                  (field.update === 'immutable' && !isCreate) ||
                  field.update === 'serverSet' ||
                  enterpriseDisabled;

                const widget = (
                  <FieldWidget
                    key={formField.name}
                    field={field}
                    formField={formField}
                    value={fieldValue}
                    onChange={(v) => handleFieldChange(formField.name, v)}
                    readOnly={fieldReadOnly}
                    error={fieldError}
                    schema={schema}
                  />
                );

                if (enterpriseDisabled) {
                  return (
                    <TooltipProvider key={formField.name}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="opacity-60">{widget}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('enterprise.featureDisabled', 'This feature requires an Enterprise license.')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }

                return widget;
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between pt-2 pb-8">
        <div>
          {canDelete && (
            <Button type="button" variant="destructive" disabled={saving} onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('common.delete', 'Delete')}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs text-muted-foreground">{t('form.unsavedChangesLabel', 'Unsaved changes')}</span>
          )}
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {!readOnly && (
            <Button type="button" onClick={handleSave} disabled={saving || (!isCreate && !isDirty)}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isCreate ? t('common.create', 'Create') : t('common.save', 'Save')}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('form.unsavedChangesTitle', 'Unsaved changes')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('form.unsavedChanges', 'You have unsaved changes. Are you sure you want to leave?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('form.stay', 'Stay')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOriginalData({ ...formData });
                blocker.proceed?.();
              }}
            >
              {t('form.leave', 'Leave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {(() => {
              const list = resolved ? resolveList(schema, viewName, resolved.obj.objectName) : null;
              const label = (
                list?.singularName ??
                resolved?.obj.objectType.description ??
                t('form.item', 'item')
              ).toLowerCase();
              const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
              return (
                <>
                  <AlertDialogTitle>{t('form.deleteTitle', 'Delete {{name}}?', { name: titleLabel })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'form.deleteDescription',
                      'This action cannot be undone. This will permanently delete this {{name}}.',
                      { name: label },
                    )}
                  </AlertDialogDescription>
                </>
              );
            })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteConfirmOpen(false);
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={serverCreatedProps !== null && createdObjectId !== null}
        onOpenChange={(open) => {
          if (!open) {
            navigateAfterCreate();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('form.createdSuccess', 'Created successfully')}</DialogTitle>
            <DialogDescription>
              {t(
                'form.createdServerGenerated',
                'The following values were generated by the server. Please save them now, they may not be retrievable later.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {serverCreatedProps &&
              (() => {
                const labelByName = new Map<string, string>();
                for (const section of parentForm?.sections ?? []) {
                  for (const ff of section.fields) labelByName.set(ff.name, ff.label);
                }
                for (const section of currentForm?.sections ?? []) {
                  for (const ff of section.fields) labelByName.set(ff.name, ff.label);
                }
                return Object.entries(serverCreatedProps).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{labelByName.get(key) ?? key}</span>
                    <code className="rounded bg-muted p-2 text-sm break-all select-all">{String(value)}</code>
                  </div>
                ));
              })()}
          </div>
          <DialogFooter>
            <Button onClick={navigateAfterCreate}>{t('common.continue', 'Continue')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RenderableField {
  formField: FormField;
  field: Field;
  visible: boolean;
  enterpriseDisabled: boolean;
}

interface RenderableSection {
  title?: string;
  fields: RenderableField[];
}

function buildSections(
  form: Form | null,
  fields: Fields | null,
  isCreate: boolean,
  edition: string,
): RenderableSection[] {
  if (!form && !fields) return [];

  if (!form) {
    const allFields = Object.entries(fields!.properties)
      .map(([name, field]) => buildRenderableField({ name, label: name }, field, isCreate, edition))
      .filter((f): f is RenderableField => f !== null);
    return [{ fields: allFields }];
  }

  return form.sections
    .map((section) => {
      const renderedFields = section.fields
        .map((ff) => {
          if (ff.name === '@type') {
            const syntheticField: Field = {
              description: '',
              type: { type: 'string', format: 'string' },
              update: 'mutable',
            };
            return {
              formField: ff,
              field: syntheticField,
              visible: true,
              enterpriseDisabled: false,
            };
          }
          const field = fields?.properties[ff.name];
          if (!field) return null;
          return buildRenderableField(ff, field, isCreate, edition);
        })
        .filter((f): f is RenderableField => f !== null);

      return {
        title: section.title,
        fields: renderedFields,
      };
    })
    .filter((section) => section.fields.some((f) => f.visible));
}

function fieldReferencesInaccessibleObject(
  field: Field,
  schema: Schema,
  canGet: (permissionPrefix: string) => boolean,
): boolean {
  const isObjectAccessible = (objectName: string): boolean => {
    const resolved = resolveObject(schema, objectName);
    if (!resolved) return true;
    return canGet(resolved.permissionPrefix);
  };

  const t = field.type;
  switch (t.type) {
    case 'objectId':
      return !isObjectAccessible(t.objectName);
    case 'object':
    case 'objectList':
      return !isObjectAccessible(t.objectName);
    case 'set':
      if (t.class.type === 'objectId') return !isObjectAccessible(t.class.objectName);
      return false;
    case 'map':
      if (t.keyClass.type === 'objectId' && !isObjectAccessible(t.keyClass.objectName)) return true;
      if (t.valueClass.type === 'object' && !isObjectAccessible(t.valueClass.objectName)) return true;
      return false;
    default:
      return false;
  }
}

function buildRenderableField(
  formField: FormField,
  field: Field,
  isCreate: boolean,
  edition: string,
): RenderableField | null {
  let visible = true;
  let enterpriseDisabled = false;

  if (isCreate && field.update === 'serverSet') {
    visible = false;
  }

  if (field.enterprise) {
    if (edition === 'oss') {
      visible = false;
    } else if (edition === 'community') {
      enterpriseDisabled = true;
    }
  }

  return { formField, field, visible, enterpriseDisabled };
}

function isOtpAuthValid(data: unknown): boolean {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return true;
  const obj = data as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!isOtpAuthValid(obj[key])) return false;
  }

  const hasOtpUrl = 'otpUrl' in obj;
  const hasOtpCode = 'otpCode' in obj;
  if (!hasOtpUrl || !hasOtpCode) return true;

  const otpUrl = obj.otpUrl;
  const otpCode = obj.otpCode;
  if (otpUrl == null || otpUrl === '') return true;
  if (otpCode == null || otpCode === '' || otpCode === SECRET_MASK) {
    return false;
  }
  return true;
}

export default DynamicForm;
