'use client';

import React, { useState, useMemo } from 'react';
import type { UserProfile, Match, WithId, TierThresholds } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useDoc, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import { Loader2, MapPin, Edit, Trash2, Trophy, Star, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { TIER_FRAME_CLASSES, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { useAppSettings } from '@/hooks/use-app-settings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { EditMatchForm } from '@/components/admin/edit-match-form';
import Link from 'next/link';
import { cn, getTier } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "CKXEmQyUjmVg6gcgGwcYOHGUgNo1";

function MatchCardSkeleton() {
    return (
        <Card className="p-4 sm:p-6 bg-card/50">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                {/* Team 1 Skeleton */}
                <div className="flex flex-col items-start gap-2">
                    <div className="flex">
                        <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full z-10" />
                        <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full -ml-4" />
                    </div>
                    <div className="space-y-1.5 mt-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </div>

                {/* Score Skeleton */}
                <div className="text-center">
                    <Skeleton className="h-10 sm:h-12 w-20 sm:w-24 mx-auto" />
                    <Skeleton className="h-4 w-8 mx-auto mt-2" />
                </div>
                
                {/* Team 2 Skeleton */}
                <div className="flex flex-col items-end gap-2">
                     <div className="flex justify-end">
                        <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full -mr-4 z-10" />
                        <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full" />
                    </div>
                     <div className="space-y-1.5 mt-1 items-end flex flex-col">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                </div>
            </div>

            <Skeleton className="h-px w-full my-4" />

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
            </div>
        </Card>
    );
}

function TeamDisplay({ players, isWinner, alignment = 'left' }: {
    players: WithId<UserProfile>[],
    isWinner: boolean,
    alignment?: 'left' | 'right'
}) {
    const player1 = players[0];
    const player2 = players[1];

    return (
        <div className={cn(
            "flex flex-col gap-2 w-full",
            alignment === 'left' ? 'items-start' : 'items-end'
        )}>
            {/* Avatars Container */}
            <div className="relative flex items-center">
                {isWinner && (
                    <Badge variant="default" className="absolute -top-3 z-20" style={alignment === 'left' ? { left: '1rem' } : { right: '1rem' }}>
                        <Star className="w-3 h-3 mr-1" />
                        WIN
                    </Badge>
                )}
                {player1 && 
                    <Avatar className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 border-2 z-10", 
                        TIER_FRAME_CLASSES[player1.tier] || ''
                    )}>
                        <AvatarImage src={player1.photoURL || undefined} alt={player1.name} />
                        <AvatarFallback>{player1.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                }
                {player2 && 
                    <Avatar className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 border-2 -ml-4",
                        TIER_FRAME_CLASSES[player2.tier] || ''
                    )}>
                        <AvatarImage src={player2.photoURL || undefined} alt={player2.name} />
                        <AvatarFallback>{player2.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                }
            </div>

            {/* Names Container */}
            <div className={cn(
                "mt-1 space-y-0.5", 
                alignment === 'left' ? 'text-left' : 'text-right'
            )}>
                {player1 && <p className="font-semibold text-[11px] sm:text-sm truncate max-w-[90px] sm:max-w-[150px]">{player1.name}</p>}
                {player2 && <p className="font-semibold text-[11px] text-muted-foreground sm:text-sm truncate max-w-[90px] sm:max-w-[150px]">{player2.name}</p>}
            </div>
        </div>
    );
}

