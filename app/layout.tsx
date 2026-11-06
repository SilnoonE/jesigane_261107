import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온타임 — 나를 위한 시간, 간편한 예약",
  description:
    "30분의 집중 상담. 날짜를 고르고 예약과 대기를 한곳에서 관리하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
