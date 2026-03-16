'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProfileForm } from '@/components/profile/profile-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditProfilePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading || !user) {
        return (
             <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-4 w-72" />
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-8">
                            <div className="flex items-end gap-4">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            </div>
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <div className="space-y-4 rounded-lg border p-4">
                                <Skeleton className="h-6 w-40" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <Skeleton className="h-12 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-2 sm:p-6 lg:p-8">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Edit Profile</CardTitle>
                    <CardDescription>Update your personal details and change your password.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProfileForm />
                </CardContent>
            </Card>
        </div>
    )
}
