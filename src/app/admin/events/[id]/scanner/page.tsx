'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { Loader2, UserCheck, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import type { UserProfile, WithId, Event, EventRegistration, TierThresholds } from '@/lib/types';
import { doc, collection, query, Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { QrScanner } from '@/components/admin/qr-scanner';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getTier, capitalize, getEventStatus } from '@/lib/utils';
import { DEFAULT_THRESHOLDS } from '@/lib/constants';
import { ALL_BADGES } from '@/lib/badges';
import { sendPushNotification } from '@/actions/send-push-notification';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function EventScannerPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [isScanning, setIsScanning] = useState(true);
    
    // Auth and Admin checks
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    // Event data
    const eventRef = useMemoFirebase(() => {
        if (!firestore || !eventId) return null;
        return doc(firestore, 'events', eventId);
    }, [firestore, eventId]);
    const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

    // Registrations data (live)
    const registrationsQuery = useMemoFirebase(() => {
        if (!firestore || !eventId) return null;
        return query(collection(firestore, 'events', eventId, 'registrations'));
    }, [firestore, eventId]);
    const { data: registrations, isLoading: registrationsLoading } = useCollection<WithId<EventRegistration>>(registrationsQuery);

    const attendedPlayers = useMemo(() => {
        return registrations?.filter(r => r.attended).sort((a, b) => (b.checkInTimestamp?.toMillis() ?? 0) - (a.checkInTimestamp?.toMillis() ?? 0)) || [];
    }, [registrations]);
    
    // Redirect if not admin or logged out
    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleScanSuccess = async (decodedText: string) => {
        if (!registrations || !firestore || !event) return;

        setIsScanning(false); // Pause scanning to process

        try {
            const qrData = JSON.parse(decodedText);
            if (!qrData.uid || !qrData.timestamp) {
                throw new Error("Invalid QR code data.");
            }

            const now = Date.now();
            if (now - qrData.timestamp > 60000) { // 60-second validity
                toast({ variant: "destructive", title: "QR Code Expired", description: "Please ask the player to refresh their card." });
                setTimeout(() => setIsScanning(true), 1500);
                return;
            }

            const registration = registrations.find(r => r.userId === qrData.uid);
            
            if (!registration) {
                 toast({ variant: "destructive", title: "Not Registered", description: "This player is not registered for this event." });
                 setTimeout(() => setIsScanning(true), 1500);
                 return;
            }

            if (registration.attended) {
                toast({ title: "Already Checked In", description: `${registration.userName} has already been marked as attended.` });
                setTimeout(() => setIsScanning(true), 1500);
                return;
            }
            
            const batch = writeBatch(firestore);
            
            const registrationRef = doc(firestore, 'events', eventId, 'registrations', registration.id);
            batch.update(registrationRef, {
                attended: true,
                checkInTimestamp: Timestamp.now(),
            });

            const userProfileRef = doc(firestore, 'users', registration.userId);
            const userProfileSnap = await getDoc(userProfileRef);

            let userProfile: UserProfile | null = null;
            if (userProfileSnap.exists()) {
                userProfile = userProfileSnap.data() as UserProfile;
                const userProfileUpdates: Partial<UserProfile> = {};

                // Point and Tier logic
                if (event.attendancePoints && event.attendancePoints > 0) {
                    const newTotalPoints = (userProfile.total_points || 0) + event.attendancePoints;
                    const tierSettingsSnap = await getDoc(doc(firestore, 'settings', 'tier_thresholds'));
                    const thresholds = tierSettingsSnap.exists() ? tierSettingsSnap.data() as TierThresholds : DEFAULT_THRESHOLDS;
                    const newTier = getTier(newTotalPoints, thresholds);
                    const oldTier = userProfile.tier;

                    userProfileUpdates.total_points = newTotalPoints;
                    userProfileUpdates.tier = newTier;

                    const pointsNotifRef = doc(collection(firestore, 'users', registration.userId, 'notifications'));
                    batch.set(pointsNotifRef, {
                        uid: registration.userId,
                        title: 'Poin Kehadiran!',
                        body: `Kamu mendapatkan +${event.attendancePoints} poin karena telah hadir di acara "${event.name}".`,
                        timestamp: Timestamp.now(),
                        isRead: false,
                        link: `/events/${eventId}`,
                        icon: 'UserCheck'
                    });

                    if (newTier !== oldTier) {
                        const tierNotifRef = doc(collection(firestore, 'users', registration.userId, 'notifications'));
                        batch.set(tierNotifRef, {
                            uid: registration.userId,
                            title: "HORE! KAMU NAIK TIER!",
                            body: `Selamat! Kamu resmi naik kelas ke Tier ${capitalize(newTier)} setelah hadir di acara.`,
                            timestamp: Timestamp.now(),
                            isRead: false,
                            link: `/profile/share?type=tier-up&oldTier=${oldTier}&newTier=${newTier}`,
                            icon: 'Trophy'
                        });
                    }
                }

                // Badge logic
                const newEventAttendanceCount = (userProfile.eventAttendanceCount || 0) + 1;
                userProfileUpdates.eventAttendanceCount = newEventAttendanceCount;

                const EVENT_ENTHUSIAST_THRESHOLD = 5;
                const hasEventEnthusiastBadge = userProfile.badges?.some(b => b.badgeId === 'event-enthusiast');

                if (newEventAttendanceCount >= EVENT_ENTHUSIAST_THRESHOLD && !hasEventEnthusiastBadge) {
                    const badge = ALL_BADGES.find(b => b.id === 'event-enthusiast');
                    if (badge) {
                        const existingBadges = userProfile.badges || [];
                        userProfileUpdates.badges = [...existingBadges, { badgeId: 'event-enthusiast', timestamp: Timestamp.now() }];
                        
                        const badgeNotifRef = doc(collection(firestore, 'users', registration.userId, 'notifications'));
                        batch.set(badgeNotifRef, {
                            uid: registration.userId,
                            title: 'BADGE UNLOCKED!',
                            body: `Congratulations! You've earned the "${badge.name}" badge.`,
                            timestamp: Timestamp.now(),
                            isRead: false,
                            link: '/profile',
                            icon: 'CalendarCheck'
                        });
                    }
                }

                if (Object.keys(userProfileUpdates).length > 0) {
                    batch.update(userProfileRef, userProfileUpdates);
                }
            }
            
            await batch.commit();

            toast({ title: 'Check-in Successful!', description: `${registration.userName} has been marked as attended.` });

            setTimeout(() => setIsScanning(true), 500);

        } catch (e: any) {
            console.error(e);
            const errorMessage = e.message || "An unknown error occurred during check-in.";
            toast({ variant: "destructive", title: "Check-in Failed", description: errorMessage });
            setTimeout(() => setIsScanning(true), 1500);
        }
    };
    
    const pageIsLoading = isUserLoading || isProfileLoading || eventLoading || registrationsLoading;

    if (pageIsLoading) {
        return (
            <SidebarInset>
                <div className="p-4 sm:p-6 lg:p-8">
                    <div className="max-w-4xl mx-auto">
                        <Skeleton className="h-10 w-48 mb-4" />
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-8 items-start">
                                    <Skeleton className="w-full aspect-square rounded-lg" />
                                    <div className="space-y-4">
                                        <Skeleton className="h-7 w-48" />
                                        <Skeleton className="h-96 w-full rounded-md border" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </SidebarInset>
        );
    }
    
    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    if (userProfile?.role !== 'admin' && !isDefaultAdmin) {
        return (
            <SidebarInset>
                <div className="p-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                        <CardContent><p>You do not have permission to view this page.</p></CardContent>
                    </Card>
                </div>
            </SidebarInset>
        );
    }

    const status = event ? getEventStatus(event) : null;

    if (status !== 'ongoing') {
        return (
            <SidebarInset>
                <div className="p-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle>Check-in Not Active</CardTitle>
                            <CardDescription>
                                Check-in is only available for events that are currently ongoing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                This event is currently <span className="font-bold">{status}</span>.
                            </p>
                            <Button onClick={() => router.back()}>Back to Event Details</Button>
                        </CardContent>
                    </Card>
                </div>
            </SidebarInset>
        )
    }

    return (
        <SidebarInset>
            <div className="p-4 sm:p-6 lg:p-8">
                 <div className="max-w-4xl mx-auto">
                     <Button variant="outline" onClick={() => router.back()} className="mb-4">
                        <XCircle className="mr-2 h-4 w-4" />
                        Back to Event Details
                    </Button>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">Event Check-in: {event?.name}</CardTitle>
                            <CardDescription>Scan a player's QR card to mark them as attended.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-8 items-start">
                                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                    {isScanning ? (
                                        <QrScanner onScanSuccess={handleScanSuccess} />
                                    ) : (
                                        <div className="text-center p-4">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                                            <p className="text-muted-foreground">Processing scan...</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <UserCheck className="h-5 w-5" />
                                        Attended Players ({attendedPlayers.length} / {registrations?.length || 0})
                                    </h3>
                                    <ScrollArea className="h-96 w-full rounded-md border p-2">
                                        {attendedPlayers.length > 0 ? (
                                            <div className="space-y-3 p-2">
                                                {attendedPlayers.map(player => (
                                                     <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-background">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-10 w-10">
                                                                {player.userPhotoUrl && <AvatarImage src={player.userPhotoUrl} />}
                                                                <AvatarFallback>{player.userName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-semibold">{player.userName}</span>
                                                        </div>
                                                        <CheckCircle2 className="h-5 w-5 text-green-500"/>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-sm text-muted-foreground">Scan a player to begin check-in.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SidebarInset>
    );
}
