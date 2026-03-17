'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { doc, collection, query, where, writeBatch, Timestamp, getDocs } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { sendPushNotification } from '@/actions/send-push-notification';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

const NotificationFormSchema = z.object({
  target: z.enum(['all', 'members', 'non-members'], { required_error: 'Please select a target audience.' }),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title cannot exceed 100 characters'),
  body: z.string().min(10, 'Body must be at least 10 characters').max(500, 'Body cannot exceed 500 characters'),
  link: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  linkButtonText: z.string().max(30, 'Button text cannot exceed 30 characters').optional(),
});


type NotificationFormValues = z.infer<typeof NotificationFormSchema>;

export default function AdminNotificationsPage() {
    const { user, auth, isUserLoading } = useFirebase();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<NotificationFormValues>({
        resolver: zodResolver(NotificationFormSchema),
        defaultValues: {
            target: undefined,
            title: '',
            body: '',
            link: '',
            linkButtonText: '',
        },
    });

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

    const handleSendNotification = async (data: NotificationFormValues) => {
        console.log('AdminNotif: Start sending...', data);
        setIsSending(true);
        setError(null);
        
        if (!firestore || !auth?.currentUser) {
            console.error('AdminNotif: Firestore or Auth not available');
            setError('Firestore not available or user not authenticated');
            setIsSending(false);
            return;
        }

        try {
            console.log('AdminNotif: Fetching users...');
            const usersCollectionRef = collection(firestore, 'users');
            let usersQuery;

            if (data.target === 'all') {
                usersQuery = query(usersCollectionRef);
            } else {
                 const roleTarget = data.target === 'members' ? 'member' : 'non-member';
                usersQuery = query(usersCollectionRef, where('role', '==', roleTarget));
            }

            const usersSnapshot = await getDocs(usersQuery);
            console.log(`AdminNotif: Found ${usersSnapshot.size} users.`);
            
            if (usersSnapshot.empty) {
                toast({ variant: 'destructive', title: 'No Users Found', description: `There are no users matching the target: ${data.target}` });
                setIsSending(false);
                return;
            }

            const batch = writeBatch(firestore);
            let count = 0;
            const fcmTokens: string[] = [];

            usersSnapshot.forEach((userDoc) => {
                const member = userDoc.data() as UserProfile;
                const targetUid = userDoc.id; 
                
                if (!targetUid || targetUid === auth.currentUser?.uid) {
                    console.log(`AdminNotif: Skipping user ${targetUid} (is self or empty)`);
                    return;
                }

                // Add in-app notification to batch
                const notifRef = doc(collection(firestore, 'users', targetUid, 'notifications'));
                batch.set(notifRef, {
                    uid: targetUid,
                    title: data.title,
                    body: data.body,
                    link: data.link || null,
                    linkButtonText: data.linkButtonText || null,
                    timestamp: Timestamp.now(),
                    isRead: false,
                    icon: 'Megaphone'
                });

                // Collect FCM tokens for push notification
                if (member.fcmTokens && Array.isArray(member.fcmTokens)) {
                    // Filter to ensure only valid non-empty strings are sent
                    const validTokens = member.fcmTokens.filter(t => t && typeof t === 'string' && t.trim().length > 0);
                    fcmTokens.push(...validTokens);
                }
                count++;
            });

            console.log(`AdminNotif: Committing batch for ${count} users...`);
            await batch.commit();
            console.log('AdminNotif: Batch committed.');

            let pushDetails = "No push tokens found.";
            let pushSuccess = true;

            // Send push notifications
            if (fcmTokens.length > 0) {
                console.log(`AdminNotif: Sending push notifications to ${fcmTokens.length} tokens...`);
                try {
                    const pushResult = await sendPushNotification(fcmTokens, {
                        title: data.title,
                        body: data.body,
                        link: data.link || undefined,
                    });

                    if (pushResult.success) {
                        console.log('AdminNotif: Push result:', pushResult);
                        pushDetails = `Push: ${pushResult.successCount} ok, ${pushResult.failureCount} failed. [Init: ${pushResult.initStatus || '?'}]`;
                    } else {
                        console.error('AdminNotif: Push failed.', pushResult.error, pushResult.initStatus);
                        pushDetails = `Push Error: ${pushResult.error} [Init: ${pushResult.initStatus || '?'}]`;
                        pushSuccess = false;
                    }
                } catch (pushErr) {
                    console.error('AdminNotif: Critical error in push action:', pushErr);
                    pushDetails = `Push API Error: ${pushErr instanceof Error ? pushErr.message : String(pushErr)}`;
                    pushSuccess = false;
                }
            }

            console.log('AdminNotif: Showing final toast.');
            toast({ 
                variant: pushSuccess ? 'default' : 'destructive',
                title: pushSuccess ? 'Notifications Sent!' : 'Partial Success', 
                description: `In-app: ${count} users. ${pushDetails}` 
            });
            form.reset();

        } catch (err) {
            console.error('AdminNotif: Failed to send notifications:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed to send' });
        } finally {
            console.log('AdminNotif: Routine finished.');
            setIsSending(false);
        }
    };
    
    if (isUserLoading || isProfileLoading || !user) {
        return (
                 <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-24 w-full" /></div>
                            <Skeleton className="h-10 w-48" />
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
                            <CardDescription>You do not have permission to view this page.</CardDescription>
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
                        <CardTitle className="font-headline text-2xl">Send Notification</CardTitle>
                        <CardDescription>Compose and send a notification to a targeted group of users.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSendNotification)} className="space-y-6">
                                {error && (
                                    <Alert variant="destructive">
                                        <Terminal className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}
                                <FormField
                                    control={form.control}
                                    name="target"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Audience</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select who to send to..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="all">All Users</SelectItem>
                                                    <SelectItem value="members">Members Only</SelectItem>
                                                    <SelectItem value="non-members">Non-Members Only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title</FormLabel>
                                            <FormControl><Input placeholder="e.g. Special Event This Weekend!" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="body"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Body</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="e.g. Join us for a fun match this Saturday at 3 PM. All levels welcome!"
                                                    className="min-h-[120px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="link"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Optional Link</FormLabel>
                                            <FormControl><Input placeholder="https://example.com/more-info" {...field} /></FormControl>
                                            <FormDescription>If provided, a button will appear in the notification details.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="linkButtonText"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Link Button Text</FormLabel>
                                            <FormControl><Input placeholder="e.g. View Event" {...field} /></FormControl>
                                            <FormDescription>Custom text for the button. Defaults to "View Details".</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSending} className="w-full sm:w-auto">
                                    <Send className="mr-2 h-4 w-4" />
                                    {isSending ? 'Sending...' : 'Send Notification'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
    );
}
