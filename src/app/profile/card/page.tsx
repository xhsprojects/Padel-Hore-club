'use client';

import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
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
        <div className="p-4 flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background overflow-hidden relative">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

            <Card className="w-full max-w-sm mx-auto flex flex-col p-6 bg-card/60 backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.3)] shadow-primary/20 border-primary/20 rounded-[2.5rem] relative z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                
                <CardHeader className="flex flex-row items-center justify-between p-0 mb-6 relative z-10">
                   <div className="flex items-center gap-3">
                        <Logo className="w-10 h-10 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <p className="font-headline font-black text-xl uppercase tracking-[0.2em] text-primary">Padel Hore</p>
                   </div>
                </CardHeader>

                <CardContent className="flex flex-col items-center justify-center text-center flex-1 p-0 my-4 relative z-10">
                    <div className="relative mb-6">
                        {player.tier === 'gold' && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 animate-bounce">
                                <Crown className="w-14 h-14 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                            </div>
                        )}
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-primary via-primary/20 to-primary">
                            <Avatar className={cn("w-36 h-36 border-4 border-background shadow-2xl", TIER_FRAME_CLASSES[player.tier])}>
                                {player.photoURL ? (
                                    <AvatarImage src={player.photoURL} alt={player.name} className="object-cover" />
                                ) : (
                                    <AvatarFallback className="bg-muted">
                                        <UserIcon className="w-16 h-16 text-muted-foreground" />
                                    </AvatarFallback>
                                )}
                            </Avatar>
                        </div>
                    </div>

                    <h1 className="text-3xl font-headline font-black uppercase tracking-tight text-foreground drop-shadow-sm mb-1">{player.name}</h1>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="h-[1px] w-4 bg-primary/30" />
                        <p className="font-mono text-primary font-bold text-xl tracking-tighter">{player.phId || `PH-${player.id.substring(0,4).toUpperCase()}`}</p>
                        <span className="h-[1px] w-4 bg-primary/30" />
                    </div>

                    {isMemberActive && (
                        <Badge className="font-bold tracking-[0.15em] bg-primary/10 text-primary border border-primary/30 px-4 py-1.5 rounded-full flex items-center shadow-sm">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            OFFICIAL MEMBER
                        </Badge>
                    )}
                </CardContent>

                <div className="mt-8 relative z-10">
                    <div className="p-6 bg-white rounded-[2rem] shadow-inner border border-primary/5">
                        <div className="flex flex-col items-center justify-center relative">
                           {qrValue ? (
                             <div className="relative group">
                                <div className="absolute inset-0 bg-primary/5 blur-xl group-hover:bg-primary/10 transition-colors rounded-lg" />
                                <QRCode
                                    value={qrValue}
                                    size={256}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%", position: "relative" }}
                                    viewBox={`0 0 256 256`}
                                    fgColor="hsl(var(--foreground))"
                                 />
                             </div>
                           ) : (
                             <div className="w-full aspect-square flex items-center justify-center">
                                <Skeleton className="h-full w-full rounded-xl" />
                             </div>
                           )}
                           <div className="mt-6 space-y-1">
                                <p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest text-center">
                                    Dynamic Security Code
                                </p>
                                <p className="text-[0.6rem] text-muted-foreground/60 text-center uppercase tracking-tighter">
                                    Refreshes every 30 seconds
                                </p>
                           </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-primary/10 flex justify-center relative z-10">
                    <p className="text-[10px] text-muted-foreground/40 font-medium tracking-[0.3em] uppercase">Private Player Identity</p>
                </div>
            </Card>
        </div>
    );
}

    