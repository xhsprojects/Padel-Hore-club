'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { doc, updateDoc, collection, setDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

import {
  Form,
  FormControl,
  FormDescription,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, UserCog, Star, Hourglass } from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { UserProfile, WithId } from '@/lib/types';
import { sendPushNotification } from '@/actions/send-push-notification';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid format, use YYYY-MM-DD").optional().or(z.literal(''));

const EditUserFormSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 characters'),
    role: z.enum(['admin', 'member', 'non-member']),
    membershipExpiryDate: dateStringSchema,
});

type FormValues = z.infer<typeof EditUserFormSchema>;

interface EditUserFormProps {
    user: WithId<UserProfile>;
    setOpen: (open: boolean) => void;
}

export function EditUserForm({ user, setOpen }: EditUserFormProps) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const form = useForm<FormValues>({
        resolver: zodResolver(EditUserFormSchema),
        defaultValues: {
            name: user.name,
            whatsapp: user.whatsapp || '',
            role: user.role as FormValues['role'],
            membershipExpiryDate: user.membershipExpiryDate ? format(user.membershipExpiryDate.toDate(), 'yyyy-MM-dd') : '',
        },
    });

    const handleUpdateUser = async (data: FormValues) => {
        setIsPending(true);
        setError(null);
        if (!firestore) {
            setError('Firestore is not initialized');
            setIsPending(false);
            return;
        }

        const userRef = doc(firestore, 'users', user.id);

        try {
            const updates: Partial<UserProfile> = {
                name: data.name,
                whatsapp: data.whatsapp,
                role: data.role,
                membershipExpiryDate: (data.membershipExpiryDate && data.membershipExpiryDate.length > 0) ? Timestamp.fromDate(new Date(data.membershipExpiryDate)) : undefined,
            };
            
            await updateDoc(userRef, updates as any);

            const originalUser = user;
            const updatedData = data;
            
            const wasMember = originalUser.role === 'member';
            const isNowMember = updatedData.role === 'member';

            const originalExpiry = originalUser.membershipExpiryDate?.toDate();
            const newExpiry = updatedData.membershipExpiryDate ? new Date(updatedData.membershipExpiryDate) : undefined;

            const wasRenewed = isNowMember && wasMember && newExpiry && (!originalExpiry || newExpiry.getTime() !== originalExpiry.getTime());
            const justBecameMember = isNowMember && !wasMember;
            const roleWasChanged = originalUser.role !== updatedData.role;

            let shouldSendNotification = false;
            let notifTitle = '';
            let notifBody = '';
            let notifIcon = 'UserCog';

            if (justBecameMember && newExpiry) {
                shouldSendNotification = true;
                notifTitle = "Selamat! Anda adalah Member!";
                notifBody = `Keanggotaan Anda sekarang aktif hingga ${format(newExpiry, 'dd MMMM yyyy')}. Nikmati semua keuntungannya!`;
                notifIcon = 'Star';
            } else if (wasRenewed && newExpiry) {
                shouldSendNotification = true;
                notifTitle = "Keanggotaan Diperpanjang!";
                notifBody = `Keanggotaan Anda berhasil diperpanjang hingga ${format(newExpiry, 'dd MMMM yyyy')}.`;
                notifIcon = 'Hourglass';
            } else if (roleWasChanged && !justBecameMember) {
                shouldSendNotification = true;
                notifTitle = "Peran Diperbarui";
                notifBody = `Peran Anda telah diubah menjadi '${updatedData.role}'.`;
                notifIcon = 'UserCog';
            }

            if (shouldSendNotification) {
                const notifRef = doc(collection(firestore, 'users', originalUser.id, 'notifications'));
                await setDoc(notifRef, {
                    uid: originalUser.id,
                    title: notifTitle,
                    body: notifBody,
                    timestamp: Timestamp.now(),
                    isRead: false,
                    link: '/membership',
                    icon: notifIcon
                });
            }
            
            toast({
                title: "User Updated",
                description: `${data.name}'s profile has been successfully updated.`,
            });
            setOpen(false);
        } catch (err) {
            console.error("Error updating user: ", err);
            let message = "An unknown error occurred.";
            if (err instanceof FirebaseError) {
                message = err.message;
            } else if (err instanceof Error) {
                message = err.message;
            }
            setError(message);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateUser)} className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
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
                {form.watch('role') === 'member' && (
                  <FormField
                    control={form.control}
                    name="membershipExpiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Expiry</FormLabel>
                        <FormControl>
                           <Input placeholder="YYYY-MM-DD" {...field} />
                        </FormControl>
                        <FormDescription>
                          Enter date in YYYY-MM-DD format. Leave blank to clear.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
