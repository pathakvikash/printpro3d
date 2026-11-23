import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CartProvider } from '@/components/CartProvider';
import CartDrawer from '@/components/CartDrawer';
import WhatsAppButton from '@/components/WhatsAppButton';

// Geist Mono stays: the `font-mono` class is used by CartDrawer (order id)
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false, // used by one <code> in CartDrawer only, so it is not preloaded on every page
});

export const metadata: Metadata = {
  title: 'PrintPro3D - Professional 3D Printing Services',
  description:
    'Made-to-order 3D design and printing, from a single piece to wholesale, starting from a 3D file or an idea.',
  keywords: ['3D printing', '3D model upload', 'custom 3D prints', 'prototyping', 'rapid prototyping'],
  openGraph: {
    title: 'PrintPro3D - Professional 3D Printing Services',
    description: 'Made-to-order 3D design and printing, from a single piece to wholesale.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-950 flex min-h-screen flex-col`}
      >
        <CartProvider>
          <Navbar />
          <main className='flex-1 bg-gray-50 dark:bg-gray-900'>{children}</main>
          <Footer />
          <CartDrawer />
          <WhatsAppButton />
        </CartProvider>
      </body>
    </html>
  );
}
