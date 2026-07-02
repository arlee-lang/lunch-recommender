import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const TITLE = "오늘 뭐먹지????";
const DESCRIPTION = "걸을 수 있는 거리와 먹고 싶은 메뉴만 고르면 근처 식당 3곳을 바로 추천해드려요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://app-six-theta-51.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    images: ["/food-illustrations.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
