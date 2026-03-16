'use client';
import { useState, useMemo, useEffect } from 'react';
import type { UserProfile, WithId, Tier, Season, Match } from '@/lib/types';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, Trophy, Check } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Crown } from '@/components/icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '../ui/card';

// --- Skeleton Components ---

function PodiumSkeleton() {
    return (
        <div className="flex justify-center gap-3 items-end">
            {[2, 1, 3].map(rank => (
                <div key={rank} className={cn("flex-1", rank === 1 ? 'scale-110 z-10' : 'scale-95')}>
                    <Skeleton className={cn("w-full rounded-[2rem]", rank === 1 ? "h-48" : "h-40")} />
                </div>
            ))}
        </div>
    )
}

function ListSkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center p-4 rounded-3xl bg-emerald-900/5">
                    <Skeleton className="h-6 w-6 mr-4" />
                    <div className="flex-1 flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
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

// --- Archive View Component ---

function SeasonArchiveView() {
    return (
        <div className="px-6 py-10">
            <Card className="border-emerald-900/10 bg-white/50">
                <CardContent className="p-8 text-center text-emerald-900/40">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="font-bold">No past seasons found</p>
                    <p className="text-xs mt-1">Archives will appear here after a season ends.</p>
                </CardContent>
            </Card>
        </div>
    );
}

// --- Main component ---
const TIER_OPTIONS: Tier[] = ['gold', 'silver', 'bronze', 'lower bronze', 'beginner'];

