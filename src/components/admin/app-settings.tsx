'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const AppSettingsSchema = z.object({
    membershipWhatsappNumber: z.string().min(10, 'Nomor WhatsApp minimal 10 digit.').regex(/^[0-9]+$/, "Hanya boleh berisi angka.").optional().or(z.literal('')),
    shopWhatsappNumber: z.string().min(10, 'Nomor WhatsApp minimal 10 digit.').regex(/^[0-9]+$/, "Hanya boleh berisi angka.").optional().or(z.literal('')),
    isMaintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().optional(),
});

type FormValues = z.infer<typeof AppSettingsSchema>;

export function AppSettingsManagement() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);
    
    const form = useForm<FormValues>({
        resolver: zodResolver(AppSettingsSchema),
        defaultValues: {
            membershipWhatsappNumber: '',
            shopWhatsappNumber: '',
            isMaintenanceMode: false,
            maintenanceMessage: 'Kami sedang melakukan perbaikan. Silakan coba lagi nanti.',
        },
    });

    useEffect(() => {
        if (appSettings) {
            form.reset({
                membershipWhatsappNumber: appSettings.membershipWhatsappNumber || '',
                shopWhatsappNumber: appSettings.shopWhatsappNumber || '',
                isMaintenanceMode: appSettings.isMaintenanceMode || false,
                maintenanceMessage: appSettings.maintenanceMessage || 'Kami sedang melakukan perbaikan. Silakan coba lagi nanti.',
            });
        }
    }, [appSettings, form]);

    const onSubmit = async (data: FormValues) => {
        if (!settingsRef) return;
        setIsSubmitting(true);
        try {
            await setDoc(settingsRef, data, { merge: true });
            toast({ title: 'Sukses', description: 'Pengaturan aplikasi telah diperbarui.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Gagal memperbarui pengaturan.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-32 ml-auto" />
            </div>
        )
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-medium">Kontak Admin</h3>
                     <FormField
                        control={form.control}
                        name="membershipWhatsappNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nomor WhatsApp Membership</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 628123456789" {...field} />
                            </FormControl>
                            <FormDescription>Nomor untuk pendaftaran/perpanjangan membership.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="shopWhatsappNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nomor WhatsApp Toko</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. 628987654321" {...field} />
                            </FormControl>
                            <FormDescription>Nomor untuk konfirmasi pesanan dari toko.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-medium">Mode Perbaikan</h3>
                     <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Perhatian!</AlertTitle>
                        <AlertDescription>
                            Mengaktifkan mode perbaikan akan membuat aplikasi tidak dapat diakses oleh semua pengguna kecuali admin.
                        </AlertDescription>
                    </Alert>
                    <FormField
                        control={form.control}
                        name="isMaintenanceMode"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Aktifkan Mode Perbaikan</FormLabel>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    {form.watch('isMaintenanceMode') && (
                         <FormField
                            control={form.control}
                            name="maintenanceMessage"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pesan Perbaikan</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Contoh: Aplikasi sedang dalam perbaikan..." {...field} />
                                </FormControl>
                                <FormDescription>Pesan yang akan ditampilkan kepada pengguna.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                 </div>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                    Simpan Pengaturan
                </Button>
            </form>
        </Form>
    );
}
