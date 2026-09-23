import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Immunis — War Room',
  description: 'Investigate suspicious traffic, inspect decisions and monitor temporary protections.',
};

export const viewport: Viewport = {
  themeColor: '#07080d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
