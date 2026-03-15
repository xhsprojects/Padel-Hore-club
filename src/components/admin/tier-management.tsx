'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { TierThresholds } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '../ui/skeleton';
import { DEFAULT_THRESHOLDS } from '@/lib/constants';

const TierSettingsSchema = z.object({
    lowerBronzeMin: z.coerce.number().positive(),
    bronzeMin: z.coerce.number().positive(),
    silverMin: z.coerce.number().positive(),
    goldMin: z.coerce.number().positive(),
}).refine(data => data.bronzeMin > data.lowerBronzeMin, {
    message: "Poin minimum Bronze harus lebih besar dari Lower Bronze.",
    path: ["bronzeMin"],
}).refine(data => data.silverMin > data.bronzeMin, {
    message: "Poin minimum Silver harus lebih besar dari Bronze.",
    path: ["silverMin"],
}).refine(data => data.goldMin > data.silverMin, {
    message: "Poin minimum Gold harus lebih besar dari Silver.",
    path: ["goldMin"],
});

type FormValues = z.infer<typeof TierSettingsSchema>;

export function TierManagement() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'tier_thresholds');
    }, [firestore]);

    const { data: tierSettings, isLoading } = useDoc<TierThresholds>(settingsRef);
    const currentSettings = tierSettings || DEFAULT_THRESHOLDS;
    
    const form = useForm<FormValues>({
        resolver: zodResolver(TierSettingsSchema),
        defaultValues: {
            lowerBronzeMin: currentSettings['lower bronze'].min,
            bronzeMin: currentSettings.bronze.min,
            silverMin: currentSettings.silver.min,
            goldMin: currentSettings.gold.min,
        },
    });

    useEffect(() => {
        if (tierSettings) {
            form.reset({
                lowerBronzeMin: tierSettings['lower bronze'].min,
                bronzeMin: tierSettings.bronze.min,
                silverMin: tierSettings.silver.min,
                goldMin: tierSettings.gold.min,
            });
        }
    }, [tierSettings, form]);

    const onSubmit = async (data: FormValues) => {
        if (!settingsRef) return;
        setIsSubmitting(true);
        try {
            const newThresholds: TierThresholds = {
                beginner: { min: 0, max: data.lowerBronzeMin - 1 },
                "lower bronze": { min: data.lowerBronzeMin, max: data.bronzeMin - 1 },
                bronze: { min: data.bronzeMin, max: data.silverMin - 1 },
                silver: { min: data.silverMin, max: data.goldMin - 1 },
                gold: { min: data.goldMin, max: Infinity },
            };

            await setDoc(settingsRef, newThresholds);

            toast({ title: 'Success', description: 'Tier settings have been updated.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update settings.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-32 ml-auto" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Peringatan</AlertTitle>
                <AlertDescription>
                    Mengubah nilai-nilai ini akan memengaruhi semua perhitungan tier di seluruh aplikasi. Tier pemain dapat berubah secara langsung. Lanjutkan dengan hati-hati.
                </AlertDescription>
            </Alert>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="lowerBronzeMin"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Lower Bronze</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 101" {...field} />
                                </FormControl>
                                <FormDescription>Poin min</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="bronzeMin"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bronze</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 301" {...field} />
                                </FormControl>
                                <FormDescription>Poin min</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="silverMin"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Silver</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 601" {...field} />
                                </FormControl>
                                <FormDescription>Poin min</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="goldMin"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Gold</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 1001" {...field} />
                                </FormControl>
                                <FormDescription>Poin min</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                        Simpan Pengaturan
                    </Button>
                </form>
            </Form>
        </div>
    );
}
