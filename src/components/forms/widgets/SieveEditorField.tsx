import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Code-split: CodeMirror and its Sieve tokenizer are only needed on the few
// fields that hold Sieve script source, not on every other page.
const LazySieveEditor = lazy(() => import('@/components/forms/SieveEditor'));

interface SieveEditorFieldProps {
  value: string;
  onCommit: (value: string) => void;
  readOnly?: boolean;
}

/** Syntax-highlighted, foldable editor for Sieve script fields (fork). */
export function SieveEditorField({ value, onCommit, readOnly }: SieveEditorFieldProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center rounded-xl bg-field text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </div>
      }
    >
      <LazySieveEditor value={value} onCommit={onCommit} readOnly={readOnly} />
    </Suspense>
  );
}
