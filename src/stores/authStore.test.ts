/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useCacheStore } from './cacheStore';

const initialState = {
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  tokenEndpoint: null,
  accounts: {},
  primaryAccountId: null,
  activeAccountId: null,
  apiUrl: null,
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState(initialState);
    useCacheStore.setState({ displayNames: {}, objectLists: {} });
    vi.restoreAllMocks();
  });

  describe('setTokens', () => {
    it('stores access and refresh tokens', () => {
      useAuthStore.getState().setTokens('acc-123', 'ref-456', 3600, 'https://auth/token');

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('acc-123');
      expect(state.refreshToken).toBe('ref-456');
    });

    it('computes expiration time from expiresIn', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      useAuthStore.getState().setTokens('a', 'r', 3600, 'https://auth/token');

      expect(useAuthStore.getState().tokenExpiresAt).toBe(now + 3600 * 1000);
    });

    it('stores token endpoint', () => {
      useAuthStore.getState().setTokens('a', 'r', 3600, 'https://example.com/token');

      expect(useAuthStore.getState().tokenEndpoint).toBe('https://example.com/token');
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token is set', () => {
      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    it('returns true when token exists and is not expired', () => {
      const now = Date.now();
      useAuthStore.setState({
        accessToken: 'tok',
        tokenExpiresAt: now + 60_000,
      });

      expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    });

    it('returns false when token is expired', () => {
      useAuthStore.setState({
        accessToken: 'tok',
        tokenExpiresAt: Date.now() - 1000,
      });

      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });

    it('returns false when accessToken is null even if expiry is in the future', () => {
      useAuthStore.setState({
        accessToken: null,
        tokenExpiresAt: Date.now() + 60_000,
      });

      expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('returns false when tokenExpiresAt is null', () => {
      expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(false);
    });

    it('returns true within 60 seconds of expiration', () => {
      useAuthStore.setState({ tokenExpiresAt: Date.now() + 30_000 });
      expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(true);
    });

    it('returns false when more than 60 seconds remain', () => {
      useAuthStore.setState({ tokenExpiresAt: Date.now() + 120_000 });
      expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(false);
    });

    it('returns true when token is already expired', () => {
      useAuthStore.setState({ tokenExpiresAt: Date.now() - 5000 });
      expect(useAuthStore.getState().isTokenExpiringSoon()).toBe(true);
    });
  });

  describe('setSession', () => {
    it('stores accounts and primaryAccountId', () => {
      const accounts = {
        'acc-1': { name: 'Personal', isPersonal: true },
        'acc-2': { name: 'Work', isPersonal: false },
      };

      useAuthStore.getState().setSession(accounts, 'acc-1', 'https://api');

      const state = useAuthStore.getState();
      expect(state.accounts).toEqual(accounts);
      expect(state.primaryAccountId).toBe('acc-1');
      expect(state.apiUrl).toBe('https://api');
    });

    it('sets activeAccountId to primaryAccountId', () => {
      useAuthStore.getState().setSession({ 'acc-1': { name: 'A', isPersonal: true } }, 'acc-1', 'https://api');

      expect(useAuthStore.getState().activeAccountId).toBe('acc-1');
    });

    it('preserves the previously active account across a reload if still valid', () => {
      useAuthStore.setState({ activeAccountId: 'acc-2' });
      const accounts = {
        'acc-1': { name: 'Personal', isPersonal: true },
        'acc-2': { name: 'Shared', isPersonal: false },
      };

      useAuthStore.getState().setSession(accounts, 'acc-1', 'https://api');

      expect(useAuthStore.getState().activeAccountId).toBe('acc-2');
    });

    it('falls back to primaryAccountId if the previously active account is gone', () => {
      useAuthStore.setState({ activeAccountId: 'acc-removed' });

      useAuthStore.getState().setSession({ 'acc-1': { name: 'A', isPersonal: true } }, 'acc-1', 'https://api');

      expect(useAuthStore.getState().activeAccountId).toBe('acc-1');
    });
  });

  describe('switchAccount', () => {
    it('changes activeAccountId when account exists', () => {
      useAuthStore.setState({
        accounts: {
          a1: { name: 'A1', isPersonal: true },
          a2: { name: 'A2', isPersonal: false },
        },
        activeAccountId: 'a1',
      });

      useAuthStore.getState().switchAccount('a2');
      expect(useAuthStore.getState().activeAccountId).toBe('a2');
    });

    it('does nothing for unknown account id', () => {
      useAuthStore.setState({
        accounts: { a1: { name: 'A1', isPersonal: true } },
        activeAccountId: 'a1',
      });

      useAuthStore.getState().switchAccount('nonexistent');
      expect(useAuthStore.getState().activeAccountId).toBe('a1');
    });

    it('clears the cache store when switching to a different account', () => {
      useAuthStore.setState({
        accounts: {
          a1: { name: 'A1', isPersonal: true },
          a2: { name: 'A2', isPersonal: false },
        },
        activeAccountId: 'a1',
      });
      useCacheStore.getState().setDisplayNames('x:Domain', { d1: 'example.org' });

      useAuthStore.getState().switchAccount('a2');

      expect(useCacheStore.getState().displayNames).toEqual({});
    });

    it('does not clear the cache store when "switching" to the already-active account', () => {
      useAuthStore.setState({
        accounts: { a1: { name: 'A1', isPersonal: true } },
        activeAccountId: 'a1',
      });
      useCacheStore.getState().setDisplayNames('x:Domain', { d1: 'example.org' });

      useAuthStore.getState().switchAccount('a1');

      expect(useCacheStore.getState().displayNames).toEqual({ 'x:Domain': { d1: 'example.org' } });
    });
  });

  describe('logout', () => {
    it('clears all state', () => {
      useAuthStore.setState({
        accessToken: 'tok',
        refreshToken: 'ref',
        tokenExpiresAt: 99999,
        tokenEndpoint: 'https://auth/token',
        accounts: { a: { name: 'A', isPersonal: true } },
        primaryAccountId: 'a',
        activeAccountId: 'a',
        apiUrl: 'https://api',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.tokenExpiresAt).toBeNull();
      expect(state.tokenEndpoint).toBeNull();
      expect(state.accounts).toEqual({});
      expect(state.primaryAccountId).toBeNull();
      expect(state.activeAccountId).toBeNull();
      expect(state.apiUrl).toBeNull();
    });
  });
});
