import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Rendered as a trailing count, the way "Relations (1)" reads. */
  count?: number;
}

/** Shared id scheme so a `Tabs` strip and its `TabPanel`s can reference each other. */
const tabId = (group: string, id: string) => `${group}-tab-${id}`;
const panelId = (group: string, id: string) => `${group}-panel-${id}`;

interface TabsProps {
  /** Unique per tab group on the page; ties each tab to its panel via aria. */
  group: string;
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Tab strip following the WAI-ARIA tabs pattern: arrow keys move between tabs, Home/End
 * jump to the ends, and only the active tab is in the page tab order. Render the body
 * with `TabPanel`, passing the same `group`, so the aria wiring lines up.
 */
export function Tabs({ group, tabs, activeId, onChange, className }: TabsProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((t) => t.id === activeId);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    onChange(next.id);
    document.getElementById(tabId(group, next.id))?.focus();
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            id={tabId(group, tab.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId(group, tab.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  group: string;
  /** The tab this panel belongs to. */
  tabId: string;
  activeId: string;
}

export function TabPanel({ group, tabId: ownTabId, activeId, className, ...props }: TabPanelProps) {
  const active = ownTabId === activeId;
  return (
    <div
      id={panelId(group, ownTabId)}
      role="tabpanel"
      aria-labelledby={tabId(group, ownTabId)}
      hidden={!active}
      tabIndex={0}
      className={cn('outline-none', className)}
      {...props}
    />
  );
}
