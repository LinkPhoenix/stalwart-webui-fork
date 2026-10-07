import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { jmapGetBatched, jmapQueryAllAndGet } from './client';

vi.mock('@/services/api', () => ({ apiFetch: vi.fn() }));

function reply(method: string, result: Record<string, unknown>) {
  return new Response(JSON.stringify({ methodResponses: [[method, result, '0']] }));
}

describe('JMAP ordered results', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ apiUrl: '/jmap', maxObjectsInGet: 2 });
  });

  it('preserves requested order across reversed get batches and missing objects', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(reply('x:Fixture/get', { list: [{ id: 'b' }, { id: 'a' }] }))
      .mockResolvedValueOnce(reply('x:Fixture/get', { list: [{ id: 'd' }], notFound: ['missing'] }));

    expect(await jmapGetBatched('x:Fixture', 'test', ['a', 'b', 'missing', 'd'])).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'd' },
    ]);
  });

  it('advances using query cursors and retains query order after batched retrieval', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(reply('x:Fixture/query', { ids: ['a', 'b'], limit: 2 }))
      .mockResolvedValueOnce(reply('x:Fixture/query', { ids: ['c', 'd'], limit: 2 }))
      .mockResolvedValueOnce(reply('x:Fixture/query', { ids: [], limit: 2 }))
      .mockResolvedValueOnce(reply('x:Fixture/get', { list: [{ id: 'b' }, { id: 'a' }] }))
      .mockResolvedValueOnce(reply('x:Fixture/get', { list: [{ id: 'd' }, { id: 'c' }] }));

    const result = await jmapQueryAllAndGet('x:Fixture', 'test', { position: 0, limit: 2 });
    expect(result.ids).toEqual(['a', 'b', 'c', 'd']);
    expect(result.list.map((item) => item.id)).toEqual(result.ids);
    for (const [index, anchor] of [
      [1, 'b'],
      [2, 'd'],
    ] as const) {
      const options = vi.mocked(apiFetch).mock.calls[index][1]!;
      const args = JSON.parse(options.body as string).methodCalls[0][1];
      expect(args).toMatchObject({ anchor, anchorOffset: 1 });
      expect(args).not.toHaveProperty('position');
    }
  });
});
