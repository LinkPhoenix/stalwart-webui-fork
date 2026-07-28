/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
const { Sun, Moon, User, LogOut, Check, Menu, Sparkles, Search } = LucideIcons;
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/common/GlobalSearch';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logo from '@/components/common/Logo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { findFirstAccessibleLinkInLayout, findFirstVisibleLinkInLayout, visibleLayouts } from '@/lib/layout';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { buildEndSessionUrl, getPostLogoutRedirectUri } from '@/services/auth/oauth';
import { useState } from 'react';
import { useAccountStore } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';

function getIcon(name: string): LucideIcons.LucideIcon {
  const formatted = name
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
  return ((LucideIcons as Record<string, unknown>)[formatted] as LucideIcons.LucideIcon) || LucideIcons.Circle;
}

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const logout = useAuthStore((s) => s.logout);
  const edition = useAccountStore((s) => s.edition);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const hasPermission = useAccountStore((s) => s.hasPermission);
  const schema = useSchemaStore((s) => s.schema);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const navigableLayouts = schema
    ? visibleLayouts(schema, edition, (prefix) => hasObjectPermission(prefix, 'Get'), hasPermission)
    : [];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
        <Menu className="h-4 w-4" />
      </Button>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/" className="flex shrink-0 items-center">
              <Logo />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('version.label', 'Stalwart WebUI v{{version}}', { version: __APP_VERSION__ })}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="hidden min-w-0 flex-1 items-center justify-center px-4 md:flex">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        {edition !== 'enterprise' && <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />}

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileSearchOpen(true)}
          aria-label={t('search', 'Search')}
        >
          <Search className="h-4 w-4" />
        </Button>

        <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
          <DialogContent className="top-4 translate-y-0 max-w-[calc(100vw-2rem)] p-4">
            <DialogTitle className="sr-only">{t('search', 'Search')}</DialogTitle>
            <GlobalSearch autoFocus onAfterSelect={() => setMobileSearchOpen(false)} />
          </DialogContent>
        </Dialog>

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('toggleTheme', 'Toggle theme')}>
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('userMenu', 'User menu')}>
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {schema && navigableLayouts.length > 0 && (
              <>
                <DropdownMenuLabel>{t('sections', 'Sections')}</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {navigableLayouts.map((layout) => {
                    const Icon = getIcon(layout.icon);
                    return (
                      <DropdownMenuItem
                        key={layout.name}
                        onClick={() => {
                          setActiveSection(layout.name);
                          const canGet = (prefix: string) => hasObjectPermission(prefix, 'Get');
                          const firstLink =
                            findFirstAccessibleLinkInLayout(schema, layout, edition, canGet, hasPermission) ??
                            findFirstVisibleLinkInLayout(schema, layout, edition, canGet, hasPermission);
                          if (firstLink) {
                            navigate(`/${layout.name}/${firstLink}`);
                          }
                        }}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {layout.name}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {Object.keys(accounts).length > 0 && (
              <>
                <DropdownMenuLabel>{t('accounts', 'Accounts')}</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {Object.entries(accounts).map(([id, info]) => (
                    <DropdownMenuItem key={id} onClick={() => switchAccount(id)}>
                      {id === activeAccountId && <Check className="mr-2 h-4 w-4" />}
                      <span className={id !== activeAccountId ? 'ml-6' : ''}>{info.name || id}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {edition !== 'enterprise' && (
              <>
                <DropdownMenuItem onClick={() => setUpsellOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('tryEnterprise', 'Try Enterprise')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem
              onClick={() => {
                const endSessionEndpoint = useAuthStore.getState().endSessionEndpoint;
                logout();
                if (endSessionEndpoint) {
                  window.location.href = buildEndSessionUrl(endSessionEndpoint, getPostLogoutRedirectUri());
                } else {
                  navigate('/login');
                }
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('logout', 'Logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
