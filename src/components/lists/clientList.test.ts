import { describe, expect, it } from 'vitest';
import type { List } from '@/types/schema';
import { PROBLEMS_ONLY_KEY, planClientMode, processClientRows, sortMailboxesByHierarchy } from './clientList';
import type { ListUrlState } from './listUrlState';

const state = (partial: Partial<ListUrlState> = {}): ListUrlState => ({
  filters: {},
  sort: null,
  anchors: [],
  ...partial,
});

const list: Pick<List, 'filters' | 'columns' | 'sort'> = {
  columns: [
    { name: 'name', label: 'Name' },
    { name: 'aliasCount', label: 'Aliases', clientSortable: true } as never,
    { name: 'dmarcRejectCount', label: 'Reject' },
  ],
  sort: ['name'],
  filters: [
    { type: 'enum', field: 'level', enumName: 'TracingLevel', label: 'Level', clientOnly: true } as never,
    { type: 'text', field: 'name', label: 'Name' } as never,
  ],
};

describe('planClientMode', () => {
  it('stays server-side by default and for server-sortable columns', () => {
    expect(planClientMode(list, 'x:Account', state()).client).toBe(false);
    expect(planClientMode(list, 'x:Account', state({ sort: { field: 'name', ascending: true } })).client).toBe(false);
  });

  it('switches to client mode for client sort, client-only filters, problems-only and mailboxes', () => {
    expect(planClientMode(list, 'x:Account', state({ sort: { field: 'aliasCount', ascending: true } })).client).toBe(true);
    expect(planClientMode(list, 'x:Log', state({ filters: { level: 'error' } })).client).toBe(true);
    expect(planClientMode(list, 'x:Log', state({ filters: { name: 'a' } })).client).toBe(false);
    expect(planClientMode(list, 'x:DmarcExternalReport', state({ filters: { [PROBLEMS_ONLY_KEY]: '1' } })).client).toBe(
      true,
    );
    expect(planClientMode(list, 'Mailbox', state()).client).toBe(true);
  });
});

describe('processClientRows', () => {
  it('applies client filters and sorts by synthetic count columns', () => {
    const rows = [
      { id: 'a', level: 'info', aliases: { x: true } },
      { id: 'b', level: 'error', aliases: { x: true, y: true } },
      { id: 'c', level: 'error', aliases: {} },
    ];
    const plan = planClientMode(
      list,
      'x:Log',
      state({ filters: { level: 'error' }, sort: { field: 'aliasCount', ascending: false } }),
    );
    expect(processClientRows(rows, plan, 'x:Log').items.map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('sortMailboxesByHierarchy', () => {
  it('places children under their parent and records depth', () => {
    const rows = [
      { id: '3', name: 'Sub', parentId: '1' },
      { id: '2', name: 'Archive', parentId: null },
      { id: '1', name: 'Inbox', parentId: null },
      { id: '4', name: 'Orphan', parentId: 'missing' },
    ];
    const { items, depths } = sortMailboxesByHierarchy(rows);
    expect(items.map((r) => r.id)).toEqual(['2', '1', '3', '4']);
    expect(depths.get('3')).toBe(1);
    expect(depths.get('4')).toBe(0);
  });
});
