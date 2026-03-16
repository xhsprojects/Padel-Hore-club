
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

import { TIER_COLORS, TIER_BANNER_COLORS, TIER_FRAME_CLASSES, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { format } from 'date-fns';
import { useFirebase, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { UserProfile, Match, WithId, Tier, Season, TierThresholds } from '@/lib/types';
import React, { useEffect } from 'react';
import { cn, getSkillLevelFromWinRate, getTier, capitalize } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ShieldCheck, User as UserIcon, Settings, Star, Phone, Eye, EyeOff, Trophy, MapPin, CalendarClock, Share2, BarChart3, History as HistoryIcon, Users, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Crown } from '@/components/icons';
import { BadgeDisplay } from '@/components/profile/badge-display';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function MyProfilePage() {
  const router = useRouter();

  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();

  // Get the logged-in user's profile
  const playerRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: player, isLoading: playerLoading } = useDoc<UserProfile>(playerRef);

  const tierSettingsRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return doc(firestore, 'settings', 'tier_thresholds');
  }, [firestore]);
  const { data: tierSettings, isLoading: tierSettingsLoading } = useDoc<TierThresholds>(tierSettingsRef);
  const thresholds = tierSettings || DEFAULT_THRESHOLDS;

  // Get matches for the logged-in user
  const matchesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'matches'), 
      where('player_ids', 'array-contains', user.uid)
    );
  }, [firestore, user]);
  const { data: matches, isLoading: matchesLoading } = useCollection<WithId<Match>>(matchesQuery);
  
  const sortedMatches = React.useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
  }, [matches]);

  // Get all players for name mapping in match history
  const allPlayersQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);
  const getPlayerName = (id: string) => allPlayers?.find(p => p.id === id)?.name || 'Unknown';
  const getPlayerData = (id: string) => allPlayers?.find(p => p.id === id);

  const seasonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'seasons'), where('isActive', '==', true));
  }, [firestore]);
  const { data: activeSeasons, isLoading: seasonsLoading } = useCollection<WithId<Season>>(seasonsQuery);
  const activeSeason = activeSeasons?.[0];

  const { seasonStats, lifetimeStats } = React.useMemo(() => {
      if (!player) return { seasonStats: null, lifetimeStats: null };

      const life = {
          matches: player.match_count || 0,
          wins: player.win_count || 0,
          winRate: (player.match_count || 0) > 0 ? ((player.win_count || 0) / (player.match_count || 0)) * 100 : 0,
      };

      if (!activeSeason || !matches) {
          return { seasonStats: null, lifetimeStats: life };
      }

      const seasonMatches = matches.filter(m => {
          if (!m.timestamp) return false;
          const matchDate = m.timestamp.toDate();
          return matchDate >= activeSeason.startDate.toDate() && matchDate <= activeSeason.endDate.toDate();
      });

      const seasonWins = seasonMatches.filter(m => {
          const isWinner = (m.winner_team === 'Team 1' && m.team_1.includes(player.id)) || (m.winner_team === 'Team 2' && m.team_2.includes(player.id));
          return isWinner;
      }).length;

      const season = {
          matches: seasonMatches.length,
          wins: seasonWins,
          winRate: seasonMatches.length > 0 ? (seasonWins / seasonMatches.length) * 100 : 0,
      };

      return { seasonStats: season, lifetimeStats: life };

  }, [player, matches, activeSeason]);

  const currentWinStreak = React.useMemo(() => {
    if (!player || !sortedMatches) return 0;
    let streak = 0;
    for (const match of sortedMatches) {
      const isTeam1 = match.team_1.includes(player.id);
      const isWinner = (isTeam1 && match.winner_team === 'Team 1') || (!isTeam1 && match.winner_team === 'Team 2');
      if (isWinner) {
        streak++;
      } else {
        break; // Streak is broken by a loss or draw
      }
    }
    return streak;
  }, [sortedMatches, player]);
  
  const bestPartner = React.useMemo(() => {
    if (!matches || !player || !allPlayers) return null;

    const partnerStats: { [id: string]: { wins: number; matches: number } } = {};

    matches.forEach(match => {
      const playerIsTeam1 = match.team_1.includes(player.id);
      const playerTeam = playerIsTeam1 ? match.team_1 : match.team_2;
      const partnerId = playerTeam.find(pId => pId !== player.id);

      if (partnerId) {
        if (!partnerStats[partnerId]) {
          partnerStats[partnerId] = { wins: 0, matches: 0 };
        }
        partnerStats[partnerId].matches++;

        const isWinner = (playerIsTeam1 && match.winner_team === 'Team 1') || (!playerIsTeam1 && match.winner_team === 'Team 2');
        if (isWinner) {
          partnerStats[partnerId].wins++;
        }
      }
    });

    let bestPartnerId: string | null = null;
    let maxWinRate = -1;

    const MIN_GAMES = 3;

    for (const partnerId in partnerStats) {
      const stats = partnerStats[partnerId];
      if (stats.matches >= MIN_GAMES) {
        const winRate = stats.wins / stats.matches;
        if (winRate > maxWinRate) {
          maxWinRate = winRate;
          bestPartnerId = partnerId;
        } else if (winRate === maxWinRate) {
          if (bestPartnerId && stats.matches > partnerStats[bestPartnerId].matches) {
            bestPartnerId = partnerId;
          }
        }
      }
    }

    if (!bestPartnerId) return null;

    const partnerData = allPlayers.find(p => p.id === bestPartnerId);
    if (!partnerData) return null;

    const partnerTier = getTier(partnerData.total_points, thresholds);

    return {
      ...partnerData,
      tier: partnerTier,
      winRate: maxWinRate * 100,
      matches: partnerStats[bestPartnerId].matches,
    };
  }, [matches, player, allPlayers, thresholds]);

  const isLoading = playerLoading || matchesLoading || allPlayersLoading || isUserLoading || seasonsLoading || tierSettingsLoading;
  
  useEffect(() => {
    if (!isUserLoading && !playerLoading && (!user || !player)) {
      router.push('/login');
    }
  }, [isUserLoading, playerLoading, user, player, router]);

  if (isLoading || !user || !player || !allPlayers) {
    return (
        <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <Card className="overflow-hidden">
                    <Skeleton className="h-24 sm:h-32" />
                    <div className="px-4 sm:px-6 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-16">
                            <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background" />
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-48" />
                                <Skeleton className="h-6 w-32" />
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            <Skeleton className="h-2 w-full" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                    </CardContent>
                </Card>

                <div className="space-y-4 pt-4">
                    <Skeleton className="h-8 w-72 mx-auto" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
        </div>
    );
  }

  const skillLevel = getSkillLevelFromWinRate(lifetimeStats?.winRate ?? 0);

  const currentTier = getTier(player.total_points || 0, thresholds);
  const tierOrder: Tier[] = ['beginner', 'lower bronze', 'bronze', 'silver', 'gold'];
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const nextTier = currentTierIndex < tierOrder.length - 1 ? tierOrder[currentTierIndex + 1] : null;

  let progress = 0;
  let progressText = "Max tier reached!";

  if (nextTier) {
    const minPointsCurrentTier = thresholds[currentTier]?.min ?? 0;
    const minPointsNextTier = thresholds[nextTier]?.min ?? Infinity;
    const pointsInTier = (player.total_points || 0) - minPointsCurrentTier;
    const pointsForNextTier = minPointsNextTier - minPointsCurrentTier;
    progress = Math.max(0, (pointsInTier / pointsForNextTier) * 100);
    progressText = `${(player.total_points || 0).toLocaleString()} / ${minPointsNextTier -1} pts to ${capitalize(nextTier)}`;
  } else {
    progress = 100;
  }
  
  const gamePlayers = allPlayers.filter(p => p.role !== 'admin' && p.role !== 'guest');
  const sortedGamePlayers = [...gamePlayers].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  const rank = sortedGamePlayers.findIndex(p => p.id === user.uid) + 1;
  const isMemberActive = player.role === 'member' && (player.isUnlimitedMember || (player.membershipExpiryDate && player.membershipExpiryDate.toDate() > new Date()));

  const isAdmin = player.role === 'admin' || user.uid === DEFAULT_ADMIN_UID;

  return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <Card className="overflow-hidden">
            <div className={cn("relative h-24 sm:h-32", TIER_BANNER_COLORS[currentTier])}>
               {player.photoURL ? (
                  <Image
                      src={player.photoURL}
                      alt={player.name}
                      fill
                      priority
                      className="object-cover object-center opacity-30 blur-sm"
                  />
              ) : null }
              <div className={`absolute top-4 right-0 ${TIER_COLORS[currentTier]} px-4 py-1 rounded-l-full font-black text-sm shadow-lg`}>
                {capitalize(currentTier)}
              </div>
            </div>
            <div className="px-4 sm:px-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end">
                <div className="flex items-end gap-4 -mt-12 sm:-mt-16 ">
                  <div className="relative">
                    {currentTier === 'gold' && <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 sm:w-12 sm:h-12 text-amber-400 z-10" />}
                    <Avatar className={cn("w-24 h-24 sm:w-32 sm:h-32 bg-background", TIER_FRAME_CLASSES[currentTier])}>
                        {player.photoURL ? (
                            <AvatarImage src={player.photoURL} alt={player.name} />
                        ) : (
                            <AvatarFallback className="bg-secondary">
                                <UserIcon className="w-12 h-12 text-muted-foreground" />
                            </AvatarFallback>
                        )}
                    </Avatar>
                  </div>
                  <div>
                    <h1 className="font-black text-2xl sm:text-4xl uppercase tracking-wider">{player.name}</h1>
                    <div className="flex items-center gap-x-4 gap-y-2 mt-1 flex-wrap">
                        <p className="font-mono text-primary font-bold text-base sm:text-lg">{player.phId || `PH-${player.id.substring(0,4).toUpperCase()}`}</p>
                        {isMemberActive && (
                            <Badge variant="secondary" className="text-sm font-semibold border-primary/50 py-1 px-3">
                                <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                                Member
                            </Badge>
                        )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 sm:pb-2 flex-shrink-0 flex items-center gap-2">
                  <Button asChild variant="outline">
                    <Link href="/profile/share?type=id-card">
                      <Share2 className="mr-2 h-4 w-4" />
                      Share Stats
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/profile/edit">
                      <Settings className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Link>
                  </Button>
                </div>
              </div>
              
              <BadgeDisplay badges={player.badges} />

              <div className="mt-4 space-y-3">
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{player.whatsapp}</span>
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Badge variant={(player.showWhatsapp ?? true) ? "secondary" : "outline"} className="ml-2 flex items-center">
                                        {(player.showWhatsapp ?? true) ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                                        <span>{(player.showWhatsapp ?? true) ? 'Public' : 'Hidden'}</span>
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Your WhatsApp number is currently {(player.showWhatsapp ?? true) ? 'visible to other members' : 'hidden from other members'}.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                     {isMemberActive && (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span>{player.isUnlimitedMember ? 'Lifetime Member' : player.membershipExpiryDate ? `Expires on ${format(player.membershipExpiryDate.toDate(), 'dd MMM yyyy')}` : 'Member'}</span>
                        </div>
                    )}
                 </div>
                 
                <div className="pt-4">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{progressText}</p>
                  </div>
                  <Progress value={progress} className="w-full h-2 [&>div]:bg-primary" />
                </div>
              </div>

            </div>
          </Card>

          {activeSeason && seasonStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-primary"/>
                  <span>Statistik {activeSeason.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard title="Rank" value={rank > 0 ? `#${rank}` : '-'} />
                <StatCard title="Total Poin" value={player.total_points || 0} />
                <StatCard title="Win Rate" value={`${seasonStats.winRate.toFixed(0)}%`} />
                <StatCard title="Total Main" value={seasonStats.matches} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="w-6 h-6 text-primary"/>
                <span>Statistik Total</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard title="Skill Level" value={skillLevel.toFixed(1)} />
              <StatCard title="Total Main" value={lifetimeStats?.matches ?? 0} />
              <StatCard title="Total Menang" value={lifetimeStats?.wins ?? 0} />
              <StatCard title="Current Streak" value={`${currentWinStreak} WINS`} />
            </CardContent>
          </Card>

          {bestPartner && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary"/>
                        <span>Partner Terbaik</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4 pt-2">
                    <Link href={`/players/${bestPartner.id}`} className="flex-shrink-0">
                        <Avatar className={cn("w-16 h-16", TIER_FRAME_CLASSES[bestPartner.tier])}>
                            {bestPartner.photoURL && <AvatarImage src={bestPartner.photoURL} alt={bestPartner.name} />}
                            <AvatarFallback>{bestPartner.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </Link>
                    <div>
                        <Link href={`/players/${bestPartner.id}`} className="font-bold text-lg hover:underline">{bestPartner.name}</Link>
                        <p className="text-muted-foreground">
                            <span className="font-bold text-green-400">{bestPartner.winRate.toFixed(0)}%</span> Win Rate <span className="text-xs">({bestPartner.matches} matches)</span>
                        </p>
                    </div>
                </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="font-black text-2xl text-center uppercase tracking-widest">Match History</h2>
            {sortedMatches && sortedMatches.length > 0 ? (
                <ScrollArea className="h-[500px]">
                    <TooltipProvider>
                        <div className="pr-4 space-y-4">
                            {sortedMatches.map(match => {
                                const isTeam1 = match.team_1.includes(player.id);
                                const myTeamIds = isTeam1 ? match.team_1 : match.team_2;
                                const myPartnerId = myTeamIds.find(id => id !== player.id);
                                const opponentTeamIds = isTeam1 ? match.team_2 : match.team_1;
                                const myScore = isTeam1 ? match.score_1 : match.score_2;
                                const opponentScore = isTeam1 ? match.score_2 : match.score_1;

                                const result = match.winner_team === 'Draw'
                                  ? 'Draw'
                                  : (match.winner_team === 'Team 1' && isTeam1) || (match.winner_team === 'Team 2' && !isTeam1)
                                  ? 'Win'
                                  : 'Loss';
                                
                                const pointInfo = match.point_breakdown?.[player.id];
                                const totalPoints = pointInfo ? Math.round(pointInfo.total) : 0;
                                const partnerData = myPartnerId ? getPlayerData(myPartnerId) : null;


                                return (
                                    <Link href={`/matches/${match.id}`} key={match.id} className="block">
                                        <Card className={cn("p-3 sm:p-4 border-l-4 bg-card/50 transition-colors hover:bg-accent/50", 
                                            result === 'Win' ? 'border-l-[hsl(var(--win))]' : 
                                            result === 'Loss' ? 'border-l-[hsl(var(--loss))]' : 'border-l-border'
                                        )}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div>
                                                    <div className="text-xs text-muted-foreground">
                                                        <span>{format(new Date(match.timestamp.toDate()), "dd MMM yyyy")}</span>
                                                        {match.courtName && <span> • {match.courtName}</span>}
                                                    </div>
                                                    <p className="font-bold sm:text-lg">
                                                        vs {getPlayerName(opponentTeamIds[0])} &amp; {getPlayerName(opponentTeamIds[1])}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                        with <span className="font-semibold text-foreground">{partnerData?.name || 'partner'}</span>
                                                    </p>
                                                    {match.eventName && (
                                                        <Badge variant="secondary" className="text-xs mt-1.5">
                                                        <Trophy className="w-3 h-3 mr-1.5" />
                                                        {match.eventName} {match.roundNumber && `(R${match.roundNumber})`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-right flex-shrink-0 ml-4 cursor-help rounded-lg p-2 hover:bg-card-foreground/5">
                                                        <p className={cn("font-black text-xl sm:text-2xl", 
                                                                result === 'Win' ? 'text-[hsl(var(--win))]' : 
                                                                result === 'Loss' ? 'text-[hsl(var(--loss))]' : 'text-foreground'
                                                            )}>{totalPoints > 0 ? `+${totalPoints}` : totalPoints}</p>
                                                        <p className="text-xs font-semibold text-muted-foreground -mt-1">Poin</p>
                                                    </div>
                                                </TooltipTrigger>
                                                {pointInfo && (
                                                    <TooltipContent>
                                                        <div className="p-1 text-sm w-48">
                                                            <h4 className="font-bold mb-2 text-center">Rincian Poin</h4>
                                                            <ul className="space-y-1 text-xs">
                                                                {pointInfo.base > 0 && <li className="flex justify-between"><span>Partisipasi</span> <span>{pointInfo.base}</span></li>}
                                                                {pointInfo.result !== 0 && <li className="flex justify-between"><span>Hasil</span> <span>{pointInfo.result}</span></li>}
                                                                {pointInfo.margin !== 0 && <li className="flex justify-between"><span>Margin</span> <span>{pointInfo.margin}</span></li>}
                                                                {pointInfo.host_match > 0 && <li className="flex justify-between"><span>Host Match</span> <span>{pointInfo.host_match}</span></li>}
                                                                {pointInfo.slot_filler > 0 && <li className="flex justify-between"><span>Slot Filler</span> <span>{pointInfo.slot_filler}</span></li>}
                                                                {pointInfo.on_time > 0 && <li className="flex justify-between"><span>On-Time</span> <span>{pointInfo.on_time}</span></li>}
                                                                {pointInfo.fair_play > 0 && <li className="flex justify-between"><span>Fair Play</span> <span>{pointInfo.fair_play}</span></li>}
                                                                {pointInfo.consistency > 0 && <li className="flex justify-between"><span>Konsistensi</span> <span>{pointInfo.consistency}</span></li>}
                                                                
                                                                <hr className="my-1 border-border" />
                                                                <li className="flex justify-between font-bold text-sm">
                                                                    <span>Total</span> 
                                                                    <span>{Math.round(pointInfo.total)}</span>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                                <p className="font-black text-lg sm:text-xl">{myScore} - {opponentScore}</p>
                                                <p className={cn("font-bold text-sm uppercase", 
                                                    result === 'Win' ? 'text-[hsl(var(--win))]' : 
                                                    result === 'Loss' ? 'text-[hsl(var(--loss))]' : 'text-muted-foreground'
                                                )}>{result}</p>
                                        </div>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </TooltipProvider>
                </ScrollArea>
            ) : (
              <Card className='p-8 text-center text-muted-foreground bg-card/50'>
                No matches played yet.
              </Card>
            )}
          </div>
        </div>
      </div>
  );
}

function StatCard({ title, value, icon: Icon, className }: { title: string, value: string | number, icon?: React.ElementType, className?: string }) {
    return (
        <Card className={cn("text-center p-2 sm:p-4 bg-card/50 flex flex-col items-center justify-center", className)}>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">{title}</p>
             <div className='flex items-center gap-1.5'>
               <p className="font-black text-xl sm:text-2xl mt-1">{value}</p>
            </div>
        </Card>
    )
}
