'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, getDocs, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import type { Event, EventStatus, WithId } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn, getEventStatus } from '@/lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// --- Main component with list of events ---

const eventStatusDetails: { [key in EventStatus]: { label: string, className: string } } = {
    'ongoing': { label: 'Ongoing', className: 'bg-green-500' },
    'upcoming': { label: 'Upcoming', className: 'bg-blue-500' },
    'completed': { label: 'Completed', className: 'bg-muted text-muted-foreground' },
    'cancelled': { label: 'Cancelled', className: 'bg-destructive' },
};


export function EventManagement() {
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<WithId<Event> | null>(null);

    const eventsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'events'), orderBy('startDate', 'desc'));
    }, [firestore]);

    const { data: events, isLoading } = useCollection<WithId<Event>>(eventsQuery);
    
    const handleDeleteClick = (event: WithId<Event>) => {
        setEventToDelete(event);
        setDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (!firestore || !storage || !eventToDelete) return;
        setIsDeleting(true);

        try {
            const batch = writeBatch(firestore);

            // 1. Delete registrations subcollection
            const registrationsRef = collection(firestore, 'events', eventToDelete.id, 'registrations');
            const registrationsSnapshot = await getDocs(registrationsRef);
            registrationsSnapshot.forEach(doc => batch.delete(doc.ref));

            // 2. Delete associated matches
            const matchesQuery = query(collection(firestore, 'matches'), where('eventId', '==', eventToDelete.id));
            const matchesSnapshot = await getDocs(matchesQuery);
            matchesSnapshot.forEach(doc => batch.delete(doc.ref));

            // 3. Delete the main event document
            const eventRef = doc(firestore, 'events', eventToDelete.id);
            batch.delete(eventRef);

            // Commit all batched writes
            await batch.commit();

            // 4. Delete banner image from storage, if it exists
            if (eventToDelete.bannerUrl) {
                try {
                    const imageRef = ref(storage, eventToDelete.bannerUrl);
                    await deleteObject(imageRef);
                } catch (storageError: any) {
                    // Don't fail the whole operation if image deletion fails, just log it.
                    if (storageError.code !== 'storage/object-not-found') {
                        console.warn(`Could not delete event banner image:`, storageError);
                    }
                }
            }

            toast({ title: "Event Deleted", description: `"${eventToDelete.name}" and all associated data have been deleted.` });

        } catch (e) {
            console.error("Error deleting event:", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete the event.' });
        } finally {
            setIsDeleting(false);
            setDeleteAlertOpen(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button asChild>
                    <Link href="/admin/events/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Event
                    </Link>
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Event Name</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-center">Participants</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                           <>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-24 mx-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-28 ml-auto" /></TableCell>
                                    </TableRow>
                                ))}
                            </>
                        ) : events && events.length > 0 ? (
                            events.map(event => {
                                const status = getEventStatus(event);
                                const details = eventStatusDetails[status];
                                return (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{event.name}</TableCell>
                                        <TableCell>{format(event.startDate.toDate(), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="text-center">
                                            {event.participantIds.length} / {event.maxParticipants}
                                            {event.waitlistIds.length > 0 && ` (+${event.waitlistIds.length})`}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(details.className)}>{details.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/admin/events/${event.id}`}>
                                                    <Users className="mr-2 h-4 w-4" />
                                                    Manage
                                                </Link>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(event)} className="ml-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No events found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the event "{eventToDelete?.name}". This includes all registrations and match records for this event. Player stats from these matches will <span className="font-bold text-destructive">NOT</span> be reverted. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                           {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                           Delete Event
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
