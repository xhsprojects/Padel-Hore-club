'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings, Tier } from '@/lib/types';
import { Trophy, Star, Flame, Award, ShieldCheck, RefreshCw, Loader2, Rocket } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { POINT_RULES, DEFAULT_THRESHOLDS, DEFAULT_RESET_PERCENTAGES } from '@/lib/constants';
import React from 'react';

export default function PointSystemPage() {
    const { firestore } = useFirebase();
    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);

    const thresholds = appSettings?.tierThresholds || DEFAULT_THRESHOLDS;
    const percentages = appSettings?.tierResetPercentages || DEFAULT_RESET_PERCENTAGES;
    const rules = {
        PARTICIPATION: { ...POINT_RULES.PARTICIPATION, ...appSettings?.pointRules?.PARTICIPATION },
        RESULT: { ...POINT_RULES.RESULT, ...appSettings?.pointRules?.RESULT },
        MARGIN_BONUS: { ...POINT_RULES.MARGIN_BONUS, ...appSettings?.pointRules?.MARGIN_BONUS },
        BEHAVIOR: { ...POINT_RULES.BEHAVIOR, ...appSettings?.pointRules?.BEHAVIOR },
        CONSISTENCY: { ...POINT_RULES.CONSISTENCY, ...appSettings?.pointRules?.CONSISTENCY },
    };

    const tiers: { id: Tier; name: string }[] = [
        { id: 'gold', name: 'Gold' },
        { id: 'silver', name: 'Silver' },
        { id: 'bronze', name: 'Bronze' },
        { id: 'lower bronze', name: 'Lower Bronze' },
        { id: 'beginner', name: 'Beginner' },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="text-center pb-2">
                        <Trophy className="mx-auto h-12 w-12 text-emerald-600" />
                        <CardTitle className="font-headline text-3xl mt-2">Sistem Poin Padel Hore</CardTitle>
                        <CardDescription className="text-lg">Pahami cara kerja poin untuk naik peringkat!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                            </div>
                        ) : (
                            <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
                                <PointCategory
                                    value="item-1"
                                    title="Poin Dasar (Partisipasi & Hasil)"
                                    icon={Star}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                                        <PointDetail label="Partisipasi (Member)" value={rules.PARTICIPATION.MEMBER} />
                                        <PointDetail label="Partisipasi (Non-Member)" value={rules.PARTICIPATION.NON_MEMBER} />
                                        <PointDetail label="Menang Pertandingan" value={rules.RESULT.WIN} />
                                        <PointDetail label="Kalah Pertandingan" value={rules.RESULT.LOSS} />
                                        <PointDetail label="Hasil Seri" value={rules.RESULT.DRAW} />
                                    </div>
                                </PointCategory>

                                <PointCategory
                                    value="item-2"
                                    title="Bonus Margin Skor"
                                    icon={Flame}
                                >
                                    <PointDetail label="Kemenangan Dominan (selisih 5+)" value={rules.MARGIN_BONUS.DOMINANT_WIN} />
                                    <PointDetail label="Kemenangan Tipis (selisih 1-4)" value={rules.MARGIN_BONUS.CLOSE_WIN} />
                                    <PointDetail label="Kekalahan Terhormat (selisih 1-2)" value={rules.MARGIN_BONUS.HONORABLE_LOSS} />
                                </PointCategory>

                                <PointCategory
                                    value="item-Performance"
                                    title="Performa & Konsistensi"
                                    icon={Rocket}
                                >
                                    <PointDetail 
                                        label={`Win Streak (Menang ${rules.CONSISTENCY.WIN_STREAK_THRESHOLD}x Beruntun)`} 
                                        value={rules.CONSISTENCY.WIN_STREAK_BONUS} 
                                    />
                                    <PointDetail 
                                        label={`Aktivitas Mingguan (${rules.CONSISTENCY.WEEKLY_ACTIVITY_THRESHOLD}x Main / Minggu)`} 
                                        value={rules.CONSISTENCY.WEEKLY_ACTIVITY_BONUS} 
                                    />
                                    <PointDetail 
                                        label={`Aktivitas Bulanan (${rules.CONSISTENCY.MONTHLY_ACTIVITY_THRESHOLD}x Main / Bulan)`} 
                                        value={rules.CONSISTENCY.MONTHLY_ACTIVITY_BONUS} 
                                    />
                                </PointCategory>

                                 <PointCategory
                                    value="item-3"
                                    title="Bonus Perilaku Positif"
                                    icon={Award}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                                        <PointDetail label="Menjadi Host Pertandingan" value={rules.BEHAVIOR.HOST_MATCH} />
                                        <PointDetail label="Membantu Isi Slot Kosong" value={rules.BEHAVIOR.SLOT_FILLER} />
                                        <PointDetail label="Datang Tepat Waktu" value={rules.BEHAVIOR.ON_TIME} />
                                        <PointDetail label="Menunjukkan Fair Play" value={rules.BEHAVIOR.FAIR_PLAY} />
                                    </div>
                                </PointCategory>

                                <PointCategory
                                    value="item-5"
                                    title="Reset Poin Musiman"
                                    icon={RefreshCw}
                                >
                                    <div className="space-y-4 py-3 text-sm text-muted-foreground">
                                        <p className="leading-relaxed">
                                            Di akhir setiap musim, poin semua pemain akan mengalami "soft reset". Tujuannya adalah untuk menjaga kompetisi tetap segar, sekaligus tetap menghargai performa pemain di musim sebelumnya.
                                        </p>
                                        
                                        <div className="bg-muted/50 p-4 rounded-2xl space-y-3">
                                            <p className="font-bold text-foreground">Formula Reset:</p>
                                            <code className="block font-mono text-emerald-600 bg-white/50 p-2 rounded-lg text-center border border-emerald-500/10">
                                                Poin Baru = (Poin Musim Lalu × % Tier) + Poin Dasar Tier
                                            </code>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="font-bold text-foreground">Persentase Poin yang Dipertahankan:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {tiers.map((t) => (
                                                    <div key={t.id} className="flex justify-between items-center bg-white/30 p-2 px-4 rounded-xl border border-emerald-500/5">
                                                        <span className="font-semibold text-foreground capitalize">{t.name}</span>
                                                        <span className="font-black text-emerald-600">{percentages[t.id] ?? 20}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="border-t border-emerald-500/5 pt-4">
                                            <p className="font-bold text-foreground mb-1">Contoh:</p>
                                            <p className="text-xs leading-relaxed">
                                                Pemain tier <strong className="text-foreground">Silver</strong> menyelesaikan musim dengan 800 poin. 
                                                Reset-nya: <br/>
                                                (800 × {percentages.silver ?? 30}%) + {(thresholds.silver?.min ?? 601)} = <strong>{800 * (percentages.silver ?? 30) / 100 + (thresholds.silver?.min ?? 601)} poin</strong>.
                                            </p>
                                        </div>
                                    </div>
                                </PointCategory>
                            </Accordion>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function PointCategory({ value, title, icon: Icon, children }: { value: string, title: string, icon: React.ElementType, children: React.ReactNode }) {
    return (
        <AccordionItem value={value} className="border border-emerald-500/10 rounded-3xl overflow-hidden bg-card shadow-sm px-6">
            <AccordionTrigger className="text-lg font-bold hover:no-underline py-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-500/10">
                        <Icon className="h-6 w-6" />
                    </div>
                    {title}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="divide-y divide-emerald-500/5 pb-4">
                    {children}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function PointDetail({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex justify-between items-center py-4">
            <p className="text-muted-foreground font-medium">{label}</p>
            <p className="font-black text-xl text-emerald-600">+{value} PTS</p>
        </div>
    );
}