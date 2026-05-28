import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { execSync } from "child_process";
import { Suspense } from "react";
import { ResetHandler } from "./components/ResetHandler";
import "./globals.css";
import "./shadcn.css";

// Read the current git branch at server-render time so the client can
// namespace localStorage keys per project branch — no async needed.
let gitBranch = "main";
try {
  gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
} catch { /* not a git repo — fall back to "main" */ }

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Huge - Prototype Playground",
  description: "Build components from Figma using Claude Code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Inject current git branch so client-side code can namespace localStorage keys */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BRANCH__=${JSON.stringify(gitBranch)};`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <ResetHandler />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
