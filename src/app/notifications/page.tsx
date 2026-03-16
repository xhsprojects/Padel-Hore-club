'use client';

import { useState, useMemo, useEffect } from 'react';
import { SidebarInset } from '@/components/ui/sidebar';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Notification, WithId } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Loader2, Trophy, Flame, Swords, ArrowDown, UserCog, Megaphone, Star, Hourglass, Trash2, CalendarCheck, ShieldAlert, CalendarPlus, Package, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const NOTIFICATION_ICONS: { [key: string]: React.ElementType } = {
    Trophy,
    Flame,
    Swords,
    ArrowDown,
    UserCog,
    Megaphone,
    Star,
    Hourglass,
    CalendarCheck,
    ShieldAlert,
    CalendarPlus,
    Package,
    UserPlus,
    default: Star,
};

export default function NotificationsPage() {
    const { firestore, user, isUserLoading } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [selectedNotification, setSelectedNotification] = useState<WithId<Notification> | null>(null);

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: notifications, isLoading } = useCollection<WithId<Notification>>(notificationsQuery);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const filteredNotifications = useMemo(() => {
        if (!notifications) return [];
        if (filter === 'unread') {
            return notifications.filter(n => !n.isRead);
        }
        return notifications;
    }, [notifications, filter]);

    const handleMarkAllAsRead = async () => {
        if (!firestore || !user || !notifications) return;

        const unread = notifications.filter(n => !n.isRead);
        if (unread.length > 0) {
            const batch = writeBatch(firestore);
            unread.forEach(notif => {
                const notifRef = doc(firestore, 'users', user.uid, 'notifications', notif.id);
                batch.update(notifRef, { isRead: true });
            });
            await batch.commit().catch(err => console.error("Failed to mark all as read:", err));
        }
    };
    
    const handleNotificationClick = async (notif: WithId<Notification>) => {
        setSelectedNotification(notif);
        if (!notif.isRead && firestore && user) {
            const notifRef = doc(firestore, 'users', user.uid, 'notifications', notif.id);
            await updateDoc(notifRef, { isRead: true });
        }
    };

    const handleDeleteNotification = async (notifId: string) => {
        if (!firestore || !user) return;
        const notifRef = doc(firestore, 'users', user.uid, 'notifications', notifId);
        try {
            await deleteDoc(notifRef);
            setSelectedNotification(null); // Close the modal
            toast({ title: 'Notification Deleted' });
        } catch (error) {
            console.error("Failed to delete notification:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete notification.' });
        }
    };

    if (isUserLoading || !user) {
        return (
            <SidebarInset>
                <div className="p-4 sm:p-6 lg:p-8">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <Skeleton className="h-10 w-64" />
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <Skeleton className="h-10 w-40" />
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset>
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="font-black text-3xl uppercase tracking-widest">Notifications</h1>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="w-full sm:w-auto">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="all" className="text-sm">All</TabsTrigger>
                                <TabsTrigger value="unread" className="text-sm">Unread</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button variant="outline" onClick={handleMarkAllAsRead} className="w-full sm:w-auto">Mark all as read</Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : filteredNotifications && filteredNotifications.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredNotifications.map(notif => (
                            <NotificationItem 
                                key={notif.id} 
                                notification={notif} 
                                onClick={() => handleNotificationClick(notif)}
                            />
                        ))}
                    </div>
                ) : (
                    <Card className="text-center p-12 text-muted-foreground bg-card/50">
                        You have no {filter === 'unread' ? 'unread' : ''} notifications yet.
                    </Card>
                )}
            </div>
            
            <NotificationDetailModal 
                notification={selectedNotification}
                open={!!selectedNotification}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setSelectedNotification(null);
                }}
                onDelete={handleDeleteNotification}
            />
        </SidebarInset>
    );
}

function NotificationItem({ notification, onClick }: { notification: WithId<Notification>, onClick: () => void }) {
    const Icon = NOTIFICATION_ICONS[notification.icon || 'default'] || NOTIFICATION_ICONS.default;
  
    return (
        <Card 
            className="p-4 flex items-start gap-4 hover:bg-accent transition-colors cursor-pointer"
            onClick={onClick}
        >
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <Icon className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <p className="font-bold leading-tight uppercase tracking-wider">
                        {notification.title}
                    </p>
                    {!notification.isRead && <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0 ml-2 mt-1" />}
                </div>
                {notification.body && (
                    <p className="text-sm text-muted-foreground mt-1">{notification.body}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true })}
                </p>
            </div>
        </Card>
    );
}


function NotificationDetailModal({ 
    notification, 
    open, 
    onOpenChange,
    onDelete,
}: { 
    notification: WithId<Notification> | null; 
    open: boolean; 
    onOpenChange: (open: boolean) => void;
    onDelete: (notifId: string) => void;
}) {
    if (!notification) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl">{notification.title}</DialogTitle>
                    <DialogDescription className="pt-2">
                        {notification.body}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    {notification.link && (
                        <Button asChild>
                            <Link href={notification.link}>{notification.linkButtonText || 'View Details'}</Link>
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button 
                        variant="destructive" 
                        onClick={() => onDelete(notification.id)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
