'use client';

import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { POINT_RULES, DEFAULT_THRESHOLDS, DEFAULT_RESET_PERCENTAGES } from '@/lib/constants';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings, Tier } from '@/lib/types';
import { Flame, ShieldCheck, Star, Trophy, Award, RefreshCw, Loader2 } from 'lucide-react';
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

    const tiers: { id: Tier; name: string }[] = [
        { id: 'gold', name: 'Gold' },
        { id: 'silver', name: 'Silver' },
        { id: 'bronze', name: 'Bronze' },
        { id: 'lower bronze', name: 'Lower Bronze' },
        { id: 'beginner', name: 'Beginner' },
    ];

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="text-center">
                        <Trophy className="mx-auto h-12 w-12 text-primary" />
                        <CardTitle className="font-headline text-3xl mt-2">Sistem Poin Padel Hore</CardTitle>
                        <CardDescription className="text-lg">Pahami cara kerja poin untuk naik peringkat!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                                <PointCategory
                                    value="item-1"
                                    title="Poin Dasar (Partisipasi & Hasil)"
                                    icon={Star}
                                >
                                    <PointDetail label="Partisipasi (Member)" value={POINT_RULES.PARTICIPATION.MEMBER} />
                                    <PointDetail label="Partisipasi (Non-Member)" value={POINT_RULES.PARTICIPATION.NON_MEMBER} />
                                    <PointDetail label="Menang Pertandingan" value={POINT_RULES.RESULT.WIN} />
                                    <PointDetail label="Kalah Pertandingan" value={POINT_RULES.RESULT.LOSS} />
                                    <PointDetail label="Seri Pertandingan" value={POINT_RULES.RESULT.DRAW} />
                                </PointCategory>

                                <PointCategory
                                    value="item-2"
                                    title="Bonus Margin Skor"
                                    icon={Flame}
                                >
                                    <PointDetail label="Kemenangan Dominan (selisih 5+)" value={POINT_RULES.MARGIN_BONUS.DOMINANT_WIN} />
                                    <PointDetail label="Kemenangan Tipis (selisih 1-4)" value={POINT_RULES.MARGIN_BONUS.CLOSE_WIN} />
                                    <PointDetail label="Kekalahan Terhormat (selisih 1-2)" value={POINT_RULES.MARGIN_BONUS.HONORABLE_LOSS} />
                                </PointCategory>

                                 <PointCategory
                                    value="item-3"
                                    title="Bonus Perilaku Positif"
                                    icon={Award}
                                >
                                    <PointDetail label="Menjadi Host Pertandingan" value={POINT_RULES.BEHAVIOR.HOST_MATCH} />
                                    <PointDetail label="Membantu Isi Slot Kosong" value={POINT_RULES.BEHAVIOR.SLOT_FILLER} />
                                    <PointDetail label="Datang Tepat Waktu" value={POINT_RULES.BEHAVIOR.ON_TIME} />
                                    <PointDetail label="Menunjukkan Fair Play" value={POINT_RULES.BEHAVIOR.FAIR_PLAY} />
                                </PointCategory>

                                 <PointCategory
                                    value="item-4"
                                    title="Bonus Konsistensi & Aktivitas"
                                    icon={ShieldCheck}
                                >
                                    <PointDetail 
                                        label={`Bermain ${POINT_RULES.CONSISTENCY.WEEKLY_ACTIVITY_THRESHOLD}x dalam Seminggu`}
                                        value={POINT_RULES.CONSISTENCY.WEEKLY_ACTIVITY_BONUS} 
                                    />
                                     <PointDetail 
                                        label={`Bermain ${POINT_RULES.CONSISTENCY.MONTHLY_ACTIVITY_THRESHOLD}x dalam Sebulan`}
                                        value={POINT_RULES.CONSISTENCY.MONTHLY_ACTIVITY_BONUS} 
                                    />
                                </PointCategory>

                                <PointCategory
                                    value="item-5"
                                    title="Reset Poin Musiman"
                                    icon={RefreshCw}
                                >
                                    <div className="space-y-4 py-3 text-sm">
                                        <p className="text-muted-foreground leading-relaxed">
                                            Di akhir setiap musim, poin semua pemain akan mengalami "soft reset". Tujuannya adalah untuk menjaga kompetisi tetap segar, sekaligus tetap menghargai performa pemain di musim sebelumnya. Semakin tinggi tier akhir Anda, semakin besar persentase poin musiman yang Anda pertahankan.
                                        </p>
                                        
                                        <div>
                                            <p className="font-semibold text-foreground">Formula Reset:</p>
                                            <code className="relative mt-1 block rounded bg-muted px-4 py-2 font-mono text-sm font-semibold text-primary">
                                                Poin Baru = (Poin Musim Lalu × % Tier) + Poin Dasar Tier
                                            </code>
                                        </div>

                                        <div>
                                            <p className="font-semibold text-foreground">Persentase Poin yang Dipertahankan:</p>
                                            <ul className="list-disc space-y-1 pl-5 pt-2 text-muted-foreground">
                                                {tiers.map((t) => (
                                                    <li key={t.id}>
                                                        <span className="font-semibold text-foreground capitalize">{t.name}:</span> {percentages[t.id] ?? 20}%
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <p className="font-semibold text-foreground">Contoh:</p>
                                            <p className="text-xs text-muted-foreground">
                                                Seorang pemain di tier <strong className="text-foreground">Silver</strong> menyelesaikan musim dengan 800 poin. Poin musim barunya akan menjadi (800 × {percentages.silver ?? 30}%) + {(thresholds.silver?.min ?? 601)} (poin dasar Silver) = {800 * (percentages.silver ?? 30) / 100} + {(thresholds.silver?.min ?? 601)} = <strong>{800 * (percentages.silver ?? 30) / 100 + (thresholds.silver?.min ?? 601)} poin</strong>.
                                            </p>
                                        </div>
                                    </div>
                                </PointCategory>
                            </Accordion>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    );
}

function PointCategory({ value, title, icon: Icon, children }: { value: string, title: string, icon: React.ElementType, children: React.ReactNode }) {
    return (
        <AccordionItem value={value}>
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                    {title}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="divide-y divide-border pl-4 pr-2">
                    {children}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function PointDetail({ label, value }: { label: string, value: number }) {
    return (
        <div className="flex justify-between items-center py-3">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-bold text-lg text-primary">+{value}</p>
        </div>
    );
}

    