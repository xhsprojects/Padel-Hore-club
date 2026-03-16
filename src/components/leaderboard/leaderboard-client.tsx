'use client';
import { useState, useMemo, useEffect } from 'react';
import type { UserProfile, WithId, Tier, Match, Season } from '@/lib/types';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, ShieldCheck, X, Trophy, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Crown } from '@/components/icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { TIER_FRAME_CLASSES } from '@/lib/constants';


// --- Skeleton Components ---

function PodiumSkeleton() {
    return (
        <div className="flex justify-center gap-3 items-end">
            {[2, 1, 3].map(rank => (
                <div key={rank} className={`flex-1 ${rank === 1 ? 'flex-[1.2] scale-105' : ''}`}>
                    <div className={`w-full rounded-3xl p-4 ${rank === 1 ? 'pt-6 pb-8 rounded-[32px]' : 'pt-4 pb-5'}`}>
                        <div className="flex flex-col items-center">
                            <Skeleton className={`rounded-full ${rank === 1 ? 'w-20 h-20' : 'w-16 h-16'}`} />
                            <Skeleton className="h-4 w-16 mt-3" />
                            <Skeleton className="h-6 w-12 mt-1" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function ListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center p-3 rounded-2xl bg-card/50">
                    <Skeleton className="h-6 w-6" />
                    <div className="flex-1 flex items-center gap-3 ml-4">
                        <Skeleton className="w-11 h-11 rounded-full" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-12" />
                </div>
            ))}
        </div>
    )
}

function SeasonCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg">
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="text-right">
              <Skeleton className="h-6 w-16 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto mt-1" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// --- Main component ---
const TIER_OPTIONS: Tier[] = ['gold', 'silver', 'bronze', 'lower bronze', 'beginner'];

