'use client';

import { useState } from 'react';
import { useFirebase } from '@/firebase';
import type { Event, EventRegistration, WithId, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, deleteDoc, Timestamp, writeBatch, arrayUnion, arrayRemove, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Loader2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getEventStatus } from '@/lib/utils';
import { sendPushNotification } from '@/actions/send-push-notification';

interface EventRegistrationManagerProps {
    event: WithId<Event>;
    registrations: WithId<EventRegistration>[];
}

export function EventRegistrationManager({ event, registrations }: EventRegistrationManagerProps) {
    const { firestore, user, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const status = getEventStatus(event);

    if (status !== 'upcoming' && status !== 'ongoing') {
        return <Button disabled className="w-full mt-6">Registration Closed</Button>;
    }

    if (isUserLoading) {
        return <Button disabled className="w-full mt-6"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</Button>;
    }

    if (!user) {
        return <Button onClick={() => router.push('/login')} className="w-full mt-6"><LogIn className="mr-2 h-4 w-4" />Login to Register</Button>;
    }

    const userRegistration = registrations.find(r => r.userId === user.uid);
    const isRegistered = !!userRegistration;
    const isOnWaitlist = userRegistration?.status === 'waitlisted';
    const isFull = event.participantIds.length >= event.maxParticipants;
    const isWaitlistFull = event.waitlistIds.length >= 10; // Simple cap for now

    const handleRegister = async () => {
        if (!firestore || !user?.displayName) return;
        setIsSubmitting(true);
        
        const registrationRef = doc(firestore, 'events', event.id, 'registrations', user.uid);
        const eventRef = doc(firestore, 'events', event.id);
        const shouldWaitlist = isFull;

        const batch = writeBatch(firestore);

        // 1. Create/update the registration document
        batch.set(registrationRef, {
            userId: user.uid,
            userName: user.displayName,
            userPhotoUrl: user.photoURL || null,
            registrationTimestamp: Timestamp.now(),
            status: shouldWaitlist ? 'waitlisted' : 'confirmed',
        });

        // 2. Update the main event document's participant/waitlist array
        if (shouldWaitlist) {
            batch.update(eventRef, { waitlistIds: arrayUnion(user.uid) });
        } else {
            batch.update(eventRef, { participantIds: arrayUnion(user.uid) });
        }
        
        try {
            await batch.commit();

            // Send notification to admins (best-effort, suppress errors)
            try {
                const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
                const adminsSnapshot = await getDocs(adminsQuery);
                const adminNotifBatch = writeBatch(firestore);
                const adminFcmTokens: string[] = [];

                adminsSnapshot.forEach(adminDoc => {
                    const adminId = adminDoc.id;
                    const notifRef = doc(collection(firestore, 'users', adminId, 'notifications'));
                    adminNotifBatch.set(notifRef, {
                        uid: adminId,
                        title: 'Pendaftaran Event Baru!',
                        body: `${user.displayName} telah mendaftar di acara "${event.name}".`,
                        timestamp: Timestamp.now(),
                        isRead: false,
                        link: `/admin/events/${event.id}`,
                        icon: 'CalendarPlus'
                    });
                    const adminData = adminDoc.data() as UserProfile;
                    if (adminData.fcmTokens) {
                        adminFcmTokens.push(...adminData.fcmTokens);
                    }
                });
                await adminNotifBatch.commit();
                
                if (adminFcmTokens.length > 0) {
                     await sendPushNotification(adminFcmTokens, {
                        title: 'Pendaftaran Event Baru!',
                        body: `${user.displayName} telah mendaftar di acara "${event.name}".`,
                        link: `/admin/events/${event.id}`
                    });
                }
            } catch (notifError) {
                console.warn("Could not send admin notification, but registration was successful.", notifError);
            }


            toast({
                title: 'Registration Successful!',
                description: shouldWaitlist ? "You've been added to the waitlist." : "Your spot is confirmed. See you there!",
            });
        } catch (error) {
            console.error('Error registering for event:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not complete your registration.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!firestore || !user?.displayName) return;
        setIsSubmitting(true);

        const registrationRef = doc(firestore, 'events', event.id, 'registrations', user.uid);
        const eventRef = doc(firestore, 'events', event.id);
        
        let userToPromoteId: string | null = null;
        if (!isOnWaitlist && event.waitlistIds.length > 0) {
            userToPromoteId = event.waitlistIds[0];
        }

        const batch = writeBatch(firestore);
        
        // 1. Delete the user's registration document
        batch.delete(registrationRef);
        
        // 2. Remove user from the correct array in the main event doc
        if (isOnWaitlist) {
            batch.update(eventRef, { waitlistIds: arrayRemove(user.uid) });
        } else {
            batch.update(eventRef, { participantIds: arrayRemove(user.uid) });
            
            // 3. If a confirmed user cancels AND there's a waitlist, promote the first person
            if (userToPromoteId) {
                const userToPromoteRef = doc(firestore, 'events', event.id, 'registrations', userToPromoteId);

                batch.update(eventRef, { 
                    participantIds: arrayUnion(userToPromoteId),
                    waitlistIds: arrayRemove(userToPromoteId) 
                });
                batch.update(userToPromoteRef, { status: 'confirmed' });
                
                const notifRef = doc(collection(firestore, 'users', userToPromoteId, 'notifications'));
                batch.set(notifRef, {
                    uid: userToPromoteId,
                    title: "Anda Berhasil Masuk Event!",
                    body: `Sebuah slot telah terbuka di acara "${event.name}". Anda telah dipindahkan dari daftar tunggu ke daftar peserta.`,
                    timestamp: Timestamp.now(),
                    isRead: false,
                    link: `/events/${event.id}`,
                    icon: 'CalendarCheck'
                });
            }
        }

        try {
            await batch.commit();
            
            // Send push notification to promoted user
            if (userToPromoteId) {
                const userDoc = await getDoc(doc(firestore, 'users', userToPromoteId));
                if (userDoc.exists()) {
                    const userProfile = userDoc.data() as UserProfile;
                    if (userProfile.fcmTokens && userProfile.fcmTokens.length > 0) {
                        await sendPushNotification(userProfile.fcmTokens, {
                            title: "Anda Berhasil Masuk Event!",
                            body: `Sebuah slot telah terbuka di acara "${event.name}". Anda telah dipindahkan dari daftar tunggu ke daftar peserta.`,
                            link: `/events/${event.id}`
                        });
                    }
                }
            }

            // Notify admins of cancellation (best-effort)
            try {
                const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
                const adminsSnapshot = await getDocs(adminsQuery);
                const adminNotifBatch = writeBatch(firestore);
                const adminFcmTokens: string[] = [];

                adminsSnapshot.forEach(adminDoc => {
                    const adminId = adminDoc.id;
                    let notifBody = `${user.displayName} telah membatalkan pendaftaran dari acara "${event.name}".`;
                    if (!isOnWaitlist && event.waitlistIds.length > 0) {
                        notifBody += ` Slot yang kosong telah diisi oleh orang pertama dari daftar tunggu.`
                    }
                    const notifRef = doc(collection(firestore, 'users', adminId, 'notifications'));
                    adminNotifBatch.set(notifRef, {
                        uid: adminId,
                        title: 'Pembatalan Pendaftaran Event',
                        body: notifBody,
                        timestamp: Timestamp.now(),
                        isRead: false,
                        link: `/admin/events/${event.id}`,
                        icon: 'ShieldAlert'
                    });
                    const adminData = adminDoc.data() as UserProfile;
                    if (adminData.fcmTokens) {
                        adminFcmTokens.push(...adminData.fcmTokens);
                    }
                });
                await adminNotifBatch.commit();

                if (adminFcmTokens.length > 0) {
                     let notifBody = `${user.displayName} telah membatalkan pendaftaran dari acara "${event.name}".`;
                    if (!isOnWaitlist && event.waitlistIds.length > 0) {
                        notifBody += ` Slot yang kosong telah diisi.`
                    }
                     await sendPushNotification(adminFcmTokens, {
                        title: 'Pembatalan Pendaftaran Event',
                        body: notifBody,
                        link: `/admin/events/${event.id}`
                    });
                }
            } catch (notifError) {
                console.warn("Could not send admin cancellation notification, but cancellation was successful.", notifError);
            }
            
            toast({
                title: 'Registration Cancelled',
                description: "You've been removed from the event list.",
            });
        } catch (error) {
            console.error('Error cancelling registration:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not cancel your registration.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isRegistered) {
        return <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting} className="w-full mt-6">{isSubmitting ? 'Cancelling...' : (isOnWaitlist ? 'Leave Waitlist' : 'Cancel Registration')}</Button>;
    }

    if (isFull) {
        if (isWaitlistFull) {
            return <Button disabled className="w-full mt-6">Event and Waitlist are Full</Button>;
        }
        return <Button variant="secondary" onClick={handleRegister} disabled={isSubmitting} className="w-full mt-6">{isSubmitting ? 'Joining Waitlist...' : 'Join Waitlist'}</Button>;
    }

    return <Button onClick={handleRegister} disabled={isSubmitting} className="w-full mt-6">{isSubmitting ? 'Registering...' : 'Register for Event'}</Button>;
}
