'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import type { Match, UserProfile, WithId, PointBreakdown } from '@/lib/types';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, MapPin, ArrowLeft, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { TIER_FRAME_CLASSES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function MatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { firestore } = useFirebase();

    const matchRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'matches', id);
    }, [firestore, id]);
    const { data: match, isLoading: matchLoading } = useDoc<Match>(matchRef);

    const allPlayersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);

    const playersMap = useMemo(() => {
        if (!allPlayers) return new Map();
        return new Map(allPlayers.map(p => [p.id, p]));
    }, [allPlayers]);

    if (matchLoading || allPlayersLoading) {
        return (
            <SidebarInset>
                <div className="p-2 sm:p-6 lg:p-8">
                    <div className="max-w-4xl mx-auto">
                        <Skeleton className="h-10 w-36 mb-4" />
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <Skeleton className="h-8 w-48 mb-2" />
                                        <Skeleton className="h-5 w-64" />
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <Skeleton className="h-5 w-24 ml-auto" />
                                        <Skeleton className="h-10 w-28 ml-auto mt-1" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                    <Skeleton className="h-64 w-full" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </SidebarInset>
        );
    }
    
    if (!match) {
        notFound();
    }
    
    const team1Players = match.team_1.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
    const team2Players = match.team_2.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <Button variant="outline" onClick={() => router.back()} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to History
                    </Button>
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <CardTitle className="font-headline text-2xl">Match Details</CardTitle>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-2">
                                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4"/> {format(match.timestamp.toDate(), "eeee, dd MMMM yyyy")}</div>
                                        {match.courtName && <div className="flex items-center gap-2"><MapPin className="h-4 w-4"/>{match.courtName} - {match.courtLocation}</div>}
                                        {match.eventName && (
                                            <div className="flex items-center gap-2">
                                                <Trophy className="h-4 w-4"/>
                                                Event: {match.eventName} {match.roundNumber && `(Round ${match.roundNumber})`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm text-muted-foreground">Final Score</p>
                                    <p className="font-black text-3xl tracking-tight">
                                        <span className={cn(match.winner_team === 'Team 1' && 'text-primary')}>{match.score_1}</span>
                                        <span> - </span>
                                        <span className={cn(match.winner_team === 'Team 2' && 'text-primary')}>{match.score_2}</span>
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <TeamDetails teamName="Team 1" players={team1Players} isWinner={match.winner_team === 'Team 1'} pointBreakdown={match.point_breakdown} />
                                <TeamDetails teamName="Team 2" players={team2Players} isWinner={match.winner_team === 'Team 2'} pointBreakdown={match.point_breakdown} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SidebarInset>
    );
}

// Sub-components for the detail page
function TeamDetails({ teamName, players, isWinner, pointBreakdown }: { teamName: string, players: WithId<UserProfile>[], isWinner: boolean, pointBreakdown?: { [key: string]: PointBreakdown } }) {
    return (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{teamName}</h3>
                {isWinner && <Badge className="bg-primary hover:bg-primary">Winner</Badge>}
            </div>
            <div className="space-y-6">
                {players.map(player => (
                    <PlayerPointBreakdown key={player.id} player={player} breakdown={pointBreakdown?.[player.id]} />
                ))}
            </div>
        </div>
    )
}

function PlayerPointBreakdown({ player, breakdown }: { player: WithId<UserProfile>, breakdown?: PointBreakdown }) {
    if (!breakdown) {
        return (
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className={cn("w-10 h-10", TIER_FRAME_CLASSES[player.tier])}>
                        {player.photoURL && <AvatarImage src={player.photoURL} alt={player.name} />}
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{player.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">No point data</p>
            </div>
        );
    }
    
    const BreakdownItem = ({ label, value }: { label: string, value: number }) => {
        if (value === 0) return null;
        return (
            <li className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn('font-semibold', value > 0 ? 'text-green-500' : 'text-destructive')}>{value > 0 ? `+${Math.round(value)}` : Math.round(value)}</span>
            </li>
        )
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                     <Link href={`/players/${player.id}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                        <Avatar className={cn("w-10 h-10", TIER_FRAME_CLASSES[player.tier])}>
                            {player.photoURL && <AvatarImage src={player.photoURL} alt={player.name} />}
                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </Link>
                    <div>
                         <Link href={`/players/${player.id}`} className="font-semibold hover:underline">{player.name}</Link>
                         <p className="text-xs text-muted-foreground">{player.phId}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-black text-xl text-primary">{Math.round(breakdown.total) > 0 ? `+${Math.round(breakdown.total)}` : Math.round(breakdown.total)}</p>
                    <p className="text-xs text-muted-foreground -mt-1">Total Poin</p>
                </div>
            </div>
            <Card className="bg-card/50 p-3">
                <ul className="space-y-1">
                    <BreakdownItem label="Partisipasi" value={breakdown.base} />
                    <BreakdownItem label="Hasil Match" value={breakdown.result} />
                    <BreakdownItem label="Margin Skor" value={breakdown.margin} />
                    <BreakdownItem label="Host Match" value={breakdown.host_match} />
                    <BreakdownItem label="On-Time" value={breakdown.on_time} />
                    <BreakdownItem label="Fair Play" value={breakdown.fair_play} />
                    <BreakdownItem label="Isi Slot Kosong" value={breakdown.slot_filler} />
                    <BreakdownItem label="Konsistensi" value={breakdown.consistency} />
                </ul>
            </Card>
        </div>
    )
}
