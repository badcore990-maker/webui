/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, List, Settings, Plus } from 'lucide-react';
import { useSchemaStore, type SearchIndexEntry } from '@/stores/schemaStore';
import { useAccountStore } from '@/stores/accountStore';
import { resolveObject } from '@/lib/schemaResolver';
import type { Schema } from '@/types/schema';

const MAX_RESULTS = 15;

const TYPE_ORDER: Record<SearchIndexEntry['type'], number> = {
  link: 0,
  form: 1,
  field: 2,
};

function getObjectKind(schema: Schema, viewName: string): 'singleton' | 'object' | null {
  const resolved = resolveObject(schema, viewName);
  if (!resolved) return null;
  return resolved.objectType.type === 'singleton' ? 'singleton' : 'object';
}

function getActionInfo(
  entryType: SearchIndexEntry['type'],
  objectKind: 'singleton' | 'object' | null,
  t: (key: string, fallback: string) => string,
): { label: string; Icon: typeof List } {
  if (entryType === 'link') {
    return objectKind === 'singleton'
      ? { label: t('globalSearch.settings', 'Settings'), Icon: Settings }
      : { label: t('globalSearch.list', 'List'), Icon: List };
  }
  return objectKind === 'singleton'
    ? { label: t('globalSearch.settings', 'Settings'), Icon: Settings }
    : { label: t('globalSearch.create', 'Create'), Icon: Plus };
}

function getNavigationPath(
  entryType: SearchIndexEntry['type'],
  objectKind: 'singleton' | 'object' | null,
  section: string,
  viewName: string,
): string {
  const encodedView = viewName;
  if (entryType === 'link') {
    return objectKind === 'singleton' ? `/${section}/${encodedView}/singleton` : `/${section}/${encodedView}`;
  }
  return objectKind === 'singleton' ? `/${section}/${encodedView}/singleton` : `/${section}/${encodedView}/new`;
}

function friendlyName(viewName: string): string {
  const stripped = viewName.replace(/^x:/, '');
  const parts = stripped.split('/');
  return parts[parts.length - 1];
}

interface GlobalSearchProps {
  onAfterSelect?: () => void;
  autoFocus?: boolean;
}

export function GlobalSearch({ onAfterSelect, autoFocus }: GlobalSearchProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const GROUP_LABELS: Record<SearchIndexEntry['type'], string> = {
    link: t('globalSearch.pages', 'Pages'),
    form: t('globalSearch.formSections', 'Form Sections'),
    field: t('globalSearch.fields', 'Fields'),
  };
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const schema = useSchemaStore((s) => s.schema);
  const searchIndex = useSchemaStore((s) => s.searchIndex);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!debouncedQuery.trim() || !schema) return [];

    const tokens = debouncedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    if (tokens.length === 0) return [];

    const filtered = searchIndex.filter((entry) => {
      const haystack = (entry.text + ' ' + (entry.keywords?.join(' ') ?? '')).toLowerCase();
      for (const token of tokens) {
        if (!haystack.includes(token)) return false;
      }
      const resolved = resolveObject(schema, entry.viewName);
      if (!resolved) return false;
      return hasObjectPermission(resolved.permissionPrefix, 'Get');
    });

    filtered.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
    return filtered.slice(0, MAX_RESULTS);
  }, [debouncedQuery, searchIndex, schema, hasObjectPermission]);

  const groups = useMemo(() => {
    const map = new Map<SearchIndexEntry['type'], SearchIndexEntry[]>();
    for (const entry of results) {
      const arr = map.get(entry.type);
      if (arr) arr.push(entry);
      else map.set(entry.type, [entry]);
    }
    return map;
  }, [results]);

  const handleSelect = useCallback(
    (entry: SearchIndexEntry) => {
      if (!schema) return;
      const objectKind = getObjectKind(schema, entry.viewName);
      const path = getNavigationPath(entry.type, objectKind, entry.section, entry.viewName);
      setDropdownOpen(false);
      setQuery('');
      setDebouncedQuery('');
      navigate(path);
      onAfterSelect?.();
    },
    [schema, navigate, onAfterSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!dropdownOpen || results.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      } else if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    },
    [dropdownOpen, results, activeIndex, handleSelect],
  );

  const showDropdown = dropdownOpen && debouncedQuery.trim().length > 0;

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          handleQueryChange(e.target.value);
          setDropdownOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setDropdownOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t('globalSearch.noResults', 'No results found.')}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {Array.from(groups.entries()).map(([type, entries]) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{GROUP_LABELS[type]}</div>
                  {entries.map((entry) => {
                    const flatIdx = results.indexOf(entry);
                    const objectKind = schema ? getObjectKind(schema, entry.viewName) : null;
                    const { label: actionLabel, Icon: ActionIcon } = getActionInfo(entry.type, objectKind, t);

                    return (
                      <button
                        key={`${type}-${entry.viewName}-${flatIdx}`}
                        type="button"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                          flatIdx === activeIndex ? 'bg-accent' : ''
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(entry);
                        }}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                      >
                        <ActionIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-1 flex-col overflow-hidden">
                          <span className="truncate font-medium">{friendlyName(entry.text)}</span>
                          <span className="truncate text-xs text-muted-foreground">{entry.breadcrumb}</span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{actionLabel}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
