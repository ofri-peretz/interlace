import "./global.css";
import type { ReactNode } from "react";
import { PostHogProvider } from "#interlace/components/analytics/posthog-provider";
import { VisitorProfileTracker } from "#interlace/components/analytics/visitor-profile-tracker";
import {
  createRootMetadata,
  DocsRootLayout,
} from "#interlace/layouts/root-layout";

export const metadata = createRootMetadata({
  title: "Interlace — TypeScript-native developer tools",
  titleTemplate: "%s | Interlace",
  description:
    "A family of TypeScript-native, evidence-backed developer tools — ESLint plugins, Serverless Framework plugins, and more. Zero ghost dependencies. Every claim measured.",
  keywords: [
    "Interlace",
    "TypeScript",
    "ESLint",
    "Serverless Framework",
    "AWS",
    "developer tools",
    "open source",
  ],
  metadataBase: "https://interlace.tools",
  siteName: "Interlace",
  applicationName: "Interlace",
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider app="interlace-landing">
      <VisitorProfileTracker />
      <DocsRootLayout>{children}</DocsRootLayout>
    </PostHogProvider>
  );
}
