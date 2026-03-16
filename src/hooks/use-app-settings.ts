'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings, Tier, TierThresholds } from '@/lib/types';
import { DEFAULT_THRESHOLDS, DEFAULT_RESET_PERCENTAGES } from '@/lib/constants';

export function useAppSettings() {
    const { firestore } = useFirebase();
    
    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    
    const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);
    
    const thresholds: TierThresholds = {
        beginner: appSettings?.tierThresholds?.beginner || DEFAULT_THRESHOLDS.beginner,
        "lower bronze": appSettings?.tierThresholds?.["lower bronze"] || DEFAULT_THRESHOLDS["lower bronze"],
        bronze: appSettings?.tierThresholds?.bronze || DEFAULT_THRESHOLDS.bronze,
        silver: appSettings?.tierThresholds?.silver || DEFAULT_THRESHOLDS.silver,
        gold: appSettings?.tierThresholds?.gold || DEFAULT_THRESHOLDS.gold,
    };
    
    const percentages: Record<Tier, number> = {
        beginner: appSettings?.tierResetPercentages?.beginner ?? DEFAULT_RESET_PERCENTAGES.beginner,
        "lower bronze": appSettings?.tierResetPercentages?.["lower bronze"] ?? DEFAULT_RESET_PERCENTAGES["lower bronze"],
        bronze: appSettings?.tierResetPercentages?.bronze ?? DEFAULT_RESET_PERCENTAGES.bronze,
        silver: appSettings?.tierResetPercentages?.silver ?? DEFAULT_RESET_PERCENTAGES.silver,
        gold: appSettings?.tierResetPercentages?.gold ?? DEFAULT_RESET_PERCENTAGES.gold,
    };
    
    return {
        settings: appSettings,
        thresholds,
        percentages,
        isLoading,
    };
}
