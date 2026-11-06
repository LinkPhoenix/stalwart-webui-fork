/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldRow } from '@/components/forms/FieldRow';
import { FormSectionCard } from '@/components/forms/FormSections';
import { FormProvider } from '@/components/forms/FormProvider';
import { resolveVariantForm } from '@/lib/schemaResolver';
import type { ObjectVariant, Schema } from '@/types/schema';
import { editableSections, missingRequiredFields } from '../actionModel';

interface ActionFormProps {
  schema: Schema;
  variant: ObjectVariant & { schemaName: string };
  initialData: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onBack: () => void;
}

export function ActionForm({ schema, variant, initialData, onSubmit, onBack }: ActionFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = schema.fields[variant.schemaName];
  const form = resolveVariantForm(schema, '', '', variant.schemaName);
  if (!fields || !form) return null;
  const sections = editableSections(form.sections, fields);

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = () => {
    const missing = missingRequiredFields(sections, fields, formData);
    if (missing.length > 0) {
      const required = t('form.required', 'This field is required.');
      setErrors(Object.fromEntries(missing.map((name) => [name, required])));
      return;
    }
    onSubmit(formData);
  };

  return (
    <form
      className="mx-auto max-w-5xl space-y-3.5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex items-start gap-3.5 px-1 pb-1 pt-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="shrink-0"
          onClick={onBack}
          aria-label={t('common.back', 'Back')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h1 className="page-title min-w-0 flex-1 break-words pt-1">{variant.label}</h1>
      </div>

      <FormProvider schema={schema} mode="create">
        {sections.map((section) => (
          <FormSectionCard key={section.fields.map((f) => f.name).join('|')} title={section.title}>
            {section.fields.map((ff) => {
              const def = fields.properties[ff.name];
              if (!def) return null;
              return (
                <FieldRow
                  key={ff.name}
                  formField={ff}
                  field={def}
                  value={formData[ff.name]}
                  onChange={(v) => handleChange(ff.name, v)}
                  error={errors[ff.name]}
                />
              );
            })}
          </FormSectionCard>
        ))}
      </FormProvider>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button type="submit">
          <Zap aria-hidden="true" />
          {t('actions.execute', 'Execute')}
        </Button>
      </div>
    </form>
  );
}
