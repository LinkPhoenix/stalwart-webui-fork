/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, Palette, ScrollText, Search, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/common/CommandPalette';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Logo from '@/components/common/Logo';
import { ModeToggle } from '@/components/common/ModeToggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { buildEndSessionUrl, getPostLogoutRedirectUri } from '@/services/auth/oauth';
import { useEffect, useState } from 'react';
import { useIsCommunity } from '@/hooks/usePermissions';
import { SIDEBAR_ID } from './sidebarContext';
import { useLayoutNavigation } from './useLayoutNavigation';

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

export function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const logout = useAuthStore((s) => s.logout);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const isCommunity = useIsCommunity();
  const { layouts: navigableLayouts, landingPath } = useLayoutNavigation();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 bg-background/80 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="md:hidden"
        aria-label={t('sidebar.toggle', 'Toggle navigation')}
        aria-expanded={sidebarOpen}
        aria-controls={SIDEBAR_ID}
      >
        <Menu aria-hidden="true" className="h-4 w-4" />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link to="/" className="flex shrink-0 items-center md:w-[228px]">
            <Logo />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t('version.label', 'Stalwart WebUI v{{version}}', { version: __APP_VERSION__ })}
        </TooltipContent>
      </Tooltip>

      <div className="hidden min-w-0 flex-1 items-center md:flex">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-full bg-card pl-4 pr-2 text-sm text-dim shadow-tile transition-shadow duration-200 hover:shadow-lift"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
          <span className="flex-1 text-left">{t('globalSearch.placeholder', 'Search pages, fields, settings...')}</span>
          <kbd
            aria-hidden="true"
            className="pointer-events-none flex h-6 select-none items-center rounded-full bg-muted px-2.5 font-mono text-[11px] font-medium text-muted-foreground"
          >
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {isCommunity && <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />}

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label={t('common.search', 'Search')}
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </Button>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label={t('userMenu', 'User menu')}>
              <User aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {navigableLayouts.length > 0 && (
              <>
                <DropdownMenuLabel>{t('sections', 'Sections')}</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {navigableLayouts.map((layout) => (
                    <DropdownMenuItem
                      key={layout.name}
                      onClick={() => {
                        setActiveSection(layout.name);
                        const path = landingPath(layout);
                        if (path) navigate(path);
                      }}
                    >
                      <DynamicIcon name={layout.icon} className="mr-2 h-4 w-4" />
                      {layout.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {Object.keys(accounts).length > 0 && (
              <>
                <DropdownMenuLabel>{t('accounts', 'Accounts')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={activeAccountId ?? ''} onValueChange={switchAccount}>
                  {Object.entries(accounts).map(([id, info]) => (
                    <DropdownMenuRadioItem key={id} value={id}>
                      {info.name || id}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
              </>
            )}

            {isCommunity && (
              <>
                <DropdownMenuItem onClick={() => setUpsellOpen(true)}>
                  <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t('tryEnterprise', 'Try Enterprise')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Fork-only client pages (outside the server layouts). */}
            <DropdownMenuItem asChild>
              <Link to="/Appearance">
                <Palette aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('appearance.label', 'Appearance')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/Changelog">
                <ScrollText aria-hidden="true" className="mr-2 h-4 w-4" />
                {t('changelog.label', 'Changelog')}
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => {
                const endSessionEndpoint = useAuthStore.getState().endSessionEndpoint;
                const endSessionUrl = endSessionEndpoint
                  ? buildEndSessionUrl(endSessionEndpoint, getPostLogoutRedirectUri())
                  : null;
                logout();
                if (endSessionUrl) {
                  window.location.href = endSessionUrl;
                } else {
                  navigate('/login');
                }
              }}
            >
              <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
              {t('logout', 'Logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
