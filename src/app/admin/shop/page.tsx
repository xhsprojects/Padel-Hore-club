'use client';

import { useState, useEffect } from 'react';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { ProductManagement } from '@/components/admin/product-management';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function ManageShopPage() {
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
            <SidebarInset>
                <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-40 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </SidebarInset>
        )
    }

    const isDefaultAdmin = user.uid === DEFAULT_ADMIN_UID;
    if (userProfile?.role !== 'admin' && !isDefaultAdmin) {
        return (
            <SidebarInset>
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
            </SidebarInset>
        );
    }

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Shop Management</CardTitle>
                        <CardDescription>Create, view, and manage club merchandise.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ProductManagement />
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    )
}
