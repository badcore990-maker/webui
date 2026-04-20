/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
const { Sun, Moon, User, LogOut, Check, Menu, Sparkles } = LucideIcons;
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/common/GlobalSearch';
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
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { findFirstAccessibleLinkInLayout, findFirstVisibleLinkInLayout, visibleLayouts } from '@/lib/layout';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
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

  const navigableLayouts = schema
    ? visibleLayouts(schema, edition, (prefix) => hasObjectPermission(prefix, 'Get'), hasPermission)
    : [];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
        <Menu className="h-4 w-4" />
      </Button>

      <Link to="/" className="flex shrink-0 items-center">
        <Logo />
      </Link>

      <GlobalSearch />

      <div className="flex items-center gap-2">
        {edition !== 'enterprise' && <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />}

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
                logout();
                navigate('/login');
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
