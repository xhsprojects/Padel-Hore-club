'use client';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import type { Event, EventRegistration, WithId, Match, UserProfile, EventStatus, Round } from '@/lib/types';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Calendar, Clock, UserCheck, Hourglass, Swords, Camera, Trophy, UserX, MapPin, ShieldCheck, Crown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { EventRegistrationManager } from '@/components/events/event-registration-manager';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import { cn, getEventStatus } from '@/lib/utils';
import Link from 'next/link';
import { TIER_FRAME_CLASSES } from '@/lib/constants';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const eventStatusDetails: { [key in EventStatus]: { label: string, className: string } } = {
    'ongoing': { label: 'Ongoing', className: 'bg-green-500 text-white animate-pulse' },
    'upcoming': { label: 'Upcoming', className: 'bg-blue-500 text-white' },
    'completed': { label: 'Completed', className: 'bg-muted text-muted-foreground border-border' },
    'cancelled': { label: 'Cancelled', className: 'bg-destructive text-destructive-foreground' },
}

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();

    const eventRef = useMemoFirebase(() => firestore ? doc(firestore, 'events', id) : null, [firestore, id]);
    const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

    const registrationsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'events', id, 'registrations'), orderBy('registrationTimestamp', 'asc')) : null, [firestore, id]);
    const { data: registrations, isLoading: registrationsLoading } = useCollection<WithId<EventRegistration>>(registrationsQuery);
    
    const matchesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'matches'), where('eventId', '==', id)) : null, [firestore, id]);
    const { data: matches, isLoading: matchesLoading } = useCollection<WithId<Match>>(matchesQuery);

    const allPlayersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore, id]);
    const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);

    const playersMap = useMemo(() => new Map(allPlayers?.map(p => [p.id, p])), [allPlayers]);
    
    const eventLeaderboard = useMemo(() => {
        if (!registrations || !matches || !playersMap) return [];
    
        const participantScores: { [key: string]: { player: WithId<UserProfile>, points: number, wins: number, matchesPlayed: number } } = {};
    
        registrations.forEach(reg => {
            const player = playersMap.get(reg.userId);
            if (player) {
                participantScores[reg.userId] = { player, points: 0, wins: 0, matchesPlayed: 0 };
            }
        });
    
        matches.forEach(match => {
            const isTeam1Winner = match.winner_team === 'Team 1';
            const isTeam2Winner = match.winner_team === 'Team 2';

            for (const playerId of match.player_ids) {
                if (participantScores[playerId]) {
                    participantScores[playerId].matchesPlayed += 1;
                    
                    if (match.point_breakdown && match.point_breakdown[playerId]) {
                        participantScores[playerId].points += Math.round(match.point_breakdown[playerId].total);
                    }

                    const isPlayerInTeam1 = match.team_1.includes(playerId);
                    if ((isTeam1Winner && isPlayerInTeam1) || (isTeam2Winner && !isPlayerInTeam1)) {
                        participantScores[playerId].wins += 1;
                    }
                }
            }
        });
        
        return Object.values(participantScores).sort((a, b) => b.points - a.points);
    }, [registrations, matches, playersMap]);

    const { confirmedParticipants, waitlistedParticipants } = useMemo(() => {
        if (!registrations) return { confirmedParticipants: [], waitlistedParticipants: [] };
        const confirmed = registrations.filter(r => r.status === 'confirmed');
        const waitlisted = registrations.filter(r => r.status === 'waitlisted');
        return { confirmedParticipants: confirmed, waitlistedParticipants: waitlisted };
    }, [registrations]);

    const isLoading = eventLoading || registrationsLoading || matchesLoading || allPlayersLoading || isUserLoading;

    if (isLoading) {
        return (
            <SidebarInset>
                <div className="p-2 sm:p-6 lg:p-8"><div className="max-w-4xl mx-auto"><Skeleton className="h-10 w-36 mb-4" /><Card className="overflow-hidden"><Skeleton className="h-48 md:h-64 w-full" /><CardHeader><div className="flex justify-between"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-6 w-24" /></div><div className="flex gap-x-6 pt-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-32" /></div></CardHeader><CardContent className="grid md:grid-cols-3 gap-8"><div className="md:col-span-2 space-y-6"><Skeleton className="h-10 w-full" /><div className="mt-6 space-y-4"><Skeleton className="h-64 w-full" /></div></div><div className="md:col-span-1"><Skeleton className="h-48 w-full" /></div></CardContent></Card></div></div>
            </SidebarInset>
        );
    }
    
    if (!event) notFound();
    
    const isFull = confirmedParticipants.length >= event.maxParticipants;
    const status = getEventStatus(event);
    const statusDetails = eventStatusDetails[status];

    return (
         <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8"><div className="max-w-4xl mx-auto"><Button variant="outline" onClick={() => router.back()} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Back to Events</Button><Card className="overflow-hidden">{event.bannerUrl && <div className="relative h-48 md:h-64 w-full"><Image src={event.bannerUrl} alt={event.name} fill className="object-cover" /></div>}<CardHeader><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><CardTitle className="font-headline text-3xl">{event.name}</CardTitle><Badge className={cn("w-fit", statusDetails.className)}>{statusDetails.label}</Badge></div><div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-muted-foreground pt-2"><div className="flex items-center gap-2"><Calendar className="h-4 w-4"/> {format(event.startDate.toDate(), "eeee, dd MMMM yyyy")}</div><div className="flex items-center gap-2"><Clock className="h-4 w-4"/> {format(event.startDate.toDate(), "p")} - {format(event.endDate.toDate(), "p")}</div></div></CardHeader><CardContent className="grid md:grid-cols-3 gap-8"><div className="md:col-span-2 space-y-6"><Tabs defaultValue="details" className="w-full"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="leaderboard">Leaderboard</TabsTrigger><TabsTrigger value="matches">Matches</TabsTrigger></TabsList><TabsContent value="details" className="mt-6"><div className="space-y-6"><div><h3 className="font-bold text-lg mb-2">Event Details</h3><p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p></div><EventGallery urls={event.galleryUrls || []} /><ParticipantList title="Confirmed Participants" icon={UserCheck} participants={confirmedParticipants} max={event.maxParticipants} /><ParticipantList title="Waitlist" icon={Hourglass} participants={waitlistedParticipants} /></div></TabsContent><TabsContent value="leaderboard" className="mt-6"><EventLeaderboard leaderboard={eventLeaderboard} /></TabsContent><TabsContent value="matches" className="mt-6"><MatchList event={event} matches={matches || []} playersMap={playersMap} /></TabsContent></Tabs></div><div className="md:col-span-1"><Card className="bg-card/50 sticky top-20"><CardHeader><CardTitle className="text-xl">Registration</CardTitle></CardHeader><CardContent><div className="flex justify-between items-center text-sm font-bold"><span>Slots Filled</span><span>{confirmedParticipants.length} / {event.maxParticipants}</span></div><div className="w-full bg-muted rounded-full h-2.5 my-2"><div className="bg-primary h-2.5 rounded-full" style={{ width: `${(confirmedParticipants.length / event.maxParticipants) * 100}%` }}></div></div>{isFull && waitlistedParticipants.length > 0 && <p className="text-xs text-center text-muted-foreground">{waitlistedParticipants.length} on waitlist</p>}</CardContent><CardFooter><EventRegistrationManager event={event} registrations={registrations || []} /></CardFooter></Card></div></CardContent></Card></div></div>
        </SidebarInset>
    );
}

