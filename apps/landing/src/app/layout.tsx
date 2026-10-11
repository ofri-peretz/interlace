import "./global.css";
import type { ReactNode } from "react";
import { PostHogProvider } from "#interlace/components/analytics/posthog-provider";
import { VisitorProfileTracker } from "#interlace/components/analytics/visitor-profile-tracker";
import {
  createRootMetadata,
  DocsRootLayout,
} from "#interlace/layouts/root-layout";

export const metadata = {
  // ponytail: manifest isn't in RootMetadataConfig; spread here instead of widening the baseline
  manifest: "/manifest.json",
  ...createRootMetadata({
  title: "Interlace — open-source tools for JavaScript developers",
  titleTemplate: "%s | Interlace",
  description:
    "Open-source tools for JavaScript developers: ESLint plugins that find bugs in AI-written code, burgee (a CLI framework for Node.js), and Serverless Framework plugins.",
  keywords: [
    "Interlace",
    "TypeScript",
    "ESLint",
    "Serverless Framework",
    "burgee",
    "Node.js CLI framework",
    "AWS",
    "developer tools",
    "open source",
  ],
  metadataBase: "https://interlace.tools",
  siteName: "Interlace",
  applicationName: "Interlace",
  }),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider app="interlace-landing">
      <VisitorProfileTracker />
      <DocsRootLayout>{children}</DocsRootLayout>
    </PostHogProvider>
  );
}