export function LeaderboardClient() {
  const { firestore } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilters, setTierFilters] = useState<Tier[]>([]);
  const [activeTab, setActiveTab] = useState('overall');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // --- Data Fetching ---
  const playersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('total_points', 'desc'));
  }, [firestore]);
  
  const seasonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'seasons'), orderBy('startDate', 'desc'));
  }, [firestore]);
  
  const { data: players, isLoading: playersLoading } = useCollection<WithId<UserProfile>>(playersQuery);
  const { data: seasons, isLoading: seasonsLoading } = useCollection<WithId<Season>>(seasonsQuery);
  
  const activeSeason = useMemo(() => {
    return seasons?.find(s => s.isActive);
  }, [seasons]);

  const leaderboardTitle = useMemo(() => {
    if (activeTab === 'archive') return 'Archive';
    return activeSeason?.name || 'Reguler Match';
  }, [activeTab, activeSeason]);
  
  const isLoading = playersLoading || seasonsLoading;
  
  // --- Data Memoization ---
  const filteredPlayers = useMemo(() => {
      if (!players) return [];
      
      let gamePlayers = players.filter(p => p.role !== 'admin' && p.role !== 'guest');
      
      if (tierFilters.length > 0) {
          gamePlayers = gamePlayers.filter(p => tierFilters.includes(p.tier));
      }
      
      if (searchTerm) {
        gamePlayers = gamePlayers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      
      return gamePlayers;
  }, [players, searchTerm, tierFilters]);

  // --- Render Logic ---
  const top3Players = filteredPlayers.slice(0, 3);
  const otherPlayers = filteredPlayers.slice(3);

  const renderPodium = () => {
    const podiumSlots = [ 
        { rank: 2, player: top3Players[1] }, 
        { rank: 1, player: top3Players[0] }, 
        { rank: 3, player: top3Players[2] }
    ];
    
    return (
        <div className="flex items-end justify-center gap-2 sm:gap-4 px-2">
            {podiumSlots.map(({ rank, player }) => {
                if (!player) return <div key={rank} className={`flex-1 ${rank === 1 ? 'z-10' : ''}`} />;
                const isRank1 = rank === 1;
                
                return (
                    <Link 
                        href={`/players/${player.id}`} 
                        key={player.id} 
                        className={cn(
                            "flex-1 flex flex-col items-center group transition-all duration-300",
                            isRank1 ? "scale-110 z-10 -translate-y-2" : "scale-95"
                        )}
                    >
                        <div className={cn(
                            "w-full rounded-[2rem] flex flex-col items-center p-4 pt-6 pb-6 shadow-sm border",
                            isRank1 ? "podium-card-highlight border-emerald-500/30" : "podium-card border-emerald-500/10"
                        )}>
                            <div className="relative mb-3">
                                {isRank1 && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                        <Crown className="w-8 h-8 text-yellow-500 drop-shadow-md" />
                                    </div>
                                )}
                                <div className={cn(
                                    "rounded-full p-1 bg-white shadow-inner",
                                    isRank1 ? "w-20 h-20 shadow-emerald-500/20" : "w-16 h-16"
                                )}>
                                    <Avatar className="w-full h-full">
                                        <AvatarImage src={player.photoURL || undefined} alt={player.name} />
                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm",
                                    rank === 1 ? "w-6 h-6 bg-emerald-600 text-white" : "w-5 h-5 bg-emerald-500 text-white"
                                )}>
                                    {rank}
                                </div>
                            </div>
                            <div className="text-center w-full">
                                <p className={cn(
                                    "font-bold truncate px-1",
                                    isRank1 ? "text-sm text-foreground" : "text-xs text-foreground/80"
                                )}>
                                    {player.name}
                                </p>
                                <div className="mt-1 flex flex-col items-center">
                                    <p className={cn(
                                        "font-black tracking-tight leading-none",
                                        isRank1 ? "text-2xl text-emerald-800" : "text-xl text-emerald-700"
                                    )}>
                                        {player.total_points}
                                    </p>
                                    <p className="text-[9px] font-black text-emerald-900/40 uppercase tracking-widest mt-0.5">PTS</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
  }

  return (
      <div className="min-h-screen bg-background pb-32">
        {/* Header Section */}
        <div className="px-6 pt-6 space-y-6">
            {/* Search & Filter */}
            <div className="flex gap-2">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-800/40" />
                    <Input 
                        className="w-full bg-white border-none rounded-2xl py-6 pl-10 pr-4 text-sm shadow-sm ring-1 ring-emerald-900/5 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-emerald-800/30" 
                        placeholder="Search player..." 
                        type="text" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                    <SheetTrigger asChild>
                         <Button variant="ghost" size="icon" className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-800/60 shadow-sm ring-1 ring-emerald-900/5 hover:text-emerald-600 transition-colors">
                            <SlidersHorizontal className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader><SheetTitle>Filter Leaderboard</SheetTitle></SheetHeader>
                        <div className="py-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-bold text-emerald-900">Tier Profile</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {TIER_OPTIONS.map(tier => (
                                        <div key={tier} className="flex items-center space-x-3 p-2 rounded-xl hover:bg-emerald-50 transition-colors">
                                            <Checkbox 
                                                id={`tier-${tier}`} 
                                                checked={tierFilters.includes(tier)} 
                                                onCheckedChange={(checked) => {
                                                    setTierFilters(prev => !!checked ? [...prev, tier] : prev.filter(t => t !== tier));
                                                }} 
                                            />
                                            <label htmlFor={`tier-${tier}`} className="text-sm font-semibold capitalize cursor-pointer flex-1 text-emerald-800">{tier}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Pill Tabs */}
            <div className="flex p-1.5 bg-emerald-900/5 rounded-2xl">
                <button 
                    onClick={() => setActiveTab('overall')}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300",
                        activeTab === 'overall' ? "bg-white text-emerald-800 shadow-sm" : "text-emerald-800/40 hover:text-emerald-800/60"
                    )}
                >
                    {activeSeason?.name || 'Reguler Match'}
                </button>
                <button 
                    onClick={() => setActiveTab('archive')}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2",
                        activeTab === 'archive' ? "bg-white text-emerald-800 shadow-sm" : "text-emerald-800/40 hover:text-emerald-800/60"
                    )}
                >
                    <Trophy className="h-4 w-4" />
                    Archive
                </button>
            </div>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'archive' ? (
            <SeasonArchiveView />
        ) : (
            <>
                {/* Podium Section */}
                <div className="mt-8 px-6">
                    {isLoading ? <PodiumSkeleton /> : renderPodium()}
                </div>

                {/* List Section */}
                <div className="mt-10 bg-white rounded-t-[3rem] px-6 pt-10 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-emerald-900/5">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-emerald-950 px-2">{leaderboardTitle}</h2>
                    </div>
                    
                    <div className="space-y-2 pb-10">
                        {/* Table Header */}
                        <div className="flex items-center text-[11px] font-black text-emerald-900/30 uppercase tracking-[0.2em] px-4 mb-4">
                            <div className="w-10">RK</div>
                            <div className="flex-1">PLAYER</div>
                            <div className="w-16 text-right">PTS</div>
                        </div>

                        {isLoading ? <ListSkeleton /> : (
                            <div className="space-y-3">
                                {otherPlayers.map((player, index) => {
                                    const winRate = player.match_count > 0 ? (player.win_count / player.match_count) * 100 : 0;
                                    const isMember = player.role === 'member' && (player.isUnlimitedMember || (player.membershipExpiryDate && player.membershipExpiryDate.toDate() > new Date()));

                                    return (
                                        <Link 
                                            href={`/players/${player.id}`} 
                                            key={player.id} 
                                            className="flex items-center p-4 rounded-3xl hover:bg-emerald-50 active:scale-[0.98] transition-all duration-200 group border border-transparent hover:border-emerald-100 shadow-sm hover:shadow-md bg-white"
                                        >
                                            <div className="w-10 font-bold text-emerald-950 text-base">{index + 4}</div>
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className="w-12 h-12 ring-2 ring-emerald-50 ring-offset-2">
                                                        <AvatarImage src={player.photoURL || undefined} alt={player.name} />
                                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {isMember && (
                                                        <div className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-1 border-2 border-white">
                                                            <Check className="h-2 w-2 text-white stroke-[4]" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-emerald-950 group-hover:text-emerald-700 transition-colors">{player.name}</p>
                                                    <p className="text-[10px] text-emerald-900/40 font-bold uppercase tracking-wider">
                                                        Main: <span className="text-emerald-900/60">{player.match_count}</span> • Win: <span className="text-emerald-600">{winRate.toFixed(0)}%</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-16 text-right font-black text-xl text-emerald-600/80">
                                                {player.total_points}
                                            </div>
                                        </Link>
                                    )
                                })}
                                {filteredPlayers.length === 0 && (
                                    <div className="text-center py-16 text-emerald-900/30">
                                        <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                        <p className="font-bold">No players found</p>
                                        <p className="text-xs mt-1">Try adjusting your filters</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </>
        )}
    </div>
  );
}
