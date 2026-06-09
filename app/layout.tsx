import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'ab3ad · 3D generation service',
  description: 'Upload images, generate 3D models, and download GLB results.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="site-header">
            <div>
              <a className="brand" href="/">
                ab3ad
              </a>
              <p className="subtle">Hi3D-backed 3D file generation service</p>
            </div>
            <nav>
              <a href="/">Upload</a>
              <a href="/admin">Admin</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
