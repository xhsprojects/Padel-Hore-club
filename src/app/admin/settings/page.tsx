'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { AppSettingsManagement } from '@/components/admin/app-settings';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function ManageAppSettingsPage() {
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
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-8 w-56" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-48 w-full" />
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
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Pengaturan Aplikasi</CardTitle>
                        <CardDescription>Kelola pengaturan umum untuk aplikasi Padel Hore.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AppSettingsManagement />
                    </CardContent>
                </Card>
            </div>
    )
}

    