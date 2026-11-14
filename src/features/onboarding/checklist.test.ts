import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isOnboardingComplete, ONBOARDING_ITEMS } from './checklist';
import type { JmapQueryResponse } from '@/types/jmap';

const queryResponse = (total: number): JmapQueryResponse =>
  ({ total, ids: total > 0 ? ['x'] : [], accountId: 'test', queryState: 's', canCalculateChanges: false, position: 0 }) as JmapQueryResponse;

vi.mock('@/services/jmap/client', () => ({
  jmapQuery: vi.fn(async () => ({ total: 0, ids: [] as string[] })),
  jmapQueryAllAndGet: vi.fn(async () => ({ ids: [] as string[], list: [] as Record<string, unknown>[] })),
}));

const { jmapQuery, jmapQueryAllAndGet } = await import('@/services/jmap/client');
const queryMock = vi.mocked(jmapQuery);
const queryAllMock = vi.mocked(jmapQueryAllAndGet);

function mockAllChecksPass() {
  queryAllMock.mockImplementation(async (objectType: string) => {
    switch (objectType) {
      case 'x:Domain':
        return { ids: ['d1'], list: [{ isEnabled: true }] };
      case 'x:DkimSignature':
        return { ids: ['k1'], list: [] };
      case 'x:Certificate':
        return { ids: ['c1'], list: [{ notValidAfter: '2999-01-01T00:00:00Z' }] };
      case 'x:Account':
        return { ids: ['a1'], list: [{ roles: { '@type': 'Admin' } }] };
      default:
        return { ids: [], list: [] };
    }
  });
  queryMock.mockResolvedValue(queryResponse(1));
}

beforeEach(() => {
  vi.clearAllMocks();
  queryAllMock.mockImplementation(async () => ({ ids: [], list: [] }));
  queryMock.mockResolvedValue(queryResponse(0));
});

describe('isOnboardingComplete', () => {
  it('returns true when no required item is queryable', async () => {
    await expect(isOnboardingComplete(() => false)).resolves.toBe(true);
  });

  it('returns false while a required check fails', async () => {
    await expect(isOnboardingComplete(() => true)).resolves.toBe(false);
  });

  it('returns true when every required check passes', async () => {
    mockAllChecksPass();
    await expect(isOnboardingComplete(() => true)).resolves.toBe(true);
  });

  it('treats a throwing check as not done', async () => {
    queryAllMock.mockRejectedValue(new Error('network down'));
    await expect(isOnboardingComplete(() => true)).resolves.toBe(false);
  });

  it('only checks items the user can query', async () => {
    mockAllChecksPass();
    const queried: string[] = [];
    const result = await isOnboardingComplete((prefix) => {
      queried.push(prefix);
      return false;
    });
    expect(result).toBe(true);
    expect(queried.length).toBe(ONBOARDING_ITEMS.filter((i) => i.requiredForCompletion !== false).length);
  });
});
