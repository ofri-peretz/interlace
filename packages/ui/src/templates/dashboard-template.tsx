/**
 * @interlace/ui — DashboardTemplate
 *
 * Application dashboard surface. Topbar at top, persistent left sidebar
 * (nav links), main content area (children). The standard
 * "logged-in app" layout: every SaaS dashboard reaches for this shape.
 *
 * ## MIN_VIEWPORT — 480
 *
 * Below 480, the sidebar collapses (consumer wires a Sheet+Drawer for
 * the hamburger menu). Above 480 it stays persistent.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Topbar } from '../patterns/topbar.js';

export const MIN_VIEWPORT = 480 as const;

interface DashboardTemplateProps extends React.ComponentProps<'div'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Sidebar nav (typically a list of links). */
  sidebar: React.ReactNode;
  /** Page heading row (above the main content). */
  header?: React.ReactNode;
  /** Main content area. */
  children: React.ReactNode;
}

function DashboardTemplate({
  topbar,
  sidebar,
  header,
  children,
  className,
  ...props
}: DashboardTemplateProps) {
  return (
    <div
      data-slot="dashboard-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'bg-background text-foreground flex min-h-screen flex-col',
        className,
      )}
      {...props}
    >
      <Topbar {...topbar} />

      <div className="flex flex-1">
        <aside
          className="border-border bg-card hidden w-60 shrink-0 border-r md:block"
          aria-label="Primary navigation"
        >
          <SectionBoundary name="dashboard-sidebar" skeletonVariant="card">
            {sidebar}
          </SectionBoundary>
        </aside>

        <main className="flex-1 px-lg py-lg">
          {header ? (
            <SectionBoundary
              name="dashboard-header"
              skeletonVariant="page-header"
              className="mb-lg"
            >
              {header}
            </SectionBoundary>
          ) : null}
          <SectionBoundary name="dashboard-body" skeletonVariant="card">
            {children}
          </SectionBoundary>
        </main>
      </div>
    </div>
  );
}
DashboardTemplate.displayName = 'DashboardTemplate';

export { DashboardTemplate };
export type { DashboardTemplateProps };
