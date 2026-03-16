'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirebase } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import type { UserProfile } from '@/lib/types';
import { Logo } from '@/components/icons';
import { sendPushNotification } from '@/actions/send-push-notification';
import { Eye, EyeOff } from 'lucide-react';

const RegisterFormSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function RegisterPage() {
    const { auth, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(RegisterFormSchema),
        defaultValues: {
            name: '',
            whatsapp: '',
            email: '',
            password: '',
        },
    });

    const handleRegister = async (data: RegisterFormValues) => {
        try {
            if (!auth || !firestore) {
                throw new Error("Firebase is not initialized.");
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: data.name, photoURL: null });
            
            const phId = `PH-${user.uid.substring(0, 4).toUpperCase()}`;

            const newUserProfile: Omit<UserProfile, 'id' | 'membershipExpiryDate'> = {
                uid: user.uid,
                phId: phId,
                email: data.email,
                name: data.name,
                whatsapp: data.whatsapp,
                showWhatsapp: true,
                role: user.uid === DEFAULT_ADMIN_UID ? 'admin' : 'non-member',
                total_points: 0,
                tier: 'beginner',
                win_count: 0,
                match_count: 0,
                photoURL: null,
                win_streak: 0,
                fair_play_count: 0,
                early_bird_count: 0,
                night_owl_count: 0,
                eventAttendanceCount: 0,
                isUnlimitedMember: false,
                badges: [],
            };

            await setDoc(doc(firestore, 'users', user.uid), newUserProfile);
            
            try {
                const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
                const adminsSnapshot = await getDocs(adminsQuery);
                const adminNotifBatch = writeBatch(firestore);
                const adminFcmTokens: string[] = [];

                adminsSnapshot.forEach(adminDoc => {
                    const adminId = adminDoc.id;
                    if(adminId === user.uid) return;
                    const notifRef = doc(collection(firestore, 'users', adminId, 'notifications'));
                    adminNotifBatch.set(notifRef, {
                        uid: adminId,
                        title: 'Pengguna Baru Terdaftar!',
                        body: `Pengguna baru, ${data.name}, telah mendaftar di Padel Hore.`,
                        timestamp: Timestamp.now(),
                        isRead: false,
                        link: `/admin/players`,
                        icon: 'UserPlus'
                    });
                    const adminData = adminDoc.data() as UserProfile;
                    if (adminData.fcmTokens) {
                        adminFcmTokens.push(...adminData.fcmTokens);
                    }
                });

                await adminNotifBatch.commit();
            
                if (adminFcmTokens.length > 0) {
                    await sendPushNotification(adminFcmTokens, {
                        title: 'Pengguna Baru Terdaftar!',
                        body: `Pengguna baru, ${data.name}, telah mendaftar.`
                    });
                }
            } catch (notifError) {
                console.warn("Failed to send admin notifications, but registration was successful.", notifError);
            }


            toast({
                title: "Registration Successful",
                description: "You can now log in.",
            });
            router.push('/login');
        } catch (error) {
            console.error("Error registering: ", error);
            let errorMessage = "An unknown error occurred.";
            if (error instanceof FirebaseError) {
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'This email address is already in use by another account.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Please enter a valid email address.';
                }
            }
            toast({
                variant: 'destructive',
                title: 'Registration Failed',
                description: errorMessage,
            });
        }
    };

    const handleGoogleRegister = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userRef = doc(firestore!, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const phId = `PH-${user.uid.substring(0, 4).toUpperCase()}`;
                const newUserProfile: Omit<UserProfile, 'id' | 'membershipExpiryDate'> = {
                    uid: user.uid,
                    phId: phId,
                    email: user.email || '',
                    name: user.displayName || 'Guest Player',
                    whatsapp: '',
                    showWhatsapp: true,
                    role: user.uid === DEFAULT_ADMIN_UID ? 'admin' : 'non-member',
                    total_points: 0,
                    tier: 'beginner',
                    win_count: 0,
                    match_count: 0,
                    photoURL: user.photoURL,
                    win_streak: 0,
                    fair_play_count: 0,
                    early_bird_count: 0,
                    night_owl_count: 0,
                    eventAttendanceCount: 0,
                    isUnlimitedMember: false,
                    badges: [],
                };

                await setDoc(userRef, newUserProfile);
                
                // Optional: Notify admins about new user
                try {
                    const adminsQuery = query(collection(firestore!, 'users'), where('role', '==', 'admin'));
                    const adminsSnapshot = await getDocs(adminsQuery);
                    const adminNotifBatch = writeBatch(firestore!);
                    
                    adminsSnapshot.forEach(adminDoc => {
                         const adminId = adminDoc.id;
                         if(adminId === user.uid) return;
                         const notifRef = doc(collection(firestore!, 'users', adminId, 'notifications'));
                         adminNotifBatch.set(notifRef, {
                             uid: adminId,
                             title: 'Pengguna Baru Terdaftar (Google)',
                             body: `Pengguna baru, ${newUserProfile.name}, telah mendaftar via Google.`,
                             timestamp: Timestamp.now(),
                             isRead: false,
                             link: `/admin/players`,
                             icon: 'UserPlus'
                         });
                    });
                    await adminNotifBatch.commit();
                } catch (e) {
                    console.warn("Failed to send admin notifications", e);
                }
            }

            toast({
                title: "Registration Successful",
                description: `Welcome to Padel Hore, ${user.displayName || 'Player'}!`,
            });
            router.push('/admin');
        } catch (error) {
            console.error("Error signing up with Google: ", error);
            toast({
                variant: 'destructive',
                title: 'Google Registration Failed',
                description: 'Failed to sign up with Google. Please try again.',
            });
        }
    };

    return (
        <div className="flex items-start md:items-center justify-center min-h-screen p-4 pt-20 md:pt-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="flex flex-col items-center text-center gap-4 p-6">
                     <Logo className="w-16 h-16" />
                    <div>
                        <CardTitle className="text-2xl font-headline">Create Your Account</CardTitle>
                        <CardDescription>Join the Padel Hore community!</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        variant="outline" 
                        type="button" 
                        className="w-full flex items-center justify-center gap-3 py-6 border-muted-foreground/20 hover:bg-muted/50 transition-colors"
                        onClick={handleGoogleRegister}
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        <span className="font-bold">Sign up with Google</span>
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted-foreground/20" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or register with email</span>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-4">
                             <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="John Doe" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="whatsapp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>WhatsApp Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 08123456789" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="you@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    {...field}
                                                    className="pr-10"
                                                />
                                            </FormControl>
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 flex items-center justify-center h-full w-10 text-muted-foreground"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Registering...' : 'Register'}
                            </Button>
                        </form>
                    </Form>
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="font-bold hover:underline">
                            Login
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

    