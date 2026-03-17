
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { FirebaseClientProvider } from '@/firebase';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { FirebaseMessagingInitializer } from '@/components/firebase-messaging-initializer';
import { MaintenanceProvider } from '@/components/maintenance-provider';
import { AppHeader } from '@/components/layout/app-header';
import { MobileNav } from '@/components/layout/mobile-nav';

export const metadata: Metadata = {
  title: 'Padel Hore Club',
  description: 'Leaderboard for the Padel Hore community.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Padel Hore',
  },
  icons: {
    icon: '/logopadel.png',
    shortcut: '/logopadel.png',
    apple: '/logopadel.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#F0F8F4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen flex justify-center" suppressHydrationWarning>
          <FirebaseClientProvider>
            <FirebaseMessagingInitializer />
            <MaintenanceProvider>
              <SidebarProvider>
                <AppSidebar />
                
                {/* Mobile-only layout wrapper */}
                <div className="w-full max-w-[430px] bg-background min-h-dvh flex flex-col relative shadow-2xl md:hidden">
                  <AppHeader />
                  <main className="flex-1 overflow-y-auto pb-24">
                      {children}
                  </main>
                  <MobileNav />
                </div>

                {/* Desktop layout wrapper */}
                <div className="hidden md:block w-full">
                  <SidebarInset>
                      {children}
                  </SidebarInset>
                </div>

              </SidebarProvider>
            </MaintenanceProvider>
          </FirebaseClientProvider>
          {/* Important: Place Toaster at root for maximum visibility */}
          <Toaster />
          <PwaInstallPrompt />
      </body>
    </html>
  );
}
