'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { DEFAULT_THRESHOLDS, DEFAULT_RESET_PERCENTAGES, POINT_RULES } from '@/lib/constants';
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
    tierThresholds: z.record(z.string(), z.object({
        min: z.number(),
        max: z.number(),
    })).optional(),
    tierResetPercentages: z.record(z.string(), z.number()).optional(),
    pointRules: z.object({
        PARTICIPATION: z.object({
            MEMBER: z.number(),
            NON_MEMBER: z.number(),
        }),
        RESULT: z.object({
            WIN: z.number(),
            LOSS: z.number(),
            DRAW: z.number(),
        }),
        MARGIN_BONUS: z.object({
            DOMINANT_WIN: z.number(),
            CLOSE_WIN: z.number(),
            HONORABLE_LOSS: z.number(),
        }),
        BEHAVIOR: z.object({
            HOST_MATCH: z.number(),
            SLOT_FILLER: z.number(),
            ON_TIME: z.number(),
            FAIR_PLAY: z.number(),
        }),
        CONSISTENCY: z.object({
            WIN_STREAK_THRESHOLD: z.number(),
            WIN_STREAK_BONUS: z.number(),
            WEEKLY_ACTIVITY_THRESHOLD: z.number(),
            WEEKLY_ACTIVITY_BONUS: z.number(),
            MONTHLY_ACTIVITY_THRESHOLD: z.number(),
            MONTHLY_ACTIVITY_BONUS: z.number(),
        }),
    }).optional(),
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
            tierThresholds: DEFAULT_THRESHOLDS,
            tierResetPercentages: DEFAULT_RESET_PERCENTAGES,
            pointRules: POINT_RULES,
        },
    });

    useEffect(() => {
        if (appSettings) {
            form.reset({
                membershipWhatsappNumber: appSettings.membershipWhatsappNumber || '',
                shopWhatsappNumber: appSettings.shopWhatsappNumber || '',
                isMaintenanceMode: appSettings.isMaintenanceMode || false,
                maintenanceMessage: appSettings.maintenanceMessage || 'Kami sedang melakukan perbaikan. Silakan coba lagi nanti.',
                tierThresholds: appSettings.tierThresholds || DEFAULT_THRESHOLDS,
                tierResetPercentages: appSettings.tierResetPercentages || DEFAULT_RESET_PERCENTAGES,
                pointRules: appSettings.pointRules || POINT_RULES,
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

                 <div className="space-y-6 rounded-lg border p-4">
                    <h3 className="text-lg font-medium">Konfigurasi Tier & Reset Musiman</h3>
                    <div className="space-y-4">
                        {(['beginner', 'lower bronze', 'bronze', 'silver', 'gold'] as const).map((tierTier) => (
                            <div key={tierTier} className="p-4 bg-muted/30 rounded-lg space-y-4 border border-border/50">
                                <h4 className="font-bold flex items-center justify-between">
                                    <span className="capitalize">{tierTier}</span>
                                    <span className="text-xs text-muted-foreground uppercase">ID: {tierTier}</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name={`tierThresholds.${tierTier}.min`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Min Points</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`tierThresholds.${tierTier}.max`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Max Points</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        onChange={(e) => field.onChange(e.target.value === 'Infinity' ? Infinity : (parseInt(e.target.value) || 0))}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`tierResetPercentages.${tierTier}`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Reset %</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        {...field} 
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-6 rounded-lg border p-4">
                    <h3 className="text-lg font-medium">Pengaturan Poin Pertandingan</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Participation */}
                        <div className="space-y-4">
                            <h4 className="font-bold border-b pb-2">Partisipasi</h4>
                            <NumberField form={form} name="pointRules.PARTICIPATION.MEMBER" label="Poin Member" />
                            <NumberField form={form} name="pointRules.PARTICIPATION.NON_MEMBER" label="Poin Non-Member" />
                        </div>

                        {/* Result */}
                        <div className="space-y-4">
                            <h4 className="font-bold border-b pb-2">Hasil Pertandingan</h4>
                            <NumberField form={form} name="pointRules.RESULT.WIN" label="Poin Menang" />
                            <NumberField form={form} name="pointRules.RESULT.LOSS" label="Poin Kalah" />
                            <NumberField form={form} name="pointRules.RESULT.DRAW" label="Poin Seri" />
                        </div>

                        {/* Margin */}
                        <div className="space-y-4">
                            <h4 className="font-bold border-b pb-2">Bonus Selisih</h4>
                            <NumberField form={form} name="pointRules.MARGIN_BONUS.DOMINANT_WIN" label="Menang Dominan (5+)" />
                            <NumberField form={form} name="pointRules.MARGIN_BONUS.CLOSE_WIN" label="Menang Tipis (1-4)" />
                            <NumberField form={form} name="pointRules.MARGIN_BONUS.HONORABLE_LOSS" label="Kalah Terhormat (<=2)" />
                        </div>

                        {/* Behavior */}
                        <div className="space-y-4">
                            <h4 className="font-bold border-b pb-2">Perilaku Positif</h4>
                            <NumberField form={form} name="pointRules.BEHAVIOR.HOST_MATCH" label="Host Pertandingan" />
                            <NumberField form={form} name="pointRules.BEHAVIOR.SLOT_FILLER" label="Bantu Isi Slot" />
                            <NumberField form={form} name="pointRules.BEHAVIOR.ON_TIME" label="Tepat Waktu" />
                            <NumberField form={form} name="pointRules.BEHAVIOR.FAIR_PLAY" label="Fair Play" />
                        </div>

                         {/* Consistency */}
                         <div className="space-y-4 sm:col-span-2">
                            <h4 className="font-bold border-b pb-2">Poin Konsistensi & Aktivitas</h4>
                            <p className="text-xs text-muted-foreground mb-4">
                                Bonus poin untuk pemain reguler yang sering berpartisipasi dan mempertahankan performa kemenangan.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <NumberField form={form} name="pointRules.CONSISTENCY.WIN_STREAK_THRESHOLD" label="Ambang Win Streak" description="Jumlah menang beruntun" />
                                <NumberField form={form} name="pointRules.CONSISTENCY.WIN_STREAK_BONUS" label="Bonus Win Streak" description="Poin tambahan" />
                                <div className="hidden sm:block"></div>
                                
                                <NumberField form={form} name="pointRules.CONSISTENCY.WEEKLY_ACTIVITY_THRESHOLD" label="Target Mingguan (Match)" description="Batas minimal per minggu" />
                                <NumberField form={form} name="pointRules.CONSISTENCY.WEEKLY_ACTIVITY_BONUS" label="Bonus Mingguan" description="Hadiah poin mingguan" />
                                <div className="hidden sm:block"></div>

                                <NumberField form={form} name="pointRules.CONSISTENCY.MONTHLY_ACTIVITY_THRESHOLD" label="Target Bulanan (Match)" description="Batas minimal per bulan" />
                                <NumberField form={form} name="pointRules.CONSISTENCY.MONTHLY_ACTIVITY_BONUS" label="Bonus Bulanan" description="Hadiah poin bulanan" />
                            </div>
                        </div>
                    </div>
                  </div>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                    Simpan Pengaturan
                </Button>
            </form>
        </Form>
    );
}

function NumberField({ form, name, label, description }: { form: any, name: string, label: string, description?: string }) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-xs">{label}</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                    </FormControl>
                    {description && <FormDescription className="text-[10px] italic">{description}</FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}
