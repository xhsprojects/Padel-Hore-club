

'use client';

import React, { Suspense, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirebase, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile, WithId, Tier, TierThresholds } from '@/lib/types';
import { Loader2, Download, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageGenerator } from '@/components/profile/image-generator';
import { SidebarInset } from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getTier, capitalize } from '@/lib/utils';
import { DEFAULT_THRESHOLDS } from '@/lib/constants';
import { useAppSettings } from '@/hooks/use-app-settings';
import { Skeleton } from '@/components/ui/skeleton';

function SharePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();

    const [download, setDownload] = useState<(() => void) | null>(null);
    const [socialText, setSocialText] = useState('');

    const cardType = searchParams.get('type') as 'tier-up' | 'id-card' | null;
    const newTierParam = searchParams.get('newTier') as Tier | null;
    const oldTierParam = searchParams.get('oldTier') as Tier | null;

    // Fetch the current user's profile directly for reliability
    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    // Fetch all players for rank calculation
    const playersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), orderBy('total_points', 'desc'));
    }, [firestore]);
    const { data: allPlayers, isLoading: playersLoading } = useCollection<WithId<UserProfile>>(playersQuery);

    const { thresholds, isLoading: settingsLoading } = useAppSettings();

    const { player, rank } = useMemo(() => {
        if (!user || !userProfile || !allPlayers) return { player: null, rank: 0 };
        
        const gamePlayers = allPlayers.filter(p => p.role !== 'admin' && p.role !== 'guest');
        const sortedGamePlayers = [...gamePlayers].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
        
        const p: UserProfile = {
            ...userProfile,
            total_points: userProfile.total_points || 0,
            tier: getTier(userProfile.total_points || 0, thresholds),
        };

        const r = sortedGamePlayers.findIndex(p => p.id === user.uid) + 1;
        return { player: p, rank: r };
    }, [user, userProfile, allPlayers, thresholds]);
    
    const handleReady = useCallback((downloadFn: () => void) => {
        setDownload(() => downloadFn);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(socialText);
        toast({ title: 'Copied to clipboard!' });
    };

    React.useEffect(() => {
        if (player) {
            if (cardType === 'tier-up') {
                setSocialText(`I've reached a new milestone in Padel Hore Club! Just ranked up from ${capitalize(oldTierParam || 'a previous tier')} to ${capitalize(newTierParam || player.tier)}! The grind never stops. Challenge me on the court!\n\n#PadelHoreClub #LevelUp #PadelLife`);
            } else if (cardType === 'id-card') {
                setSocialText(`Here are my latest stats from Padel Hore Club. Come join the community and let's play!\n\n#PadelHoreClub #PadelStats #AthleteLife`);
            }
        }
    }, [cardType, player, oldTierParam, newTierParam]);

    const isLoading = isUserLoading || isProfileLoading || playersLoading || settingsLoading;

    if (isLoading) {
        return (
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-md mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="aspect-[9/16] w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-7 w-48" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    
    if (!user) {
        router.push('/login');
        return null;
    }
    
    if (!player || !cardType) {
        return (
            <Card className="max-w-md mx-auto my-8">
                <CardHeader><CardTitle>Error</CardTitle></CardHeader>
                <CardContent><p>Could not generate image. Invalid parameters provided.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="p-2 sm:p-6 lg:p-8">
            <div className="max-w-md mx-auto space-y-6">
                <div className="flex flex-col items-center">
                    <div className="mb-6 text-center">
                        <h1 className="font-headline text-3xl font-black text-primary">Your Shareable Card</h1>
                        <p className="text-muted-foreground">Your dynamic image is ready to share!</p>
                    </div>
                    
                    <div className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl border border-muted/20">
                        <ImageGenerator cardType={cardType} player={player} rank={rank} oldTier={oldTierParam || undefined} onReady={handleReady} />
                    </div>
                </div>
                <Card>
                     <CardHeader>
                        <CardTitle className="text-xl">Share to Socials</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea value={socialText} readOnly rows={5} />
                        <div className="flex flex-col sm:flex-row gap-2">
                             <Button onClick={copyToClipboard} className="w-full">
                                <Share2 className="mr-2 h-4 w-4" /> Copy Text
                            </Button>
                            <Button onClick={download || undefined} disabled={!download} variant="secondary" className="w-full">
                                <Download className="mr-2 h-4 w-4" /> Download Image
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function SharePage() {
    return (
        <Suspense fallback={
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-md mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="aspect-[9/16] w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        }>
            <SharePageContent />
        </Suspense>
    );
}
