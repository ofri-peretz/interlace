import "./global.css";
import type { ReactNode } from "react";
import { PostHogProvider } from "#interlace/components/analytics/posthog-provider";
import { VisitorProfileTracker } from "#interlace/components/analytics/visitor-profile-tracker";
import {
  createRootMetadata,
  DocsRootLayout,
} from "#interlace/layouts/root-layout";

import messages from "@/data/brand-messages.json";

export const metadata = {
  // ponytail: manifest isn't in RootMetadataConfig; spread here instead of widening the baseline
  manifest: "/manifest.json",
  ...createRootMetadata({
  title: `Interlace — ${messages.headline.replace(/\.$/, "")}`,
  titleTemplate: "%s | Interlace",
  description: messages.tagline,
  keywords: [
    "Interlace",
    "TypeScript",
    "ESLint",
    "Serverless Framework",
    "burgee",
    "oxmutate",
    "mutation testing",
    "AI-written code",
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