export function LeaderboardClient() {
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilters, setTierFilters] = useState<Tier[]>([]);
  const [activeTab, setActiveTab] = useState('archive');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // --- Data Fetching ---
  const playersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('total_points', 'desc'));
  }, [firestore]);
  
  const allSeasonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'seasons'), orderBy('startDate', 'desc'));
  }, [firestore]);

  const allMatchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'matches'));
  }, [firestore]);

  const { data: players, isLoading: playersLoading } = useCollection<WithId<UserProfile>>(playersQuery);
  const { data: allSeasons, isLoading: seasonsLoading } = useCollection<WithId<Season>>(allSeasonsQuery);
  const { data: allMatches, isLoading: matchesLoading } = useCollection<WithId<Match>>(allMatchesQuery);
  
  const { activeSeason } = useMemo(() => {
    if (!allSeasons) return { activeSeason: undefined, pastSeasons: [] };
    const active = allSeasons.find(s => s.isActive);
    const past = allSeasons.filter(s => !s.isActive);
    return { activeSeason: active, pastSeasons: past };
  }, [allSeasons]);
  
  const isLoading = playersLoading || seasonsLoading || matchesLoading;
  
  useEffect(() => {
    if (activeSeason) {
        setActiveTab(activeSeason.id);
    } else {
        setActiveTab('archive');
    }
  }, [activeSeason]);

  // --- Data Memoization ---
  const seasonalPlayerData = useMemo(() => {
    if (!activeSeason || !allMatches || !players) return null;

    const playerPoints: { [key: string]: number } = {};
    players.forEach(p => playerPoints[p.id] = 0);
    
    const seasonMatches = allMatches.filter(match => {
        const matchDate = match.timestamp.toDate();
        return matchDate >= activeSeason.startDate.toDate() && matchDate <= activeSeason.endDate.toDate();
    });

    seasonMatches.forEach(match => {
        if (match.point_breakdown) {
            for (const playerId in match.point_breakdown) {
                if (playerPoints[playerId] !== undefined) {
                    playerPoints[playerId] += Math.round(match.point_breakdown[playerId].total);
                }
            }
        }
    });

    return players.map(p => ({
        ...p,
        total_points: playerPoints[p.id] || 0,
    })).sort((a,b) => b.total_points - a.total_points);

  }, [activeSeason, allMatches, players]);

  const filteredPlayers = useMemo(() => {
      const sourceData = (activeTab !== 'archive' && seasonalPlayerData) ? seasonalPlayerData : players;
      if (!sourceData) return [];
      
      let gamePlayers = sourceData.filter(p => p.role !== 'admin' && p.role !== 'guest');
      
      if (tierFilters.length > 0) {
          gamePlayers = gamePlayers.filter(p => tierFilters.includes(p.tier));
      }
      
      if (!searchTerm) {
        return gamePlayers;
      }
      
      return gamePlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [players, seasonalPlayerData, activeTab, searchTerm, tierFilters]);

  // --- Render Logic ---
  const top3Players = filteredPlayers.slice(0, 3);
  const otherPlayers = filteredPlayers.slice(3);

  const renderPodium = () => {
    const podiumSlots = [ { rank: 2, player: top3Players[1] }, { rank: 1, player: top3Players[0] }, { rank: 3, player: top3Players[2] }];
    return (
        <div className="flex items-end justify-center gap-3">
            {podiumSlots.map(({ rank, player }) => {
                if (!player) return <div key={rank} className={`flex-1 ${rank === 1 ? 'flex-[1.2]' : ''}`} />;
                return (
                    <Link href={`/players/${player.id}`} key={player.id} className={`flex-1 flex flex-col items-center group ${rank === 1 ? 'flex-[1.2]' : ''}`}>
                        <div className={`w-full rounded-3xl flex flex-col items-center shadow-lg transition-transform ${rank === 1 ? 'rank-card-1 glass-card pt-6 pb-8 rounded-[32px] relative z-10 scale-105 group-hover:scale-110' : rank === 2 ? 'rank-card-2 glass-card pt-4 pb-5 group-hover:scale-105' : 'rank-card-3 glass-card pt-4 pb-5 group-hover:scale-105'}`}>
                            {rank === 1 && <Crown className="absolute -top-3 text-yellow-500 h-8 w-8 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />}
                            <div className={`relative mb-3 ${rank === 1 ? 'mt-2 mb-4' : ''}`}>
                                <div className={`rounded-full p-0.5 shadow-xl ${rank === 1 ? 'w-20 h-20 border-4 border-primary' : 'w-16 h-16 border-2 border-white/20'}`}>
                                    <Avatar className="w-full h-full"><AvatarImage src={player.photoURL || undefined} alt={player.name} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                                </div>
                                <div className={`absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-xs font-black border-2 border-background shadow-lg ${rank===1 ? 'w-7 h-7 bg-primary text-background' : 'w-6 h-6 bg-slate-300 text-slate-900'}`}>{rank}</div>
                            </div>
                            <div className="text-center px-1">
                                <p className={`font-bold truncate ${rank === 1 ? 'text-base text-white tracking-tight max-w-[100px]' : 'text-xs text-slate-200 max-w-[80px]'}`}>{player.name}</p>
                                <p className={`font-black mt-0.5 ${rank === 1 ? 'text-yellow-500 text-2xl' : 'text-slate-100 font-extrabold text-base'}`}>{player.total_points}</p>
                                <p className={`-mt-1 uppercase tracking-widest font-bold ${rank === 1 ? 'text-[10px] text-yellow-500/70 font-black' : 'text-[9px] text-slate-400'}`}>PTS</p>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
  }

  const renderContent = () => {
    if (activeTab !== 'archive') {
      return (
        <>
            <div className="px-6 mt-8 mb-4">
                {isLoading ? <PodiumSkeleton /> : renderPodium()}
            </div>
            <div className="flex-1 bg-card rounded-t-[40px] px-6 pt-8 pb-28 md:pb-8 shadow-2xl shadow-black relative z-20">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-extrabold capitalize">{activeTab === 'overall' ? 'Overall Ranking' : activeSeason?.name}</h2>
                </div>
                {isLoading ? <ListSkeleton/> : (
                    <div className="space-y-2">
                        <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-3">
                            <div className="w-10">RK</div><div className="flex-1">PLAYER</div><div className="w-12 text-right">PTS</div>
                        </div>
                        {otherPlayers.map((player, index) => {
                            const originalPlayer = players?.find(p => p.id === player.id);
                            const winRate = originalPlayer ? (originalPlayer.match_count > 0 ? (originalPlayer.win_count / originalPlayer.match_count) * 100 : 0) : 0;
                            const matchCount = originalPlayer?.match_count || 0;
                            const isMember = player.role === 'member' && (player.isUnlimitedMember || (player.membershipExpiryDate && player.membershipExpiryDate.toDate() > new Date()));

                            return (
                            <Link href={`/players/${player.id}`} key={player.id} className="flex items-center p-3 rounded-2xl bg-slate-900/50 hover:bg-slate-900 transition-colors group">
                                <div className="w-10 font-black text-slate-400 text-base">{index + 4}</div>
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="w-11 h-11">
                                            <AvatarImage src={player.photoURL || undefined} alt={player.name} />
                                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {isMember && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 border-2 border-card">
                                                <ShieldCheck className="h-2.5 w-2.5 text-background" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{player.name}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Main: <span className="text-slate-200">{matchCount}</span> • Win: <span className="text-emerald-500">{winRate.toFixed(0)}%</span></p>
                                    </div>
                                </div>
                                <div className="w-12 text-right font-black text-lg text-yellow-500">{player.total_points}</div>
                            </Link>
                        )})}
                        {filteredPlayers.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground"><p>No players found.</p>
                                {tierFilters.length > 0 && <p className="text-xs mt-1">Try adjusting your filters.</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
      )
    }
    
    return <SeasonArchiveView allPlayers={players} allSeasons={allSeasons} allMatches={allMatches} isLoading={isLoading} />;
  }

  const handleTierFilterChange = (tier: Tier, checked: boolean) => {
    setTierFilters(prev => 
        checked ? [...prev, tier] : prev.filter(t => t !== tier)
    );
  };
  
  return (
      <div className="space-y-8">
        <div className="px-6 pt-4 space-y-4">
            {activeTab !== 'archive' && (
                <div className="flex gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input className="w-full bg-card border-none rounded-2xl py-4 h-[52px] pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-500" placeholder="Search player..." type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                        <SheetTrigger asChild>
                             <Button variant="ghost" size="icon" className="w-[52px] h-[52px] bg-card rounded-2xl flex items-center justify-center text-slate-400 hover:text-primary transition-colors border border-transparent hover:border-primary/20"><SlidersHorizontal className="h-6 w-6" /></Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader><SheetTitle>Filter Leaderboard</SheetTitle></SheetHeader>
                            <div className="py-4">
                                <Label className="text-sm font-medium">Tier</Label>
                                <div className="space-y-2 mt-2">
                                    {TIER_OPTIONS.map(tier => (
                                        <div key={tier} className="flex items-center space-x-2">
                                            <Checkbox id={`tier-${tier}`} checked={tierFilters.includes(tier)} onCheckedChange={(checked) => handleTierFilterChange(tier, !!checked)} />
                                            <label htmlFor={`tier-${tier}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize">{tier}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            )}
        </div>

        <div className="px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value={activeSeason ? activeSeason.id : 'season-disabled'} disabled={!activeSeason}>
                        {activeSeason ? activeSeason.name : 'Season'}
                    </TabsTrigger>
                    <TabsTrigger value="archive" className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Archive
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
        
        {renderContent()}
    </div>
  );
}


// --- Archive View Component ---

function PodiumPlayer({ player, rank }: { player: WithId<UserProfile> & { season_points: number }, rank: number }) {
    const rankStyles: {[key: number]: { iconColor: string, borderColor: string }} = {
        1: { iconColor: 'text-amber-400', borderColor: 'border-amber-400' },
        2: { iconColor: 'text-slate-400', borderColor: 'border-slate-400' },
        3: { iconColor: 'text-orange-500', borderColor: 'border-orange-500' },
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-4">
                <Trophy className={cn("h-6 w-6", rankStyles[rank]?.iconColor || 'text-muted-foreground')} />
                <Link href={`/players/${player.id}`} className="flex items-center gap-3 group">
                    <Avatar className={cn("w-10 h-10", TIER_FRAME_CLASSES[player.tier])}>
                        {player.photoURL && <AvatarImage src={player.photoURL} />}
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold group-hover:text-primary">{player.name}</span>
                </Link>
            </div>
            <div className="text-right">
                <p className="font-black text-lg text-primary">{player.season_points.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground -mt-1">Poin</p>
            </div>
        </div>
    );
}

function SeasonArchiveView({ allPlayers, allSeasons, allMatches, isLoading }: {
    allPlayers: WithId<UserProfile>[] | null;
    allSeasons: WithId<Season>[] | null;
    allMatches: WithId<Match>[] | null;
    isLoading: boolean;
}) {

    const pastSeasonsData = useMemo(() => {
        if (!allPlayers || !allSeasons || !allMatches) return [];

        const inactiveSeasons = allSeasons.filter(s => !s.isActive);
        
        return inactiveSeasons.map(season => {
            const seasonMatches = allMatches.filter(match => {
                const matchDate = match.timestamp.toDate();
                const startDate = season.startDate.toDate();
                const endDate = season.endDate.toDate();
                return matchDate >= startDate && matchDate <= endDate;
            });

            const playerPoints: { [key: string]: number } = {};
            allPlayers.forEach(p => { playerPoints[p.id] = 0; });

            seasonMatches.forEach(match => {
                if (match.point_breakdown) {
                    for (const playerId in match.point_breakdown) {
                        if (playerPoints[playerId] !== undefined) {
                            playerPoints[playerId] += Math.round(match.point_breakdown[playerId].total);
                        }
                    }
                }
            });

            const leaderboard = allPlayers.map(p => ({
                ...p,
                season_points: playerPoints[p.id] || 0,
            })).sort((a, b) => b.season_points - a.total_points);

            return {
                ...season,
                podium: leaderboard.slice(0, 3),
            };
        });

    }, [allPlayers, allSeasons, allMatches]);

    if (isLoading) {
        return (
            <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <SeasonCardSkeleton />
              <SeasonCardSkeleton />
            </div>
        );
    }
    
    if (pastSeasonsData.length === 0) {
        return (
            <div className="px-6">
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No past seasons found in the archives.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {pastSeasonsData.map(season => (
                <Card key={season.id}>
                    <CardHeader>
                        <CardTitle>{season.name}</CardTitle>
                        <CardDescription>
                            {format(season.startDate.toDate(), 'dd MMM yyyy')} - {format(season.endDate.toDate(), 'dd MMM yyyy')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {season.podium.map((player, index) => (
                                player.season_points > 0 && <PodiumPlayer key={player.id} player={player} rank={index + 1} />
                            ))}
                            {season.podium.every(p => p.season_points === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">No matches were played this season.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
