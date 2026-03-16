'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings } from '@/lib/types';
import MaintenanceDisplay from '@/components/maintenance-display';

export default function MaintenancePage() {
    const { firestore } = useFirebase();

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);

    const { data: appSettings, isLoading } = useDoc<AppSettings>(settingsRef);

    return <MaintenanceDisplay message={appSettings?.maintenanceMessage} isLoading={isLoading} />;
}
