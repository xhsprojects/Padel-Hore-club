'use client';

import { usePathname } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppSettings, UserProfile } from '@/lib/types';
import MaintenanceDisplay from '@/components/maintenance-display';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    const { data: appSettings, isLoading: isSettingsLoading } = useDoc<AppSettings>(settingsRef);
    
    const isAuthPath = pathname === '/login' || pathname === '/register';

    // If settings are still loading, let child pages show their own skeletons.
    // This prevents a top-level hydration mismatch.
    if (isSettingsLoading) {
        return <>{children}</>;
    }

    if (!appSettings?.isMaintenanceMode || isAuthPath) {
        return <>{children}</>;
    }

    // --- Maintenance Mode is ON ---

    // While user/profile status is resolving, show the maintenance page to prevent content flashing.
    // Pass the message directly. The isLoading prop is removed from MaintenanceDisplay to prevent mismatches.
    if (isUserLoading || (user && isProfileLoading)) {
        return <MaintenanceDisplay message={appSettings.maintenanceMessage} />;
    }
    
    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;

    // If user is loaded and is an admin, show the app.
    if (user && isAdmin) {
        return <>{children}</>;
    }

    // For all other cases (no user, or non-admin user), show maintenance.
    return <MaintenanceDisplay message={appSettings.maintenanceMessage} />;
}
