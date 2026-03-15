'use client';

import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { User as UserIcon, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { TIER_FRAME_CLASSES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Logo, Crown } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlayerCardPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [qrValue, setQrValue] = useState('');

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: player, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    useEffect(() => {
        if (user) {
            const generateQrValue = () => {
                const value = JSON.stringify({
                    uid: user.uid,
                    timestamp: Date.now(),
                });
                setQrValue(value);
            };

            generateQrValue(); // Initial generation
            const interval = setInterval(generateQrValue, 30000); // Regenerate every 30 seconds

            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        if (!isUserLoading && !isProfileLoading && (!user || !player)) {
            router.push('/login');
        }
    }, [isUserLoading, isProfileLoading, user, player, router]);


    if (isUserLoading || isProfileLoading || !user || !player) {
        return (
            <div className="p-4 flex justify-center min-h-full">
                <Card className="w-full max-w-sm mx-auto my-auto flex flex-col p-6 bg-card shadow-2xl shadow-primary/10 border-primary/20 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between p-0">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center flex-1 p-0 my-8">
                        <Skeleton className="w-32 h-32 rounded-full mb-4" />
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-6 w-32 mt-2" />
                    </CardContent>

                    <div className="mt-auto">
                        <Skeleton className="aspect-square w-full rounded-lg" />
                    </div>
                </Card>
            </div>
        );
    }

    const isMemberActive = player.role === 'member' && player.membershipExpiryDate && player.membershipExpiryDate.toDate() > new Date();

    return (
        <div className="p-4 flex justify-center min-h-full">
            <Card className="w-full max-w-sm mx-auto my-auto flex flex-col p-6 bg-card shadow-2xl shadow-primary/10 border-primary/20 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between p-0">
                   <Logo />
                   <p className="font-black text-lg uppercase tracking-widest text-primary">Padel Hore</p>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center flex-1 p-0 my-8">
                    <div className="relative mb-4">
                        {player.tier === 'gold' && <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 w-12 h-12 text-amber-400 z-10" />}
                        <Avatar className={cn("w-32 h-32", TIER_FRAME_CLASSES[player.tier])}>
                            {player.photoURL ? (
                                <AvatarImage src={player.photoURL} alt={player.name} />
                            ) : (
                                <AvatarFallback>
                                    <UserIcon className="w-16 h-16" />
                                </AvatarFallback>
                            )}
                        </Avatar>
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-wider">{player.name}</h1>
                    <p className="font-mono text-primary font-bold text-lg">{player.phId || `PH-${player.id.substring(0,4).toUpperCase()}`}</p>
                    {isMemberActive && (
                        <Badge className="mt-2 font-bold tracking-widest bg-primary/20 text-primary border border-primary/50 flex items-center">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            MEMBER
                        </Badge>
                    )}
                </CardContent>

                <div className="mt-auto">
                    <div className="p-5 bg-white rounded-lg">
                        <div className="flex flex-col items-center justify-center">
                           {qrValue ? (
                             <QRCode
                                value={qrValue}
                                size={256}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                             />
                           ) : (
                             <div className="w-full aspect-square flex items-center justify-center">
                                <Skeleton className="h-full w-full" />
                             </div>
                           )}
                           <p className="text-xs text-gray-600 text-center mt-4">
                              This QR code refreshes periodically for security.
                           </p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

    