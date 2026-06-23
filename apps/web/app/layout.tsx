import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FaceGuard — Find your face online",
  description:
    "A consent-based personal monitoring service. Discover where your own photos appear across the web and get alerted to new appearances.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
