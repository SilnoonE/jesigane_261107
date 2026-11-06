import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "제시간에 — 서울에서, 우리 제시간에",
  description:
    "남산에서 한강까지. 친구와 약속을 정하고 작은 예약금과 만장일치 투표로 함께 지켜요. 현재 결제는 모의 체험입니다.",
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
