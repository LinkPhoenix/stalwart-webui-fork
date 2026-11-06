/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import ReactMarkdown from 'react-markdown';

export default function MarkdownRenderer({ source }: { source: string }) {
  return <ReactMarkdown>{source}</ReactMarkdown>;
}
