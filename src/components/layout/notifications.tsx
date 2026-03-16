'use client';

import { useFirebase, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Notification, WithId } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';
import { SidebarMenuButton } from '../ui/sidebar';

export function Notifications({ isMobile = false, onClick }: { isMobile?: boolean, onClick?: () => void }) {
    const { firestore, user, isUserLoading } = useFirebase();

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: notifications } = useCollection<WithId<Notification>>(notificationsQuery);

    const unreadCount = notifications?.filter(n => !n.isRead).length || 0;
    
    if (isUserLoading) {
        return <Skeleton className={isMobile ? "h-10 w-10 rounded-full" : "h-8 w-full"} />
    }

    if (!user) {
        const disabledButton = isMobile ? (
            <Button variant="ghost" size="icon" disabled className="w-10 h-10 rounded-full flex items-center justify-center glass-card text-slate-400">
                <Bell className="h-5 w-5" />
            </Button>
        ) : (
            <SidebarMenuButton disabled tooltip={{ children: 'Notifications' }}>
                <Bell />
                <span className="ml-2">Notifications</span>
            </SidebarMenuButton>
        )
        return disabledButton;
    }

    const trigger = isMobile ? (
         <Button asChild variant="ghost" size="icon" className="w-10 h-10 rounded-full flex items-center justify-center glass-card text-slate-400 relative">
            <Link href="/notifications" onClick={onClick}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white border-2 border-background">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Link>
        </Button>
    ) : (
        <SidebarMenuButton asChild tooltip={{ children: 'Notifications' }}>
             <Link href="/notifications" onClick={onClick} className="relative">
                <Bell />
                <span className="group-data-[collapsible=icon]:hidden ml-2">Notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-0.5">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Link>
        </SidebarMenuButton>
    );

    return trigger;
}
