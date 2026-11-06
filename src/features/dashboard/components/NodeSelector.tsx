/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Server } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClusterNodeInfo } from '../types/metrics';

const ALL_NODES = 'all';

interface NodeSelectorProps {
  nodes: ClusterNodeInfo[];
  value: number | null;
  onChange: (nodeId: number | null) => void;
}

export function NodeSelector({ nodes, value, onChange }: NodeSelectorProps) {
  const { t } = useTranslation();

  const handleChange = (raw: string) => {
    if (raw === ALL_NODES) {
      onChange(null);
      return;
    }
    const nodeId = Number(raw);
    if (Number.isInteger(nodeId)) onChange(nodeId);
  };

  return (
    <Select value={value === null ? ALL_NODES : String(value)} onValueChange={handleChange}>
      <SelectTrigger variant="pill" aria-label={t('dashboard.node', 'Node')}>
        <Server aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_NODES}>{t('dashboard.allNodes', 'All nodes')}</SelectItem>
        {nodes.map((node) => (
          <SelectItem key={node.nodeId} value={String(node.nodeId)}>
            {node.hostname
              ? t('dashboard.nodeWithHost', '{{hostname}} ({{id}})', { hostname: node.hostname, id: node.nodeId })
              : t('dashboard.nodeNumber', 'Node {{id}}', { id: node.nodeId })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
