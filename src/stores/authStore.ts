/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCacheStore } from '@/stores/cacheStore';

interface AccountInfo {
  name: string;
  isPersonal: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  tokenEndpoint: string | null;
  endSessionEndpoint: string | null;
  accounts: Record<string, AccountInfo>;
  primaryAccountId: string | null;
  activeAccountId: string | null;
  apiUrl: string | null;
  maxObjectsInGet: number;
  maxObjectsInSet: number;

  setTokens: (
    access: string,
    refresh: string,
    expiresIn: number,
    tokenEndpoint: string,
    endSessionEndpoint?: string | null,
  ) => void;
  setSession: (
    accounts: Record<string, AccountInfo>,
    primaryAccountId: string,
    apiUrl: string,
    maxObjectsInGet?: number,
    maxObjectsInSet?: number,
  ) => void;
  switchAccount: (accountId: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isTokenExpiringSoon: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      tokenEndpoint: null,
      endSessionEndpoint: null,
      accounts: {},
      primaryAccountId: null,
      activeAccountId: null,
      apiUrl: null,
      maxObjectsInGet: 500,
      maxObjectsInSet: 500,

      setTokens: (access, refresh, expiresIn, tokenEndpoint, endSessionEndpoint) => {
        set({
          accessToken: access,
          refreshToken: refresh,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
          tokenEndpoint,
          endSessionEndpoint: endSessionEndpoint ?? null,
        });
      },

      setSession: (accounts, primaryAccountId, apiUrl, maxObjectsInGet, maxObjectsInSet) => {
        // Preserve the previously active account across a page reload (the
        // session is refetched from scratch on every load) instead of
        // always resetting to the primary account, as long as it's still
        // in the refreshed accounts map.
        const current = get().activeAccountId;
        set({
          accounts,
          primaryAccountId,
          activeAccountId: current && accounts[current] ? current : primaryAccountId,
          apiUrl,
          ...(maxObjectsInGet !== undefined ? { maxObjectsInGet } : {}),
          ...(maxObjectsInSet !== undefined ? { maxObjectsInSet } : {}),
        });
      },

      switchAccount: (accountId) => {
        const { accounts, activeAccountId } = get();
        if (accounts[accountId] && accountId !== activeAccountId) {
          set({ activeAccountId: accountId });
          // Cached objectId display names/lists were resolved against the
          // previous account and would otherwise show stale labels.
          useCacheStore.getState().clearAll();
        }
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          tokenEndpoint: null,
          endSessionEndpoint: null,
          accounts: {},
          primaryAccountId: null,
          activeAccountId: null,
          apiUrl: null,
        });
      },

      isAuthenticated: () => {
        const { accessToken, tokenExpiresAt } = get();
        return accessToken !== null && tokenExpiresAt !== null && Date.now() < tokenExpiresAt;
      },

      isTokenExpiringSoon: () => {
        const { tokenExpiresAt } = get();
        if (tokenExpiresAt === null) return false;
        return tokenExpiresAt - Date.now() < 60_000;
      },
    }),
    {
      name: 'stalwart-auth',
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      partialize: (state) =>
        ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          tokenExpiresAt: state.tokenExpiresAt,
          tokenEndpoint: state.tokenEndpoint,
          endSessionEndpoint: state.endSessionEndpoint,
          activeAccountId: state.activeAccountId,
        }) as AuthState,
    },
  ),
);
