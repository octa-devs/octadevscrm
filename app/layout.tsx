import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600', '700'], display: 'swap' });
const body = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'], display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'], display: 'swap' });

export const metadata: Metadata = {
  title: 'OCTA DEVS — Portal',
  description: 'Internal portal, CRM and site admin for OCTA DEVS.',
  icons: { icon: '/favicon.jpg', apple: '/logo.png' }
};

export const viewport: Viewport = { themeColor: '#0b0b0d', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

const bootTheme = `(function(){try{var t=localStorage.getItem('octa-theme');var m=t==='paper'||(t!=='ink'&&window.matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.classList.toggle('paper',m);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable + ' ' + body.variable + ' ' + mono.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: bootTheme }} /></head>
      <body className="min-h-screen bg-canvas text-fg font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
