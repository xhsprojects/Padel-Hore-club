'use client';

import { Notifications } from './notifications';
import { Logo } from '@/components/icons';
import { Bell } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-card z-30 border-b border-border">
        <div className="flex items-center gap-3">
            <Logo className="w-10 h-10 flex-shrink-0"/>
            <div>
                <h1 className="font-black text-base uppercase tracking-wider">
                    PADEL <span className="text-primary">HORE</span> CLUB
                </h1>
                <p className="text-xs text-muted-foreground -mt-1 font-bold tracking-wider">ELITE EXPERIENCE</p>
            </div>
        </div>
        <Notifications isMobile={true} />
    </header>
  );
}

    