import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import en from './en.json';

// Garde-fou i18n : chaque clé utilisée dans src/ doit exister dans en.json,
// et aucune clé de en.json ne doit être morte (son nom absent de tout le code).
// Les clés passées via des tableaux (labelKey: ['key', 'fallback']) ou des
// templates dynamiques comptent comme utilisées si le littéral apparaît dans le code.

const srcDir = path.resolve(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' ? flatten(v as Record<string, unknown>, key) : [key];
  });
}

const defined = flatten(en as Record<string, unknown>);
const definedSet = new Set(defined);

let code = '';
for (const f of walk(srcDir)) {
  if (f.endsWith('i18nKeys.test.ts')) continue;
  code += readFileSync(f, 'utf8') + '\n';
}

// Clés appelées directement : t('cle', ...) / i18n.t('cle', ...)
// On ne garde que les littéraux au format de clé i18n (namespace.cle), pour
// exclure les fallbacks anglais et les appels de helpers locaux nommés t.
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/;
const called = new Set<string>();
for (const m of code.matchAll(/(?:i18n\.)?t\(\s*'([^']+)'/g)) {
  if (KEY_RE.test(m[1])) called.add(m[1]);
}
for (const m of code.matchAll(/(?:i18n\.)?t\(\s*"([^"]+)"/g)) {
  if (KEY_RE.test(m[1])) called.add(m[1]);
}

describe('i18n en.json', () => {
  it('contient toutes les clés appelées directement dans le code', () => {
    const missing = [...called].filter((k) => !definedSet.has(k) && !definedSet.has(`${k}_one`));
    expect(missing).toEqual([]);
  });

  it('ne contient aucune clé morte (absente de tout le code source)', () => {
    const dead = defined.filter((key) => {
      if (code.includes(key)) return false;
      const base = key.replace(/_(one|other)$/, '');
      return base === key || !code.includes(base);
    });
    expect(dead).toEqual([]);
  });
});
