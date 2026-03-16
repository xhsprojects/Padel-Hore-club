'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Share } from 'lucide-react';
import { Logo } from '@/components/icons';

// Define the interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isChromeOnIos, setIsChromeOnIos] = useState(false);

  useEffect(() => {
    // Detect if the user is on an iOS device
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isChromeOnIosDevice = /CriOS/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Only show prompt if not in standalone and not on iOS where we handle it differently
      if (!isInStandaloneMode) {
        setInstallPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      }
    };
    
    // For iOS, we just check if it's an iOS device and not in standalone mode
    if (isIosDevice && !isInStandaloneMode) {
        setIsIos(true);
        if (isChromeOnIosDevice) {
            setIsChromeOnIos(true);
        }
        setIsVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    
    // We hide the prompt once it's been shown
    setIsVisible(false);
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };
  
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[101] p-4 md:bottom-4 md:right-4 md:left-auto animate-in slide-in-from-bottom-12 duration-500">
      <Card className="max-w-sm mx-auto md:mx-0 shadow-2xl border-primary/20 bg-card">
        <CardContent className="p-4 relative">
          <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-2 right-2 text-muted-foreground" onClick={handleDismiss}>
             <X className="h-4 w-4" />
          </Button>
          <div className="flex items-start gap-4">
            <Logo className="w-10 h-10 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold">Install Padel Hore</h3>
              {isIos ? (
                 isChromeOnIos ? (
                    <p className="text-sm text-muted-foreground mt-1">
                        Untuk menginstal, buka halaman ini di Safari. Lalu, ketuk ikon <Share className="inline-block h-4 w-4 mx-1" /> dan 'Tambah ke Layar Utama'.
                    </p>
                 ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                        Ketuk ikon <Share className="inline-block h-4 w-4 mx-1" /> , lalu 'Tambah ke Layar Utama' untuk menginstal aplikasi.
                    </p>
                 )
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Add Padel Hore to your home screen for quick access.
                </p>
              )}
               <div className="mt-4 flex gap-2">
                 {!isIos && installPrompt && (
                   <Button onClick={handleInstallClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                     <Download className="mr-2 h-4 w-4" />
                     Install
                   </Button>
                 )}
                  <Button variant="ghost" onClick={handleDismiss}>
                    Not now
                  </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    