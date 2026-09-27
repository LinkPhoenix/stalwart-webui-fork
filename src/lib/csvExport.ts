/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { isValidElement, Children } from 'react';

/**
 * Quote every field for consistent CSV output and double embedded quotes.
 * Prefix spreadsheet formula starters with an apostrophe before quoting so
 * exported values are treated as text by common spreadsheet applications.
 */
export function escapeCsvField(value: string): string {
  const spreadsheetSafeValue = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafeValue.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  // CRLF is the RFC 4180 line ending and what makes Excel behave.
  return lines.join('\r\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  // Leading BOM so Excel opens UTF-8 content (accented names, etc.) correctly.
  const blob = new Blob(['﻿', csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Flattens a rendered cell (built from plain elements like Badge/span/icons —
 * see renderCellValue) down to its text content, for exporting the same
 * values the table shows without duplicating that formatting logic here.
 */
export function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return Children.toArray(props.children).map(reactNodeToText).join('');
  }
  return '';
}
