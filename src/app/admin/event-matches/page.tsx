'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Event, WithId, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function SelectEventForMatchesPage() {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'events'), where('status', 'in', ['upcoming', 'ongoing']));
    }, [firestore]);

    const { data: events, isLoading: eventsLoading } = useCollection<WithId<Event>>(eventsQuery);

    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;

    if (!isUserLoading && !isProfileLoading && !isAdmin) {
        router.push('/');
        return null;
    }

    const isLoading = isUserLoading || isProfileLoading || eventsLoading;

    return (
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Select an Event</CardTitle>
                        <CardDescription>
                            Choose an ongoing or upcoming event to manage its matches and rounds.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : events && events.length > 0 ? (
                            <div className="space-y-3">
                                {events.map(event => (
                                    <Link key={event.id} href={`/admin/event-matches/${event.id}`}>
                                        <Card className="hover:bg-accent transition-colors">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold">{event.name}</p>
                                                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                        <Calendar className="h-4 w-4" />
                                                        {format(event.startDate.toDate(), 'dd MMMM yyyy')}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                No ongoing or upcoming events found.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
    );
}
