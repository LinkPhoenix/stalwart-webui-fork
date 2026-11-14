/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { sieve as sieveStreamParser } from '@codemirror/legacy-modes/mode/sieve';
import {
  StreamLanguage,
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
  foldService,
  type StreamParser,
} from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

// RFC 5228 only reserves five real keywords (if/elsif/else/stop/require); every
// action/test/comparator name (fileinto, header, vacation, ...) is grammatically
// just an identifier, resolved at runtime via the extensions a script `require`s.
// The upstream CodeMirror 5 "sieve" mode (ported to CM6 unchanged via
// @codemirror/legacy-modes) only highlights those five keywords, so it reads
// scripts as mostly plain text. We keep that tokenizer as-is and layer a
// reclassification pass on top: any identifier-shaped token that matches one of
// the well-known action/test names (RFC 5228 core + the extensions this server
// advertises via urn:ietf:params:jmap:sieve's sieveExtensions) gets tagged
// "builtin" instead of staying untagged, purely for readability — it does not
// change what the script means.
const SIEVE_BUILTIN_COMMANDS = new Set([
  // RFC 5228 core actions
  'keep',
  'fileinto',
  'redirect',
  'discard',
  'stop',
  'reject',
  // RFC 5228 core tests
  'address',
  'allof',
  'anyof',
  'exists',
  'header',
  'not',
  'size',
  // Common extensions (imap4flags, vacation, envelope, editheader, variables, ...)
  'vacation',
  'setflag',
  'addflag',
  'removeflag',
  'hasflag',
  'imap4flags',
  'ereject',
  'envelope',
  'body',
  'date',
  'currentdate',
  'spamtest',
  'spamtestplus',
  'virustest',
  'convert',
  'copy',
  'editheader',
  'deleteheader',
  'addheader',
  'include',
  'global',
  'return',
  'set',
  'mailboxexists',
  'metadata',
  'servermetadata',
  'notify',
  'enclose',
  'extracttext',
  'foreverypart',
  'break',
  'duplicate',
  'variables',
  'mailbox',
  'mailboxid',
  'ihave',
  'regex',
  // Common comparators/match-type and address-part keywords used as bare words
  'comparator',
  'count',
  'value',
  'all',
  'localpart',
  'domain',
  'user',
  'detail',
]);

// Wraps the ported tokenizer so recognized command words are tagged "builtin"
// instead of left untagged. Only reclassifies tokens the base tokenizer already
// returned as a plain identifier (null) — string/comment/keyword/number/operator
// tokens are always multi-character spans returned as a single non-null token by
// the base tokenizer, so this never reaches into the middle of a string or
// comment.
const baseToken = sieveStreamParser.token;
const sieveWithBuiltins: StreamParser<unknown> = {
  ...sieveStreamParser,
  token(stream, state) {
    const type = baseToken(stream, state);
    if (type === null && SIEVE_BUILTIN_COMMANDS.has(stream.current())) {
      return 'builtin';
    }
    return type;
  },
};

export const sieveLanguage = StreamLanguage.define(sieveWithBuiltins);

// Colors reuse the app's existing chart palette tokens (already tuned per
// light/dark and every color theme) instead of hardcoding new colors.
export const sieveHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'hsl(var(--chart-1))', fontWeight: 600 },
  { tag: tags.standard(tags.variableName), color: 'hsl(var(--chart-1))' },
  { tag: tags.atom, color: 'hsl(var(--chart-4))' },
  { tag: tags.string, color: 'hsl(var(--chart-2))' },
  { tag: tags.number, color: 'hsl(var(--chart-3))' },
  { tag: tags.operator, color: 'hsl(var(--chart-5))' },
  { tag: tags.comment, color: 'var(--muted-foreground)', fontStyle: 'italic' },
]);

function isCommentOrString(state: EditorState, pos: number): boolean {
  const name = syntaxTree(state).resolve(pos, 1).name;
  return name === 'comment' || name === 'string';
}

// Sieve's only block delimiter is `{ }` (used for if/elsif/else bodies and
// nothing else), so folding just needs brace matching — there's no nested
// grammar to lean on since StreamLanguage doesn't build a real parse tree.
// Depth-counts brace characters, skipping any that fall inside a string or
// comment token per the tokenizer's own classification.
export const sieveBraceFold = foldService.of((state, lineStart, lineEnd) => {
  const openIdx = state.doc.sliceString(lineStart, lineEnd).indexOf('{');
  if (openIdx === -1) return null;
  const openPos = lineStart + openIdx;
  if (isCommentOrString(state, openPos)) return null;

  let depth = 0;
  for (let pos = openPos; pos < state.doc.length; pos++) {
    const ch = state.doc.sliceString(pos, pos + 1);
    if (ch !== '{' && ch !== '}') continue;
    if (isCommentOrString(state, pos)) continue;
    depth += ch === '{' ? 1 : -1;
    if (depth === 0) {
      return pos > openPos + 1 ? { from: openPos + 1, to: pos } : null;
    }
  }
  return null;
});

// Matches the shadcn Textarea look (border, radius, focus ring) so the editor
// blends in next to plain fields, and tracks the app's CSS variables so it
// follows light/dark mode and every color theme automatically.
export const sieveEditorTheme = EditorView.theme({
  '&': {
    fontSize: '0.75rem',
    color: 'var(--foreground)',
    backgroundColor: 'var(--field)',
    border: '1px solid var(--input)',
    borderRadius: 'var(--radius)',
    // Without this, the gutter's own square background rectangle pokes out
    // past the rounded corner instead of being clipped to it.
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: 'none',
    boxShadow: '0 0 0 1px var(--ring)',
  },
  '.cm-content, .cm-gutters': {
    fontFamily: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--foreground)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--field)',
    color: 'var(--muted-foreground)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--muted)',
    borderColor: 'var(--border)',
    color: 'var(--muted-foreground)',
    borderRadius: '0.25rem',
    padding: '0 4px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});

export function sieveExtensions() {
  return [sieveLanguage, syntaxHighlighting(sieveHighlightStyle), sieveBraceFold, sieveEditorTheme];
}
