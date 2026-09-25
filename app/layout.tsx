import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace-context";

export const metadata: Metadata = { title: "Clarity Care | Clinical Documentation", description: "Healthcare documentation workflow demo" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WorkspaceProvider>{children}</WorkspaceProvider></body></html>;
}
