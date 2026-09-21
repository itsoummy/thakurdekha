import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HoppingListProvider } from "@/context/HoppingListContext";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Thakurdekha",
  title: "Thakurdekha — Ei Pujo, Ekhane Dekha",
  description:
    "Discover Kolkata's Durga Pujo pandals, find nearby metro & food, and build your own pandal-hopping route.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <HoppingListProvider>
            <Header />
            <main className="flex-1">{children}</main>
          </HoppingListProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
