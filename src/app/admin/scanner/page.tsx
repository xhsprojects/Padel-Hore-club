'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { Loader2, UserX, PlusSquare, Users } from 'lucide-react';
import type { UserProfile, WithId } from '@/lib/types';
import { doc, collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { QrScanner } from '@/components/admin/qr-scanner';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

function ScannerPageContent() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [scannedPlayers, setScannedPlayers] = useState<WithId<UserProfile>[]>([]);
    const [isScanning, setIsScanning] = useState(true);

    const eventId = searchParams.get('eventId');
    const roundNumber = searchParams.get('roundNumber');

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const allPlayersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);
    const playerMap = useMemo(() => new Map(allPlayers?.map(p => [p.id, p])), [allPlayers]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleScanSuccess = (decodedText: string) => {
        if (scannedPlayers.length >= 4) {
            toast({
                variant: 'destructive',
                title: 'Match Full',
                description: 'Please create the match or remove a player to scan another one.',
            });
            return;
        }
        
        setIsScanning(false); // Pause scanning to process

        try {
            const qrData = JSON.parse(decodedText);
            if (!qrData.uid || !qrData.timestamp) {
                throw new Error("Invalid QR code data.");
            }

            const now = Date.now();
            if (now - qrData.timestamp > 60000) { // 60-second validity
                toast({ variant: "destructive", title: "QR Code Expired", description: "Please ask the player to refresh their card." });
                setIsScanning(true);
                return;
            }

            const player = playerMap.get(qrData.uid);
            if (!player) {
                toast({ variant: "destructive", title: "Player Not Found", description: "This QR code does not belong to a registered player." });
                setIsScanning(true);
                return;
            }

            if (scannedPlayers.some(p => p.id === player.id)) {
                toast({ variant: "destructive", title: "Player Already Scanned", description: `${player.name} is already in the list.` });
                setIsScanning(true);
                return;
            }

            // Check membership status
            if (player.role === 'member' && player.membershipExpiryDate && new Date(player.membershipExpiryDate.seconds * 1000) < new Date()) {
                toast({ variant: "destructive", title: "Membership Expired", description: `${player.name}'s membership has expired.` });
            }

            setScannedPlayers(prev => [...prev, player]);
            toast({ title: 'Player Added!', description: `${player.name} has been checked in.` });

            // Resume scanning only if we haven't reached 4 players
            if (scannedPlayers.length < 3) {
                 setTimeout(() => setIsScanning(true), 500);
            }

        } catch (e) {
            toast({ variant: "destructive", title: "Invalid QR Code", description: "This QR code could not be read." });
            setTimeout(() => setIsScanning(true), 500);
        }
    };
    
    const removePlayer = (playerId: string) => {
        setScannedPlayers(prev => prev.filter(p => p.id !== playerId));
        if (scannedPlayers.length === 4) {
            setIsScanning(true);
        }
    };
    
    const handleCreateMatch = () => {
        if (scannedPlayers.length !== 4) {
            toast({
                variant: 'destructive',
                title: 'Not Enough Players',
                description: 'You need to scan 4 players to create a match.',
            });
            return;
        }
        const playerIds = scannedPlayers.map(p => p.id).join(',');
        let targetUrl = `/admin?players=${playerIds}&onTime=true`;
        if (eventId) targetUrl += `&eventId=${eventId}`;
        if (roundNumber) targetUrl += `&roundNumber=${roundNumber}`;
        router.push(targetUrl);
    };

    if (isUserLoading || isProfileLoading || allPlayersLoading || !user) {
        return <ScannerSkeleton />;
    }

    const isDefaultAdmin = user.uid === DEFAULT_ADMIN_UID;
    if (userProfile?.role !== 'admin' && !isDefaultAdmin) {
        return (
            <SidebarInset>
                <div className="p-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                        <CardContent><p>You do not have permission to view this page.</p></CardContent>
                    </Card>
                </div>
            </SidebarInset>
        );
    }
    
    const isReadyToCreate = scannedPlayers.length === 4;

    return (
        <SidebarInset>
            <div className="p-4 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">QR Match Check-in</CardTitle>
                        <CardDescription>Scan players one by one to add them to the match. Once 4 players are added, create the match.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                {isScanning && !isReadyToCreate ? (
                                    <QrScanner onScanSuccess={handleScanSuccess} />
                                ) : (
                                    <div className="text-center p-4">
                                        {isReadyToCreate ? (
                                             <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                                                    <Users className="h-8 w-8" />
                                                </div>
                                                <h3 className="text-lg font-bold">Match is Ready!</h3>
                                                <p className="text-muted-foreground">Click "Create Match" to proceed to the scoring page.</p>
                                                <Button onClick={() => setIsScanning(true)}>Scan Again</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                                                <p className="text-muted-foreground">Processing scan...</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg">Scanned Players ({scannedPlayers.length}/4)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {Array.from({ length: 4 }).map((_, index) => {
                                        const player = scannedPlayers[index];
                                        return (
                                            <Card key={index} className={`aspect-square flex items-center justify-center p-2 relative ${player ? 'bg-card' : 'bg-muted/50 border-dashed'}`}>
                                                {player ? (
                                                    <div className="text-center">
                                                        <Avatar className="w-16 h-16 mx-auto mb-2">
                                                            {player.photoURL && <AvatarImage src={player.photoURL} />}
                                                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <p className="font-semibold text-sm truncate">{player.name}</p>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-6 w-6"
                                                            onClick={() => removePlayer(player.id)}
                                                        >
                                                            <UserX className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground text-sm">Slot {index + 1}</p>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>
                                <Button
                                    onClick={handleCreateMatch}
                                    disabled={scannedPlayers.length !== 4}
                                    className="w-full"
                                >
                                    <PlusSquare className="mr-2 h-4 w-4" />
                                    Create Match
                                </Button>
                                {scannedPlayers.length > 0 && 
                                    <Button variant="outline" onClick={() => { setScannedPlayers([]); setIsScanning(true); }} className="w-full">
                                        Clear All
                                    </Button>
                                }
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    );
}

function ScannerSkeleton() {
    return (
        <SidebarInset>
            <div className="p-4 sm:p-6 lg:p-8">
                 <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <Skeleton className="w-full aspect-square rounded-lg" />
                            <div className="space-y-4">
                                 <Skeleton className="h-7 w-48" />
                                 <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="aspect-square" />
                                    <Skeleton className="aspect-square" />
                                    <Skeleton className="aspect-square" />
                                    <Skeleton className="aspect-square" />
                                 </div>
                                 <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    );
}

import React, { Suspense } from 'react';

export default function ScannerPage() {
    return (
        <Suspense fallback={<ScannerSkeleton />}>
            <ScannerPageContent />
        </Suspense>
    );
}

