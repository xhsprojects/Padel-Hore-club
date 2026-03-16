'use client';

import { useMemo } from 'react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Event, WithId } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { EventCard } from '@/components/events/event-card';
import { getEventStatus } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

function EventCardSkeleton() {
    return (
        <Card className="flex flex-col overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-3/4 pt-2" />
                <Skeleton className="h-4 w-1/2 pt-1" />
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
}

export function EventListClient() {
    const { firestore } = useFirebase();

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'events'), orderBy('startDate', 'desc'));
    }, [firestore]);

    const { data: events, isLoading } = useCollection<WithId<Event>>(eventsQuery);

    const { ongoingEvents, upcomingEvents, pastEvents } = useMemo(() => {
        if (!events) return { ongoingEvents: [], upcomingEvents: [], pastEvents: [] };
        
        const ongoing: WithId<Event>[] = [];
        const upcoming: WithId<Event>[] = [];
        const past: WithId<Event>[] = []; // This will include completed and cancelled

        events.forEach(event => {
            const status = getEventStatus(event);
            if (status === 'ongoing') {
                ongoing.push(event);
            } else if (status === 'upcoming') {
                upcoming.push(event);
            } else { // completed or cancelled
                past.push(event);
            }
        });
        
        // sort upcoming events ascending (closest first)
        upcoming.sort((a,b) => a.startDate.toMillis() - b.startDate.toMillis());
        // ongoing should also be sorted ascending
        ongoing.sort((a,b) => a.startDate.toMillis() - b.startDate.toMillis());

        return { ongoingEvents: ongoing, upcomingEvents: upcoming, pastEvents: past };
    }, [events]);

    if (isLoading) {
        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <EventCardSkeleton />
                <EventCardSkeleton />
                <EventCardSkeleton />
            </div>
        );
    }

    if (!events || events.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    There are no events scheduled at the moment.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-8">
            {ongoingEvents.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4">Ongoing Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ongoingEvents.map(event => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                </div>
            )}
            {upcomingEvents.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4">Upcoming Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingEvents.map(event => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                </div>
            )}
            {pastEvents.length > 0 && (
                 <div>
                    <h2 className="text-xl font-bold mb-4">Past Events</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pastEvents.map(event => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
