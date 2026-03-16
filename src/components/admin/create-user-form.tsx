'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError, deleteApp, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { firebaseConfig } from '@/firebase/config';
import { useFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';


const CreateUserFormSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['admin', 'member', 'non-member']),
});

type FormValues = z.infer<typeof CreateUserFormSchema>;

export function CreateUserForm({ setOpen }: { setOpen: (open: boolean) => void }) {
    const [isPending, setIsPending] = useState(false);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const form = useForm<FormValues>({
        resolver: zodResolver(CreateUserFormSchema),
        defaultValues: {
            name: '',
            whatsapp: '',
            email: '',
            password: '',
            role: 'non-member',
        },
    });

    const handleCreateUser = async (data: FormValues) => {
        setIsPending(true);
        if (!firestore) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Firestore is not initialized'
            });
            setIsPending(false);
            return;
        }

        const tempAppName = `user-creation-${uuidv4()}`;
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
            const user = userCredential.user;
            
            const phId = `PH-${user.uid.substring(0, 4).toUpperCase()}`;

            const newUserProfile: Omit<UserProfile, 'id' | 'membershipExpiryDate'> = {
                uid: user.uid,
                phId: phId,
                email: data.email,
                name: data.name,
                whatsapp: data.whatsapp,
                showWhatsapp: true,
                role: data.role,
                total_points: 0,
                tier: 'beginner',
                win_count: 0,
                match_count: 0,
                photoURL: null,
                win_streak: 0,
                fair_play_count: 0,
                early_bird_count: 0,
                night_owl_count: 0,
            };

            await setDoc(doc(firestore, 'users', user.uid), newUserProfile);
            
            toast({
                title: "User Created",
                description: `${data.name} has been successfully created.`,
            });
            setOpen(false);
            form.reset();
        } catch (err) {
            console.error("Error creating user: ", err);
            let message = "An unknown error occurred.";
            if (err instanceof FirebaseError) {
                if (err.code === 'auth/email-already-in-use') {
                    message = 'This email address is already in use by another account.';
                } else {
                    message = err.message;
                }
            } else if (err instanceof Error) {
                message = err.message;
            }
            toast({
                variant: 'destructive',
                title: 'Create User Failed',
                description: message,
            });
        } finally {
            setIsPending(false);
            await deleteApp(tempApp);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
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
                            <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                         <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="non-member">Non-Member</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Creating User...' : 'Create User'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
