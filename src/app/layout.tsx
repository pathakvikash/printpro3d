import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PrintPro3D - Professional 3D Printing Services',
  description:
    'Upload your 3D models, choose from premium materials, and get high-quality 3D prints delivered to your doorstep. Professional FDM, SLA, and SLS printing services.',
  keywords: ['3D printing', '3D model upload', 'custom 3D prints', 'prototyping', 'rapid prototyping'],
  openGraph: {
    title: 'PrintPro3D - Professional 3D Printing Services',
    description: 'Upload, customize, and order premium 3D prints online.',
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        <main className='min-h-screen'>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
