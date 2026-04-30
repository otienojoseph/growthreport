import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "GrowthAudit - Professional Website Audits",
  description:
    "Get a professional audit of your website to improve conversion and performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.className} ${sans.variable} text-gray-900 bg-gray-50 flex flex-col min-h-screen`}
      >
        {/* Screen-reader only skip link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-blue-600 focus:text-white rounded-br-lg transition-all font-medium"
        >
          Skip to main content
        </a>

        {/* Inclusive Navigation Header */}
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  href="/"
                  className="font-bold tracking-tight text-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-sm"
                  aria-label="GrowthAudit Home"
                >
                  Growth<span className="text-blue-600">Audit</span>
                </Link>
              </div>
              <nav aria-label="Main Navigation">
                <ul className="flex items-center space-x-6 sm:space-x-8">
                  <li>
                    <Link
                      href="/"
                      className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-sm"
                      aria-current="page"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/pricing"
                      className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-sm"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li className="hidden sm:block">
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                      Start an audit
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content Area Wrapper */}
        <div id="main-content" className="flex-1 outline-none" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
