import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ABAP Modernization Copilot — S/4HANA Readiness Analysis",
  description:
    "AI-augmented S/4HANA migration readiness analysis for custom ABAP code. Scan ABAP programs, detect simplification-item incompatibilities, and generate executive-grade remediation reports.",
  keywords: [
    "ABAP",
    "SAP",
    "S/4HANA",
    "migration",
    "simplification items",
    "Claude",
    "code analysis",
  ],
  authors: [{ name: "Sneha Budhwani" }],
  openGraph: {
    title: "ABAP Modernization Copilot",
    description:
      "AI-augmented S/4HANA migration readiness analysis for custom ABAP code.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
