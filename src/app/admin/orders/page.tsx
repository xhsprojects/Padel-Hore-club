'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { OrderManagement } from '@/components/admin/order-management';
import { Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function ManageOrdersPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading || isProfileLoading || !user) {
        return (
                 <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-6xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-4 w-80" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-64 w-full" />
                        </CardContent>
                    </Card>
                </div>
        )
    }

    const isDefaultAdmin = user.uid === DEFAULT_ADMIN_UID;
    if (userProfile?.role !== 'admin' && !isDefaultAdmin) {
        return (
                <div className="p-2 sm:p-6 lg:p-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle>Access Denied</CardTitle>
                            <CardDescription>You do not have the required permissions to view this page.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/')}>Go to Leaderboard</Button>
                        </CardContent>
                    </Card>
                </div>
        );
    }

    return (
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-6xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                           <Receipt className="h-6 w-6" />
                           Order Management
                        </CardTitle>
                        <CardDescription>View all customer orders and update their status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OrderManagement />
                    </CardContent>
                </Card>
            </div>
    )
}
