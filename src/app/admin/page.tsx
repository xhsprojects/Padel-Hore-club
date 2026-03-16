'use client';

import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MatchForm } from '@/components/admin/match-form';
import { useCollection, useFirebase, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile, WithId } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

// We need to wrap the page in Suspense for useSearchParams to work reliably.
function AdminPageContents() {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const prefilledPlayerIds = searchParams.get('players')?.split(',');
    const prefillOnTime = searchParams.get('onTime') === 'true';
    const eventId = searchParams.get('eventId');
    const roundNumber = searchParams.get('roundNumber');

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const playersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Order by points to get the current leaderboard for ranking logic
        return query(collection(firestore, 'users'), orderBy('total_points', 'desc'));
    }, [firestore]);

    const { data: players, isLoading: playersLoading } = useCollection<WithId<UserProfile>>(playersQuery);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        } else if (!isUserLoading && user && !eventId) {
            toast({ 
                variant: 'destructive', 
                title: 'No Event Selected', 
                description: 'Please select an event to create a match.' 
            });
            router.push('/admin/event-matches');
        }
    }, [isUserLoading, user, router, eventId, toast]);

    if (isUserLoading || isProfileLoading || playersLoading || !user) {
        return (
                <div className="p-2 sm:p-6 lg:p-8">
                     <Card className="max-w-4xl mx-auto bg-card">
                        <CardHeader className="text-center">
                            <Skeleton className="h-7 w-72 mx-auto" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-96 w-full" />
                        </CardContent>
                    </Card>
                </div>
        )
    }
    
    const isDefaultAdmin = user.uid === DEFAULT_ADMIN_UID;
    const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;

    if (!isAdmin) {
        router.push('/');
        return null;
    }

    return (
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto bg-card">
                    <CardHeader className="text-center">
                        <CardTitle className="font-black text-2xl uppercase tracking-widest">Input Match Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {players ? (
                            <MatchForm 
                                allPlayers={players} 
                                prefilledPlayerIds={prefilledPlayerIds}
                                prefillOnTime={prefillOnTime}
                                eventId={eventId || undefined}
                                roundNumber={roundNumber ? parseInt(roundNumber) : undefined}
                            />
                        ) : (
                            <p>No players found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
    )
}

export default function AdminPage() {
    return (
        <Suspense fallback={
                 <div className="p-2 sm:p-6 lg:p-8">
                     <Card className="max-w-4xl mx-auto bg-card">
                        <CardHeader className="text-center">
                            <Skeleton className="h-7 w-72 mx-auto" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-96 w-full" />
                        </CardContent>
                    </Card>
                </div>
        }>
            <AdminPageContents />
        </Suspense>
    );
}
