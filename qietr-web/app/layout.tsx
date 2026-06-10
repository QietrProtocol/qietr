import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Nav } from "./_components/Nav";
import { Footer } from "./_components/Footer";
import { WalletAdapterProvider } from "./_components/WalletAdapterProvider";

export const metadata: Metadata = {
  title: "Qietr — Privacy-first infrastructure for AI agents",
  description:
    "Zero-knowledge privacy layer for HTTP 402 micropayments on Solana. Shielded USDC payments for the agent economy. Open source, open standards.",
  metadataBase: new URL("https://qietr.com"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletAdapterProvider>
          <Nav />
          {children}
          <Footer />
        </WalletAdapterProvider>
      </body>
    </html>
  );
}
