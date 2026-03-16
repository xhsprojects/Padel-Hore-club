'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings, Tier } from '@/lib/types';
import { DEFAULT_THRESHOLDS, TIER_COLORS } from '@/lib/constants';
import { Trophy, Award, Star, Shield, Zap, Loader2, ChevronRight } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

const TIER_ICONS: Record<Tier, React.ElementType> = {
    gold: Trophy,
    silver: Award,
    bronze: Star,
    "lower bronze": Shield,
    beginner: Zap,
};

const TIER_DESCRIPTIONS: Record<Tier, string> = {
    gold: "Puncak prestasi di Padel Hore. Hanya untuk pemain terbaik.",
    silver: "Pemain berpengalaman dengan teknik yang solid.",
    bronze: "Pemain menengah yang sudah menguasai dasar permainan.",
    "lower bronze": "Pemain yang sedang berkembang dan mulai kompetitif.",
    beginner: "Titik awal perjalanan Anda di Padel Hore.",
};

export default function TiersPage() {
    const { firestore } = useFirebase();
    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);

    const thresholds = appSettings?.tierThresholds || DEFAULT_THRESHOLDS;

    const tierList: { id: Tier; name: string }[] = [
        { id: 'gold', name: 'Gold' },
        { id: 'silver', name: 'Silver' },
        { id: 'bronze', name: 'Bronze' },
        { id: 'lower bronze', name: 'Lower Bronze' },
        { id: 'beginner', name: 'Beginner' },
    ];

    return (
        <div className="p-2 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-headline font-bold text-foreground">Hierarchy Tier</h1>
                    <p className="text-muted-foreground text-lg">Tingkatkan poinmu dan raih peringkat tertinggi!</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {tierList.map((tier, index) => {
                            const Icon = TIER_ICONS[tier.id];
                            const threshold = thresholds[tier.id];
                            const colorClass = TIER_COLORS[tier.id];

                            return (
                                <Card key={tier.id} className="overflow-hidden border-2 transition-all hover:shadow-lg">
                                    <div className="flex flex-col md:flex-row">
                                        <div className={cn(
                                            "w-full md:w-48 flex flex-col items-center justify-center p-6 text-center space-y-2",
                                            colorClass
                                        )}>
                                            <Icon className="h-12 w-12" />
                                            <h2 className="text-2xl font-bold capitalize">{tier.name}</h2>
                                        </div>
                                        <CardContent className="flex-1 p-6 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Persyaratan Poin</p>
                                                    <div className="text-2xl font-bold flex items-center gap-2">
                                                        {threshold ? (
                                                            <>
                                                                <span>{threshold.min}</span>
                                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                                <span>{threshold.max === Infinity ? "∞" : threshold.max}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">Belum diatur</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-primary/5 rounded-full px-4 py-2 border border-primary/10">
                                                    <p className="text-xs font-bold text-primary text-center">
                                                        {index === 0 ? "Peringkat Tertinggi" : `Tier ke-${index + 1}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground">
                                                {TIER_DESCRIPTIONS[tier.id]}
                                            </p>
                                        </CardContent>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <div className="bg-muted/50 rounded-xl p-6 border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">
                        Poin dihitung berdasarkan performa pertandingan, kehadiran, dan perilaku di lapangan. 
                        Cek <a href="/point-system" className="text-primary font-bold hover:underline">Sistem Poin</a> untuk detail lebih lanjut.
                    </p>
                </div>
            </div>
        </div>
    );
}
