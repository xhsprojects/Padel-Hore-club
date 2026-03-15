'use client';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, writeBatch, arrayUnion, updateDoc, arrayRemove, Timestamp, setDoc } from 'firebase/firestore';
import type { Event, EventRegistration, WithId, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Trash2, Edit, Swords, CheckCircle, Hourglass, ShieldAlert, UserPlus, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EditEventForm } from '@/components/admin/edit-event-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { sendPushNotification } from '@/actions/send-push-notification';

export default function AdminEventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [userToRemove, setUserToRemove] = useState<WithId<EventRegistration> | null>(null);

    const eventRef = useMemoFirebase(() => firestore ? doc(firestore, 'events', id) : null, [firestore, id]);
    const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

    const registrationsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'events', id, 'registrations')) : null, [firestore, id]);
    const { data: registrations, isLoading: registrationsLoading } = useCollection<WithId<EventRegistration>>(registrationsQuery);
    
    const allUsersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
    const { data: allUsers, isLoading: allUsersLoading } = useCollection<WithId<UserProfile>>(allUsersQuery);

    const { confirmed, waitlisted } = useMemo(() => {
        const confirmed: WithId<EventRegistration>[] = [];
        const waitlisted: WithId<EventRegistration>[] = [];
        registrations?.forEach(reg => {
            if (reg.status === 'confirmed') confirmed.push(reg);
            else if (reg.status === 'waitlisted') waitlisted.push(reg);
        });
        return { confirmed, waitlisted };
    }, [registrations]);

    const handleRemoveUser = async () => {
        if (!firestore || !userToRemove || !event) return;
        setIsProcessing(true);

        const batch = writeBatch(firestore);
        const registrationRef = doc(firestore, 'events', event.id, 'registrations', userToRemove.userId);
        const eventDocRef = doc(firestore, 'events', event.id);

        batch.delete(registrationRef);

        if (userToRemove.status === 'confirmed') {
            batch.update(eventDocRef, { participantIds: arrayRemove(userToRemove.userId) });
            // Promote from waitlist if possible
            const firstWaitlisted = waitlisted.sort((a,b) => a.registrationTimestamp.toMillis() - b.registrationTimestamp.toMillis())[0];
            if(firstWaitlisted) {
                const promotedRegRef = doc(firestore, 'events', event.id, 'registrations', firstWaitlisted.userId);
                batch.update(eventDocRef, {
                    participantIds: arrayUnion(firstWaitlisted.userId),
                    waitlistIds: arrayRemove(firstWaitlisted.userId)
                });
                batch.update(promotedRegRef, { status: 'confirmed' });
            }
        } else {
             batch.update(eventDocRef, { waitlistIds: arrayRemove(userToRemove.userId) });
        }

        try {
            await batch.commit();
            toast({ title: 'Success', description: `${userToRemove.userName} has been removed from the event.` });
            setUserToRemove(null);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not remove the user.' });
        } finally {
            setIsProcessing(false);
        }
    };

    const isLoading = eventLoading || registrationsLoading || allUsersLoading;

    if (isLoading) {
        return <div className="p-8"><Skeleton className="h-96 w-full"/></div>
    }
    
    if (!event) notFound();

    return (
        <>
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <Button variant="outline" onClick={() => router.push('/admin/events')} className="mb-2">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Event List
                            </Button>
                            <h1 className="font-headline text-3xl">{event.name}</h1>
                            <p className="text-muted-foreground">Manage event details and participants.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <AddParticipantDialog event={event} registrations={registrations || []} allUsers={allUsers || []} />
                            <Button asChild variant="outline"><Link href={`/admin/events/${id}/scanner`}><QrCode className="mr-2 h-4 w-4"/>Check-in Scanner</Link></Button>
                            <Button asChild variant="outline"><Link href={`/admin/event-matches/${id}`}><Swords className="mr-2 h-4 w-4"/>Manage Matches</Link></Button>
                            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}><DialogTrigger asChild><Button variant="outline"><Edit className="mr-2 h-4 w-4"/>Edit Details</Button></DialogTrigger><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Edit Event</DialogTitle><DialogDescription>Update the details for {event.name}.</DialogDescription></DialogHeader><EditEventForm event={event} setOpen={setIsEditDialogOpen} /></DialogContent></Dialog>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <ParticipantCard 
                            title="Confirmed Participants" 
                            icon={CheckCircle} 
                            registrations={confirmed} 
                            onRemoveClick={setUserToRemove}
                            event={event}
                        />
                         <ParticipantCard 
                            title="Waitlist" 
                            icon={Hourglass} 
                            registrations={waitlisted}
                            onRemoveClick={setUserToRemove}
                            event={event}
                        />
                    </div>
                </div>
            </div>
            
            <AlertDialog open={!!userToRemove} onOpenChange={(open) => !open && setUserToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove {userToRemove?.userName}?</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to remove this user from the event? This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveUser} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Remove"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function ParticipantCard({ title, icon: Icon, registrations, onRemoveClick, event }: { title: string, icon: React.ElementType, registrations: WithId<EventRegistration>[], onRemoveClick: (user: WithId<EventRegistration>) => void, event: WithId<Event> }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5"/>
                    {title} ({registrations.length}{title === 'Confirmed Participants' && `/${event.maxParticipants}`})
                </CardTitle>
            </CardHeader>
            <CardContent>
                {registrations.length > 0 ? (
                    <div className="space-y-3">
                        {registrations.map(reg => (
                            <div key={reg.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={reg.userPhotoUrl || undefined}/>
                                        <AvatarFallback>{reg.userName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-semibold text-sm">{reg.userName}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemoveClick(reg)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center p-4">No users in this list.</p>
                )}
            </CardContent>
        </Card>
    )
}

function AddParticipantDialog({ event, registrations, allUsers }: { event: WithId<Event>, registrations: WithId<EventRegistration>[], allUsers: WithId<UserProfile>[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [guestName, setGuestName] = useState('');
    const [isCreatingGuest, setIsCreatingGuest] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const registeredUserIds = useMemo(() => new Set(registrations.map(r => r.userId)), [registrations]);

    const availableUsers = useMemo(() => {
        return allUsers
            .filter(u => !registeredUserIds.has(u.id) && u.role !== 'admin' && u.role !== 'guest')
            .filter(u => u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allUsers, registeredUserIds, searchTerm]);
    
    const handleAddParticipant = async (user: WithId<UserProfile>) => {
        if (!firestore) return;
        setIsSubmitting(user.id);

        const isFull = event.participantIds.length >= event.maxParticipants;
        const newStatus = isFull ? 'waitlisted' : 'confirmed';

        const batch = writeBatch(firestore);
        const registrationRef = doc(firestore, 'events', event.id, 'registrations', user.id);
        const eventRef = doc(firestore, 'events', event.id);
        
        batch.set(registrationRef, {
            userId: user.id,
            userName: user.name,
            userPhotoUrl: user.photoURL || null,
            registrationTimestamp: Timestamp.now(),
            status: newStatus,
        });

        if (isFull) {
            batch.update(eventRef, { waitlistIds: arrayUnion(user.id) });
        } else {
            batch.update(eventRef, { participantIds: arrayUnion(user.id) });
        }
        
        // Don't send notification to guest users
        if (user.role !== 'guest') {
            const notificationRef = doc(collection(firestore, 'users', user.id, 'notifications'));
            batch.set(notificationRef, {
                uid: user.id,
                title: `You've been added to an event!`,
                body: `An admin has added you to "${event.name}".`,
                timestamp: Timestamp.now(),
                isRead: false,
                link: `/events/${event.id}`,
                icon: 'CalendarPlus'
            });
        }


        try {
            await batch.commit();
            
            if (user.role !== 'guest' && user.fcmTokens && user.fcmTokens.length > 0) {
                await sendPushNotification(user.fcmTokens, {
                    title: `You've been added to an event!`,
                    body: `An admin has added you to "${event.name}".`,
                    link: `/events/${event.id}`
                });
            }
            
            toast({
                title: "Participant Added",
                description: `${user.name} has been added to the ${isFull ? 'waitlist' : 'confirmed list'}.`,
            });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add participant.' });
        } finally {
            setIsSubmitting(null);
        }
    };

    const handleCreateGuest = async () => {
        if (!guestName.trim() || !firestore) return;
        setIsCreatingGuest(true);
        try {
            const newGuestRef = doc(collection(firestore, 'users'));
            const newGuestProfile: Omit<UserProfile, 'id'|'phId'|'email'|'whatsapp'|'membershipExpiryDate'> = {
                uid: newGuestRef.id,
                name: guestName.trim(),
                role: 'guest',
                total_points: 0,
                tier: 'beginner',
                win_count: 0,
                match_count: 0,
                photoURL: null,
                win_streak: 0,
            };
            await setDoc(newGuestRef, newGuestProfile);
            
            // Immediately add the new guest to the event
            await handleAddParticipant({ id: newGuestRef.id, ...newGuestProfile });
            
            toast({ title: "Guest Created & Added", description: `${guestName.trim()} has been added to the event.` });
            setGuestName('');
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create guest participant.' });
        } finally {
            setIsCreatingGuest(false);
        }
    };


    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="outline"><UserPlus className="mr-2 h-4 w-4"/>Add Participant</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90dvh] flex flex-col">
                <SheetHeader className="text-center pt-4">
                    <SheetTitle>Add Participant</SheetTitle>
                    <SheetDescription>Select a user or create a guest to add to the event.</SheetDescription>
                </SheetHeader>
                <div className="p-4 border-b">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">CREATE GUEST PARTICIPANT</p>
                    <div className="flex gap-2">
                        <Input placeholder="Guest Name" value={guestName} onChange={e => setGuestName(e.target.value)} />
                        <Button onClick={handleCreateGuest} disabled={isCreatingGuest || !guestName.trim()}>
                            {isCreatingGuest ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Create'}
                        </Button>
                    </div>
                </div>
                 <div className="p-4 pt-4">
                    <Input 
                        placeholder="Search existing users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 p-4 pt-0">
                        {availableUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={user.photoURL || undefined}/>
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-semibold text-sm">{user.name}</span>
                                </div>
                                <Button size="sm" onClick={() => handleAddParticipant(user)} disabled={!!isSubmitting}>
                                    {isSubmitting === user.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Add'}
                                </Button>
                            </div>
                        ))}
                         {availableUsers.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center p-4">No available users found.</p>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
