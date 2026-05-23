import React from 'react';
import type { Metadata } from 'next';
import '../styles/globals.css';
import '../styles/cesium.css';

export const metadata: Metadata = {
  title: 'OrbitalMind - Satellite Operations Dashboard',
  description: 'Real-time monitoring and control of orbital AI compute constellation',
  viewport: 'width=device-width, initial-scale=1',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#000000" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                  <span className="text-lg font-bold">◉</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold">OrbitalMind</h1>
                  <p className="text-xs text-slate-400">Satellite Operations Dashboard</p>
                </div>
              </div>
              <nav className="flex gap-6">
                <a href="/" className="text-sm font-medium hover:text-blue-400">
                  Dashboard
                </a>
                <a href="/constellation" className="text-sm font-medium hover:text-blue-400">
                  Constellation
                </a>
                <a href="/telemetry" className="text-sm font-medium hover:text-blue-400">
                  Telemetry
                </a>
                <a href="/settings" className="text-sm font-medium hover:text-blue-400">
                  Settings
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-800 bg-slate-900 px-6 py-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-slate-400">
              <p>&copy; 2026 OrbitalMind. All rights reserved.</p>
              <p>Status: Online</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