function EventLeaderboard({ leaderboard }: { leaderboard: { player: WithId<UserProfile>, points: number, wins: number, matchesPlayed: number }[] }) {
    const top3Players = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
    const otherPlayers = useMemo(() => leaderboard.slice(3), [leaderboard]);

    if (leaderboard.length === 0) {
        return <Card className="p-4 bg-card/50 text-center"><p className="text-muted-foreground">No matches played in this event yet.</p></Card>;
    }
    
    return (
        <div className="space-y-4">
            <EventPodium top3Players={top3Players} />
            <div className="space-y-2">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">
                    <div className="w-10">Rank</div>
                    <div className="flex-1">Player</div>
                    <div className="w-12 text-right">Points</div>
                </div>
                {otherPlayers.map((entry, index) => (
                    <Link href={`/players/${entry.player.id}`} key={entry.player.id} className="flex items-center p-3 rounded-2xl bg-slate-900/50 hover:bg-slate-900 transition-colors group">
                        <div className="w-10 font-black text-slate-400 text-base">{index + 4}</div>
                        <div className="flex-1 flex items-center gap-3">
                            <div className="relative">
                                <Avatar className="w-11 h-11">
                                    <AvatarImage src={entry.player.photoURL || undefined} alt={entry.player.name} />
                                    <AvatarFallback>{entry.player.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                {entry.player.role === 'member' && (entry.player.isUnlimitedMember || (entry.player.membershipExpiryDate && entry.player.membershipExpiryDate.toDate() > new Date())) && (
                                    <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 border-2 border-card">
                                        <ShieldCheck className="h-2.5 w-2.5 text-background" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-sm">{entry.player.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                    Main: <span className="text-slate-200">{entry.matchesPlayed}</span> • Win: <span className="text-emerald-500">{entry.matchesPlayed > 0 ? ((entry.wins / entry.matchesPlayed) * 100).toFixed(0) : 0}%</span>
                                </p>
                            </div>
                        </div>
                        <div className="w-12 text-right font-black text-lg">{entry.points}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

function EventPodium({ top3Players }: { top3Players: { player: WithId<UserProfile>, points: number }[] }) {
    const podiumSlots = [
        { rank: 2, player: top3Players[1] },
        { rank: 1, player: top3Players[0] },
        { rank: 3, player: top3Players[2] }
    ];
    return (
        <div className="flex items-end justify-center gap-3">
            {podiumSlots.map(({ rank, player }) => {
                if (!player) return <div key={rank} className={`flex-1 ${rank === 1 ? 'flex-[1.2]' : ''}`} />;
                return (
                    <Link href={`/players/${player.player.id}`} key={player.player.id} className={`flex-1 flex flex-col items-center group ${rank === 1 ? 'flex-[1.2]' : ''}`}>
                        <div className={`w-full rounded-3xl flex flex-col items-center shadow-lg transition-transform ${rank === 1 ? 'rank-card-1 glass-card pt-6 pb-8 rounded-[32px] relative z-10 scale-105 group-hover:scale-110' : rank === 2 ? 'rank-card-2 glass-card pt-4 pb-5 group-hover:scale-105' : 'rank-card-3 glass-card pt-4 pb-5 group-hover:scale-105'}`}>
                            {rank === 1 && <Crown className="absolute -top-3 text-primary h-8 w-8 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />}
                            <div className={`relative mb-3 ${rank === 1 ? 'mt-2 mb-4' : ''}`}>
                                <div className={`rounded-full p-0.5 shadow-xl ${rank === 1 ? 'w-20 h-20 border-4 border-primary' : 'w-16 h-16 border-2 border-white/20'}`}>
                                    <Avatar className="w-full h-full">
                                        <AvatarImage src={player.player.photoURL || undefined} alt={player.player.name} />
                                        <AvatarFallback>{player.player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className={`absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-xs font-black border-2 border-background shadow-lg ${rank === 1 ? 'w-7 h-7 bg-primary text-background' : 'w-6 h-6 bg-slate-300 text-slate-900'}`}>{rank}</div>
                            </div>
                            <div className="text-center px-1">
                                <p className={`font-bold truncate ${rank === 1 ? 'text-base text-white tracking-tight max-w-[100px]' : 'text-xs text-slate-200 max-w-[80px]'}`}>{player.player.name}</p>
                                <p className={`font-black mt-0.5 ${rank === 1 ? 'text-primary text-2xl' : 'text-slate-100 font-extrabold text-base'}`}>{player.points}</p>
                                <p className={`-mt-1 uppercase tracking-widest font-bold ${rank === 1 ? 'text-[10px] text-primary/70 font-black' : 'text-[9px] text-slate-400'}`}>PTS</p>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

function EventGallery({ urls }: { urls: string[] }) {
    if (!urls || urls.length === 0) return null;
    return <div><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Camera className="h-5 w-5" />Event Gallery</h3><Carousel opts={{align: "start"}} className="w-full"><CarouselContent>{urls.map((url, index) => <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3"><div className="p-1"><Card><CardContent className="relative aspect-video flex items-center justify-center p-0 overflow-hidden rounded-lg"><Image src={url} alt={`Event gallery image ${index + 1}`} fill className="object-cover transition-transform hover:scale-105" /></CardContent></Card></div></CarouselItem>)}</CarouselContent><CarouselPrevious /><CarouselNext /></Carousel></div>;
}

function ParticipantList({ title, icon: Icon, participants, max }: { title: string, icon: React.ElementType, participants: WithId<EventRegistration>[], max?: number }) {
    if (participants.length === 0 && title === 'Waitlist') return null;
    return <div><h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Icon className="h-5 w-5" />{title} {max && `(${participants.length}/${max})`}</h3>{participants.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{participants.map((p, index) => <div key={p.id} className="flex flex-col items-center text-center gap-2"><Avatar>{p.userPhotoUrl && <AvatarImage src={p.userPhotoUrl} />}<AvatarFallback>{p.userName.charAt(0)}</AvatarFallback></Avatar><p className="text-xs font-medium truncate w-full">{title === 'Waitlist' && `${index + 1}. `}{p.userName}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No one has registered yet.</p>}</div>;
}

function MatchList({ event, matches, playersMap }: { event: WithId<Event>, matches: WithId<Match>[], playersMap: Map<string, WithId<UserProfile>> }) {
    const roundsWithData = useMemo(() => {
        if (!event?.rounds) return [{ roundNumber: 0, matches, byePlayers: [] }]; // Fallback for old events
        return event.rounds.map(round => ({
            ...round,
            matches: matches?.filter(m => m.roundNumber === round.roundNumber).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()) || [],
            byePlayers: round.byePlayerIds?.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[] || [],
        })).sort((a, b) => a.roundNumber - b.roundNumber);
    }, [event, matches, playersMap]);
    
    if (matches.length === 0) {
        return <p className="text-sm text-muted-foreground">No matches have been played in this event yet.</p>;
    }

    return <div className="space-y-6">{roundsWithData.map(round => round.matches.length > 0 || round.byePlayers.length > 0 ? <div key={round.roundNumber}><h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Trophy className="h-5 w-5 text-primary"/>Round {round.roundNumber}</h3><div className="space-y-3">{round.matches.map(match => <EventMatchCard key={match.id} match={match} playersMap={playersMap} />)}{round.byePlayers.length > 0 && <Card className="p-4 mt-4"><h4 className="font-semibold mb-2 flex items-center gap-2"><UserX className="h-4 w-4"/>Bye Players</h4><div className="flex flex-wrap gap-x-4 gap-y-2">{round.byePlayers.map(p => <div key={p.id} className="flex items-center gap-2"><Avatar className="w-6 h-6">{p.photoURL && <AvatarImage src={p.photoURL} /> }<AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar><p className="text-sm">{p.name}</p></div>)}</div></Card>}</div></div> : null)}</div>;
}

function EventTeamDisplay({ players, isWinner, alignment = 'left' }: { players: WithId<UserProfile>[], isWinner: boolean, alignment?: 'left' | 'right' }) {
    const player1 = players[0];
    const player2 = players[1];

    return (
        <div className={cn("flex flex-col gap-2 w-full", alignment === 'left' ? 'items-start' : 'items-end')}>
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
                        TIER_FRAME_CLASSES[player1.tier] || '',
                        alignment === 'right' ? '-mr-4' : ''
                    )}>
                        <AvatarImage src={player1.photoURL || undefined} alt={player1.name} />
                        <AvatarFallback>{player1.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                }
                {player2 && 
                    <Avatar className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 border-2",
                        TIER_FRAME_CLASSES[player2.tier] || '',
                        alignment === 'left' ? '-ml-4' : ''
                    )}>
                        <AvatarImage src={player2.photoURL || undefined} alt={player2.name} />
                        <AvatarFallback>{player2.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                }
            </div>
            <div className={cn("mt-1 space-y-0.5", alignment === 'left' ? 'text-left' : 'text-right')}>
                {player1 && <p className="font-semibold text-[11px] sm:text-sm truncate max-w-[90px] sm:max-w-[150px]">{player1.name}</p>}
                {player2 && <p className="font-semibold text-[11px] text-muted-foreground sm:text-sm truncate max-w-[90px] sm:max-w-[150px]">{player2.name}</p>}
            </div>
        </div>
    );
}

function EventMatchCard({ match, playersMap }: { match: WithId<Match>, playersMap: Map<string, WithId<UserProfile>> }) {
    const team1Players = match.team_1.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
    const team2Players = match.team_2.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
    const isTeam1Winner = match.winner_team === 'Team 1';
    const isTeam2Winner = match.winner_team === 'Team 2';

    return (
        <Link href={`/matches/${match.id}`} className="block">
            <Card className="p-4 sm:p-6 bg-card/50 relative transition-all hover:bg-accent/50 hover:shadow-md">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                    <EventTeamDisplay players={team1Players} isWinner={isTeam1Winner} alignment="left" />
                    
                    <div className="text-center">
                        <p className="font-black text-4xl sm:text-5xl tracking-tighter">
                            <span className={cn(isTeam1Winner && 'text-primary')}>{match.score_1}</span>
                            <span className="mx-1 sm:mx-2">:</span>
                            <span className={cn(isTeam2Winner && 'text-primary')}>{match.score_2}</span>
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-muted-foreground mt-1">VS</p>
                    </div>

                    <EventTeamDisplay players={team2Players} isWinner={isTeam2Winner} alignment="right" />
                </div>

                <Separator className="my-4" />
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{match.courtName || 'Unknown Court'}{match.courtLocation ? ` - ${match.courtLocation}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{format(match.timestamp.toDate(), "dd MMM yyyy, p")}</span>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