function MatchCard({ match, playersMap, isAdmin, onEdit, onDelete }: { 
    match: WithId<Match>, 
    playersMap: Map<string, WithId<UserProfile>>, 
    isAdmin: boolean,
    onEdit: (e: React.MouseEvent, match: WithId<Match>) => void,
    onDelete: (e: React.MouseEvent, match: WithId<Match>) => void
}) {
    const team1_players = match.team_1.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
    const team2_players = match.team_2.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
    const isTeam1Winner = match.winner_team === 'Team 1';
    const isTeam2Winner = match.winner_team === 'Team 2';

    return (
        <Card className="p-4 sm:p-6 bg-card/50 relative transition-all hover:bg-accent/50 hover:shadow-md">
             {isAdmin && (
                <div className="absolute top-2 right-2 flex items-center gap-1 z-30">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => onEdit(e, match)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => onDelete(e, match)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )}
            
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                <TeamDisplay players={team1_players} isWinner={isTeam1Winner} alignment="left" />
                
                <div className="text-center">
                    <p className="font-black text-4xl sm:text-5xl tracking-tighter">
                        <span className={cn(isTeam1Winner && 'text-primary')}>{match.score_1}</span>
                        <span className="mx-1 sm:mx-2">:</span>
                        <span className={cn(isTeam2Winner && 'text-primary')}>{match.score_2}</span>
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-muted-foreground mt-1">VS</p>
                </div>

                <TeamDisplay players={team2_players} isWinner={isTeam2Winner} alignment="right" />
            </div>

            <Separator className="my-4" />
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{match.courtName || 'Unknown Court'}{match.courtLocation ? ` - ${match.courtLocation}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{format(match.timestamp.toDate(), "dd MMM yyyy")}</span>
                </div>
            </div>
        </Card>
    );
}

export function MatchHistoryClient() {
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<WithId<Match> | null>(null);
    const [matchToEdit, setMatchToEdit] = useState<WithId<Match> | null>(null);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const { thresholds } = useAppSettings();

    const matchesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'matches'), orderBy('timestamp', 'desc'));
    }, [firestore, user]);
    const { data: matches, isLoading: matchesLoading } = useCollection<WithId<Match>>(matchesQuery);

    const allPlayersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);

    const playersMap = React.useMemo(() => {
        if (!allPlayers) return new Map();
        return new Map(allPlayers.map(p => [p.id, p]));
    }, [allPlayers]);

    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;
    const isLoading = matchesLoading || allPlayersLoading || isUserLoading || isProfileLoading;

    const handleDeleteClick = (e: React.MouseEvent, match: WithId<Match>) => {
        e.stopPropagation();
        e.preventDefault();
        setMatchToDelete(match);
        setIsDeleteDialogOpen(true);
    };

    const handleEditClick = (e: React.MouseEvent, match: WithId<Match>) => {
        e.stopPropagation();
        e.preventDefault();
        setMatchToEdit(match);
        setIsEditDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!matchToDelete || !firestore || !allPlayers) return;
        setIsSubmitting(true);
    
        const batch = writeBatch(firestore);
    
        // Revert player stats
        for (const playerId of matchToDelete.player_ids) {
            const player = allPlayers.find(p => p.id === playerId);
            const pointInfo = matchToDelete.point_breakdown?.[playerId];
    
            if (player && pointInfo) {
                const playerRef = doc(firestore, 'users', playerId);
                const isWinner = (matchToDelete.winner_team === 'Team 1' && matchToDelete.team_1.includes(playerId)) ||
                               (matchToDelete.winner_team === 'Team 2' && matchToDelete.team_2.includes(playerId));
    
                const newTotalPoints = player.total_points - Math.round(pointInfo.total);
                const newMatchCount = player.match_count > 0 ? player.match_count - 1 : 0;
                const newWinCount = (isWinner && player.win_count > 0) ? player.win_count - 1 : player.win_count;
                
                batch.update(playerRef, {
                    total_points: newTotalPoints,
                    match_count: newMatchCount,
                    win_count: newWinCount,
                    tier: getTier(newTotalPoints, thresholds) // Recalculate tier
                });
            }
        }
    
        // Delete the match doc
        const matchRef = doc(firestore, 'matches', matchToDelete.id);
        batch.delete(matchRef);
    
        try {
            await batch.commit();
            toast({ title: 'Success', description: 'Match deleted and player points reverted.' });
        } catch (error) {
            console.error('Error deleting match:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete match.' });
        } finally {
            setIsDeleteDialogOpen(false); // This will trigger onOpenChange
            setIsSubmitting(false);
        }
    };
    
    const handleEditOpenChange = (isOpen: boolean) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
            setMatchToEdit(null);
        }
    };

    const handleDeleteOpenChange = (isOpen: boolean) => {
        setIsDeleteDialogOpen(isOpen);
        if (!isOpen) {
            setMatchToDelete(null);
        }
    };

    if (!isUserLoading && !user) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    <p className="mb-4">You must be logged in to view match history.</p>
                    <Button asChild>
                        <Link href="/login">Login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <MatchCardSkeleton />
                <MatchCardSkeleton />
                <MatchCardSkeleton />
            </div>
        )
    }

    if (!matches || matches.length === 0) {
        return (
             <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No matches have been played yet.
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <div className="space-y-4">
                {matches.map(match => (
                    <Link href={`/matches/${match.id}`} key={match.id} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        <MatchCard 
                            match={match} 
                            playersMap={playersMap} 
                            isAdmin={isAdmin}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                        />
                    </Link>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={handleEditOpenChange}>
                <DialogContent 
                    className="max-w-4xl"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Edit Match Results</DialogTitle>
                        <DialogDescription>
                            Modify the details of the match. Player stats will be recalculated upon saving.
                        </DialogDescription>
                    </DialogHeader>
                    {matchToEdit && allPlayers && (
                        <EditMatchForm 
                            match={matchToEdit} 
                            allPlayers={allPlayers} 
                            setOpen={setIsEditDialogOpen}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Alert Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={handleDeleteOpenChange}>
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the match record and revert the points and stats for all four players involved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                            {isSubmitting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
