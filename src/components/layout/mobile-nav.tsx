'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, QrCode, Plus, LayoutGrid, User, LogIn, Calendar, Swords, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { SidebarTrigger } from '@/components/ui/sidebar';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

const NavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: React.ElementType; label: string; isActive: boolean }) => (
    <Link href={href} className={cn(
        'flex flex-col items-center justify-center gap-1 group transition-colors w-full h-full',
        isActive ? 'text-primary' : 'text-slate-400 hover:text-primary'
    )}>
        <div className={cn(
            'p-2 rounded-xl transition-colors',
            isActive ? 'bg-primary/10' : 'group-hover:bg-accent'
        )}>
            <Icon className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-bold">{label}</span>
    </Link>
);

const MenuButton = () => (
    <SidebarTrigger className={cn(
        'flex flex-col items-center justify-center gap-1 group text-slate-400 hover:text-primary transition-colors w-full h-full'
    )}>
        <div className="p-2 rounded-xl group-hover:bg-accent">
            <LayoutGrid className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-bold">Menu</span>
    </SidebarTrigger>
);

const FAB = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => {
    return (
        <Link href={href} className="flex flex-col items-center gap-1 group -mt-10">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400 shadow-xl shadow-yellow-400/30 flex items-center justify-center text-green-900 hover:scale-105 active:scale-95 transition-transform">
                <Icon className="h-8 w-8" />
            </div>
            <span className="w-full text-center text-[10px] font-bold text-slate-400 mt-2">{label}</span>
        </Link>
    )
}

export function MobileNav() {
    const pathname = usePathname();
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;

    const fabItem = isAdmin 
        ? { href: '/admin', icon: Plus, label: 'Add Match' } 
        : { href: '/profile/card', icon: QrCode, label: 'My Card' };

    const navItems = isAdmin
      ? [
          { href: '/', icon: BarChart3, label: 'Leaderboard' },
          { href: '/admin/scanner', icon: QrCode, label: 'Scan' },
          { type: 'fab' },
          { href: '/events', icon: Calendar, label: 'Events' },
          { type: 'menu' },
        ]
      : user
      ? [
          { href: '/', icon: BarChart3, label: 'Leaderboard' },
          { href: '/events', icon: Calendar, label: 'Events' },
          { type: 'fab' },
          { href: '/profile', icon: User, label: 'Profile' },
          { type: 'menu' },
        ]
      : [
          { href: '/', icon: BarChart3, label: 'Leaderboard' },
          { href: '/events', icon: Calendar, label: 'Events'},
          { href: '/shop', icon: Store, label: 'Shop' },
          { type: 'menu' },
        ];

    return (
        <nav className="fixed bottom-0 w-full max-w-[430px] h-24 bg-card border-t border-border flex items-center justify-around px-4 pb-4 z-50">
            {navItems.map((item, index) => {
                if (item.type === 'fab') return user ? <FAB key={index} {...fabItem} /> : null;
                if (item.type === 'menu') return <MenuButton key={index} />;
                
                if (!item.href) return null;

                const isActive = (item.href === '/') ? pathname === item.href : pathname.startsWith(item.href);
                return <NavItem key={item.label} {...item} isActive={isActive} />
            })}
        </nav>
    );
}
