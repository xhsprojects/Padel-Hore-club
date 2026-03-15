'use client';

import { Notifications } from './notifications';
import { Logo } from '@/components/icons';
import { Bell } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-card z-30 border-b border-border">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
                <Logo className="w-8 h-8"/>
            </div>
            <h1 className="font-extrabold text-lg tracking-wider uppercase">Padel Hore</h1>
        </div>
        <Notifications isMobile={true} />
    </header>
  );
}

    