'use client';

import type { Event, WithId, EventStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn, getEventStatus } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

interface EventCardProps {
    event: WithId<Event>;
}

const eventStatusDetails: { [key in EventStatus]: { label: string, className: string } } = {
    'ongoing': { label: 'Ongoing', className: 'bg-green-500 text-white animate-pulse' },
    'upcoming': { label: 'Upcoming', className: 'bg-blue-500 text-white' },
    'completed': { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' },
    'cancelled': { label: 'Cancelled', className: 'bg-destructive text-destructive-foreground' },
}

export function EventCard({ event }: EventCardProps) {
    const status = getEventStatus(event);
    const details = eventStatusDetails[status];

    return (
        <Card className="flex flex-col overflow-hidden">
            <div className="relative h-40 w-full bg-muted">
                {event.bannerUrl ? (
                    <Image src={event.bannerUrl} alt={event.name} fill className="object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <Calendar className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                )}
            </div>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <Badge className={cn(details.className)}>{details.label}</Badge>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{event.participantIds.length} / {event.maxParticipants}</span>
                        </div>
                    </div>
                </div>
                <CardTitle className="pt-2">{event.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-sm pt-1">
                    <Calendar className="h-4 w-4" />
                    {format(event.startDate.toDate(), 'dd MMM yyyy')}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
            </CardContent>
            <CardFooter>
                 <Button asChild className="w-full">
                    <Link href={`/events/${event.id}`}>View Details</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
