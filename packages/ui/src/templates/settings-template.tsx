/**
 * @interlace/ui — SettingsTemplate
 *
 * Account / app settings surface. Topbar + left tab-rail (sections) +
 * main content area (rendered section). Server-friendly; the active
 * section is driven by the consumer's routing (each section is a route).
 *
 * ## MIN_VIEWPORT — 480
 *
 * Below 480, the tab-rail becomes a horizontal scrolling row above the
 * content.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Container } from '../primitives/container.js';
import { SectionBoundary } from '../primitives/section-boundary.js';
import { Stack } from '../primitives/stack.js';
import { Typography } from '../primitives/typography.js';
import { Topbar } from '../patterns/topbar.js';

export const MIN_VIEWPORT = 480 as const;

interface SettingsSection {
  id: string;
  label: React.ReactNode;
  href: string;
}

interface SettingsTemplateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  topbar: React.ComponentProps<typeof Topbar>;
  /** Page title (rendered above the tab rail). */
  title?: React.ReactNode;
  /** Section list shown in the rail. */
  sections: SettingsSection[];
  /** ID of the currently-active section (matches `SettingsSection.id`). */
  activeSection: string;
  /** Main content (the active section's form / settings). */
  children: React.ReactNode;
}

function SettingsTemplate({
  topbar,
  title = 'Settings',
  sections,
  activeSection,
  children,
  className,
  ...props
}: SettingsTemplateProps) {
  return (
    <div
      data-slot="settings-template"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'bg-background text-foreground flex min-h-screen flex-col',
        className,
      )}
      {...props}
    >
      <Topbar {...topbar} />

      <main className="flex-1 py-xl">
        <Container size="content">
          <Stack gap="lg">
            <Typography variant="h2" as="h1" className="text-balance">
              {title}
            </Typography>

            <div className="flex flex-col gap-lg md:flex-row">
              <nav
                aria-label="Settings sections"
                className="md:w-56 md:shrink-0"
              >
                <ul className="flex gap-xs overflow-x-auto md:flex-col md:gap-xs">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={section.href}
                        aria-current={
                          activeSection === section.id ? 'page' : undefined
                        }
                        className={cn(
                          'text-muted-foreground hover:text-foreground hover:bg-muted block rounded-md px-sm py-xs text-sm transition-colors',
                          activeSection === section.id &&
                            'bg-muted text-foreground font-semibold',
                        )}
                      >
                        {section.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="flex-1">
                <SectionBoundary
                  name={`settings-${activeSection}`}
                  skeletonVariant="card"
                >
                  {children}
                </SectionBoundary>
              </div>
            </div>
          </Stack>
        </Container>
      </main>
    </div>
  );
}
SettingsTemplate.displayName = 'SettingsTemplate';

export { SettingsTemplate };
export type { SettingsTemplateProps, SettingsSection };
