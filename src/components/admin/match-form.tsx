'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UserProfile, WithId, PointBreakdown, Match, Court, Season, Tier, UserBadge, TierThresholds, Event } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Terminal, UserPlus, X, Award, Clock, Users, ArrowDown, QrCode, Flame, Shield, Sparkles, Bike, Swords, Rocket, Sunrise, Moon, CalendarDays, ShieldAlert, Loader2, ChevronRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { POINT_RULES, TIER_FRAME_CLASSES, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { ALL_BADGES } from '@/lib/badges';
import { collection, doc, writeBatch, getDocs, query, where, Timestamp, orderBy, setDoc } from 'firebase/firestore';
import { startOfWeek, format } from 'date-fns';
import { cn, getTier, capitalize } from '@/lib/utils';
import { FirebaseError } from 'firebase/app';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { suggestTeams, type Player } from '@/ai/flows/suggest-teams-flow';
import { sendPushNotification } from '@/actions/send-push-notification';
import { QrScanner } from '@/components/admin/qr-scanner';


const MatchFormSchema = z.object({
  team1_player1: z.string().min(1, 'Player is required'),
  team1_player2: z.string().min(1, 'Player is required'),
  team2_player1: z.string().min(1, 'Player is required'),
  team2_player2: z.string().min(1, 'Player is required'),
  score1: z.coerce.number().min(0, 'Score must be non-negative'),
  score2: z.coerce.number().min(0, 'Score must be non-negative'),
  courtId: z.string().min(1, 'Court is required'),
  eventId: z.string().min(1, 'Event is required'),
  host_id: z.string().optional(),
  onTimePlayers: z.array(z.string()),
  fairPlayPlayers: z.array(z.string()),
  slotFillerPlayers: z.array(z.string()),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid format, use YYYY-MM-DD'),
  matchTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
}).refine(data => {
    // Unique player check
    const players = [data.team1_player1, data.team1_player2, data.team2_player1, data.team2_player2];
    const validPlayers = players.filter(p => p && p.length > 0);
    return new Set(validPlayers).size === validPlayers.length;
}, {
    message: 'Each player must be unique and cannot be selected more than once.',
    path: ['team1_player1'],
});

type FormValues = z.infer<typeof MatchFormSchema>;

interface MatchFormProps {
    allPlayers: WithId<UserProfile>[];
    prefilledPlayerIds?: string[];
    prefillOnTime?: boolean;
    eventId?: string;
    roundNumber?: number;
}

export function MatchForm({ allPlayers, prefilledPlayerIds, prefillOnTime, eventId, roundNumber }: MatchFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEventSelected, setIsEventSelected] = useState(!!eventId);
  const { toast } = useToast();
  const router = useRouter();
  const { firestore } = useFirebase();

  const courtsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courts');
  }, [firestore]);
  const { data: courts, isLoading: courtsLoading } = useCollection<Court>(courtsQuery);
  const courtMap = useMemo(() => new Map(courts?.map(c => [c.id, c])), [courts]);
  
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'events'), where('status', 'in', ['upcoming', 'ongoing']));
  }, [firestore]);
  const { data: events, isLoading: eventsLoading } = useCollection<WithId<Event>>(eventsQuery);

  const tierSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'tier_thresholds');
  }, [firestore]);
  const { data: tierSettings } = useDoc<TierThresholds>(tierSettingsRef);
  const thresholds = tierSettings || DEFAULT_THRESHOLDS;
  
  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  const form = useForm<FormValues>({
    resolver: zodResolver(MatchFormSchema),
    defaultValues: {
      team1_player1: '',
      team1_player2: '',
      team2_player1: '',
      team2_player2: '',
      score1: 0,
      score2: 0,
      courtId: '',
      eventId: eventId || 'none',
      host_id: undefined,
      onTimePlayers: [],
      fairPlayPlayers: [],
      slotFillerPlayers: [],
      matchDate: format(new Date(), 'yyyy-MM-dd'),
      matchTime: format(new Date(), 'HH:mm'),
    },
  });
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, field: { onChange: (value: string) => void }) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-digits
    let formatted = input;
    if (input.length > 4) {
        formatted = `${input.slice(0, 4)}-${input.slice(4)}`;
    }
    if (input.length > 6) {
        formatted = `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
    }
    field.onChange(formatted);
  };

  useEffect(() => {
    if (prefilledPlayerIds && prefilledPlayerIds.length === 4) {
        form.reset({
            ...form.getValues(), // keep other defaults
            // Distribute players, admin can rearrange if needed
            team1_player1: prefilledPlayerIds[0],
            team1_player2: prefilledPlayerIds[1],
            team2_player1: prefilledPlayerIds[2],
            team2_player2: prefilledPlayerIds[3],
            // Auto-check on-time if prefilled
            onTimePlayers: prefillOnTime ? prefilledPlayerIds : [],
        });
        if (prefillOnTime) {
            toast({ title: "Players Loaded!", description: "Arrange teams, verify bonuses, and enter the score." });
        } else {
            toast({ title: "Players Loaded!", description: "Arrange teams and enter the score." });
        }
        // Clear the query params from URL to prevent re-filling on refresh
        router.replace('/admin', {scroll: false}); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledPlayerIds, prefillOnTime, form]);


  const selectedEventId = form.watch('eventId');
  const selectedEvent = events?.find(e => e.id === (eventId || selectedEventId));

  useEffect(() => {
    const currentEventId = eventId || selectedEventId;
    if (currentEventId && currentEventId !== 'none' && events) {
        const event = events.find(e => e.id === currentEventId);
        if (event) {
            form.setValue('matchDate', format(event.startDate.toDate(), 'yyyy-MM-dd'));
            form.setValue('matchTime', format(new Date(), 'HH:mm')); // Default to current time for event matches
            form.setValue('courtId', event.courtId || '');
            setIsEventSelected(true);

            // Only clear player fields if event is changed via dropdown
            if (selectedEventId !== eventId) {
                form.setValue('team1_player1', '');
                form.setValue('team1_player2', '');
                form.setValue('team2_player1', '');
                form.setValue('team2_player2', '');
                toast({
                    title: `Event "${event.name}" selected`,
                    description: "Player selection is now limited to event participants.",
                });
            }
        }
    } else {
        setIsEventSelected(false);
    }
  }, [selectedEventId, eventId, events, form, toast]);

  const selectablePlayers = useMemo(() => {
    const currentEventId = eventId || selectedEventId;
    const basePlayers = allPlayers.filter(p => p.role !== 'admin');

    if (currentEventId && currentEventId !== 'none') {
        const selectedEvent = events?.find(e => e.id === currentEventId);
        if (selectedEvent?.participantIds) {
            const participantIds = new Set(selectedEvent.participantIds);
            return allPlayers.filter(p => participantIds.has(p.id));
        }
        return []; // Return empty if event selected but not found or no participants
    }
    
    return basePlayers;
  }, [allPlayers, selectedEventId, eventId, events]);

  const selectedPlayerIds = form.watch(['team1_player1', 'team1_player2', 'team2_player1', 'team2_player2']);
  const matchPlayers = useMemo(() => {
    return selectedPlayerIds.map(id => playerMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
  }, [selectedPlayerIds, playerMap]);


  const handleSuggestTeams = async () => {
    if (matchPlayers.length !== 4) return;
    setIsSuggesting(true);
    setError(null);

    try {
        const playersForAI: Player[] = matchPlayers.map(p => ({
            id: p.id,
            name: p.name,
            tier: p.tier,
            total_points: p.total_points,
            win_rate: p.match_count > 0 ? (p.win_count / p.match_count) * 100 : 0,
        }));

        const result = await suggestTeams({ players: playersForAI });
        
        form.setValue('team1_player1', result.team1_player_ids[0]);
        form.setValue('team1_player2', result.team1_player_ids[1]);
        form.setValue('team2_player1', result.team2_player_ids[0]);
        form.setValue('team2_player2', result.team2_player_ids[1]);

        toast({
            title: 'AI Teams Suggested!',
            description: result.explanation,
        });

    } catch (e: any) {
        console.error("Error suggesting teams:", e);
        const message = e.message || "The AI could not suggest teams at this time.";
        setError(message);
        toast({
            variant: 'destructive',
            title: 'Suggestion Failed',
            description: message,
        });
    } finally {
        setIsSuggesting(false);
    }
};

  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setError(null);

    if (!firestore) {
        setError("Firestore is not available. Please try again.");
        setIsPending(false);
        return;
    }

    const currentEventId = eventId || data.eventId;
    const isEventMatch = currentEventId && currentEventId !== 'none';
    
    try {
        const { matchDate, matchTime } = data;
        const matchTimestamp = new Date(`${matchDate}T${matchTime}`);

        const newMatchRef = doc(collection(firestore, 'matches'));
        
        const team1_ids = [data.team1_player1, data.team1_player2];
        const team2_ids = [data.team2_player1, data.team2_player2];
        const allPlayerIdsInMatch = [...team1_ids, ...team2_ids];
        
        const oldGamePlayers = allPlayers.filter(p => p.role !== 'admin' && p.role !== 'guest');
        const oldLeaderboard = JSON.parse(JSON.stringify(oldGamePlayers.sort((a, b) => b.total_points - a.total_points)));
        
        const playersData = allPlayerIdsInMatch.map(id => playerMap.get(id)).filter(Boolean) as WithId<UserProfile>[];

        const winner_team = data.score1 > data.score2 ? 'Team 1' : data.score2 > data.score1 ? 'Team 2' : 'Draw';
        const margin = Math.abs(data.score1 - data.score2);
        
        const batch = writeBatch(firestore);
        const pointBreakdowns: { [key: string]: PointBreakdown } = {};
        const playerUpdates: Map<string, Partial<UserProfile>> = new Map();
        const notificationsToAdd: any[] = [];
        
        const seasonsSnapshot = await getDocs(query(collection(firestore, 'seasons'), orderBy('startDate', 'asc')));
        const allSeasons = seasonsSnapshot.docs.map(d => ({...d.data(), id: d.id})) as WithId<Season>[];
        const firstSeason = allSeasons[0];

        const selectedEvent = events?.find(e => e.id === data.eventId);
        const multiplier = selectedEvent?.pointMultiplier ?? 1;
        
        for (const player of playersData) {
            if (player.role === 'guest') continue; // Skip guests

            const updates: Partial<UserProfile> = {};
            const breakdown: PointBreakdown = { base: 0, result: 0, margin: 0, host_match: 0, slot_filler: 0, on_time: 0, fair_play: 0, consistency: 0, total: 0 };
            const isWinner = (winner_team === 'Team 1' && team1_ids.includes(player.id)) || (winner_team === 'Team 2' && team2_ids.includes(player.id));
            
            breakdown.base += player.role === 'member' ? POINT_RULES.PARTICIPATION.MEMBER : POINT_RULES.PARTICIPATION.NON_MEMBER;

            let resultPoints = 0;
            if (winner_team === 'Draw') {
                resultPoints = POINT_RULES.RESULT.DRAW;
            } else if (isWinner) {
                resultPoints = POINT_RULES.RESULT.WIN;
            } else {
                resultPoints = POINT_RULES.RESULT.LOSS;
            }

            let marginPoints = 0;
            if (winner_team !== 'Draw') {
                if (isWinner) {
                    if (margin >= 5) marginPoints = POINT_RULES.MARGIN_BONUS.DOMINANT_WIN;
                    else if (margin >= 1 && margin <= 4) marginPoints = POINT_RULES.MARGIN_BONUS.CLOSE_WIN;
                } else { 
                    if (margin <= 2) marginPoints = POINT_RULES.MARGIN_BONUS.HONORABLE_LOSS;
                }
            }

            if (multiplier > 1) {
                resultPoints *= multiplier;
                marginPoints *= multiplier;
            }

            breakdown.result += resultPoints;
            breakdown.margin += marginPoints;

            if (data.host_id === player.id) breakdown.host_match += POINT_RULES.BEHAVIOR.HOST_MATCH;
            if (data.onTimePlayers.includes(player.id)) breakdown.on_time += POINT_RULES.BEHAVIOR.ON_TIME;
            if (data.fairPlayPlayers.includes(player.id)) breakdown.fair_play += POINT_RULES.BEHAVIOR.FAIR_PLAY;
            if (data.slotFillerPlayers.includes(player.id)) breakdown.slot_filler += POINT_RULES.BEHAVIOR.SLOT_FILLER;
            
            let newWinStreak = player.win_streak || 0;
            if (isWinner) {
                newWinStreak++;
            } else {
                newWinStreak = 0;
            }
            
            let totalPointsForMatch = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
            
            breakdown.total = totalPointsForMatch;

            pointBreakdowns[player.id] = breakdown;
            
            const newTotalPoints = player.total_points + Math.round(breakdown.total);
            const oldTier = player.tier;
            const newTier = getTier(newTotalPoints, thresholds);
            
            updates.total_points = newTotalPoints;
            updates.match_count = player.match_count + 1;
            updates.win_count = isWinner ? player.win_count + 1 : player.win_count;
            updates.win_streak = newWinStreak;
            updates.tier = newTier;

            const resultText = winner_team === 'Draw' ? 'seri' : isWinner ? 'kemenangan' : 'pertandingan';
            notificationsToAdd.push({
                playerId: player.id,
                config: {
                    uid: player.id,
                    title: `MATCH RESULT!`,
                    body: `Main yang bagus! Kamu mendapatkan ${Math.round(breakdown.total)} Poin dari ${resultText} tadi. Cek posisimu sekarang!`,
                    timestamp: Timestamp.now(),
                    isRead: false,
                    link: '/',
                    icon: 'Swords'
                }
            });

            if (newTier !== oldTier) {
                notificationsToAdd.push({
                    playerId: player.id,
                    config: {
                        uid: player.id,
                        title: "HORE! KAMU NAIK TIER!",
                        body: `Selamat! Kamu resmi naik kelas ke Tier ${capitalize(newTier)}. Bagikan pencapaianmu!`,
                        timestamp: Timestamp.now(),
                        isRead: false,
                        link: `/profile/share?type=tier-up&oldTier=${oldTier}&newTier=${newTier}`,
                        icon: 'Trophy'
                    }
                });
            }

            // --- Badge Awarding Logic ---
            const newBadges: UserBadge[] = [];
            const awardBadge = (badgeId: string, icon: React.ElementType | string) => {
                if (!player.badges?.some(b => b.badgeId === badgeId) && !newBadges.some(b => b.badgeId === badgeId)) {
                    const badge = ALL_BADGES.find(b => b.id === badgeId);
                    if (badge) {
                        newBadges.push({ badgeId, timestamp: Timestamp.now() });
                        notificationsToAdd.push({ playerId: player.id, config: { uid: player.id, title: 'BADGE UNLOCKED!', body: `Congratulations! You've earned the "${badge.name}" badge.`, timestamp: Timestamp.now(), isRead: false, link: '/profile', icon: icon as string }});
                    }
                }
            };
            
            const hour = matchTimestamp.getHours();
            const monthDay = `${String(matchTimestamp.getMonth() + 1).padStart(2, '0')}-${String(matchTimestamp.getDate()).padStart(2, '0')}`;
            const HOLIDAYS = ['01-01', '08-17', '12-25'];

            if (hour < 9) {
                const newCount = (player.early_bird_count || 0) + 1;
                updates.early_bird_count = newCount;
                if (newCount >= 10) awardBadge('early-bird', 'Sunrise');
            }
            if (hour >= 21) {
                const newCount = (player.night_owl_count || 0) + 1;
                updates.night_owl_count = newCount;
                if (newCount >= 10) awardBadge('night-owl', 'Moon');
            }
            if (HOLIDAYS.includes(monthDay)) {
                awardBadge('holiday-hero', 'CalendarDays');
            }
            if (newWinStreak === 5) {
                awardBadge('unstoppable', 'Flame');
            }
            if (data.fairPlayPlayers.includes(player.id)) {
                const newFairPlayCount = (player.fair_play_count || 0) + 1;
                updates.fair_play_count = newFairPlayCount;
                if (newFairPlayCount >= 10) {
                    awardBadge('fair-play', 'Sparkles');
                }
            }

            const allMatchesQuery = query(collection(firestore, 'matches'), where('player_ids', 'array-contains', player.id));
            const allMatchesSnapshot = await getDocs(allMatchesQuery);

            const oneWeekAgo = startOfWeek(new Date());
            const weeklyMatches = allMatchesSnapshot.docs.filter(doc => {
                const matchData = doc.data() as Match;
                return matchData.timestamp.toDate() >= oneWeekAgo;
            });

            if (weeklyMatches.length + 1 >= 5) { // +1 for the current match
                awardBadge('marathoner', 'Bike');
            }
            
            const allPastPlayerIds = allMatchesSnapshot.docs.flatMap(d => d.data().player_ids as string[]);
            const uniquePlayers = new Set(allPastPlayerIds);
            uniquePlayers.delete(player.id);
            allPlayerIdsInMatch.forEach(pId => { if (pId !== player.id) uniquePlayers.add(pId); });
            if (uniquePlayers.size >= 20) {
                awardBadge('socialite', 'Users');
            }
            
            if (firstSeason && matchTimestamp >= firstSeason.startDate.toDate() && matchTimestamp <= firstSeason.endDate.toDate()) {
                awardBadge('pioneer', 'Rocket');
            }

            if (newBadges.length > 0) {
                updates.badges = [...(player.badges || []), ...newBadges];
            }
            
            playerUpdates.set(player.id, updates);
        }
        
        if (winner_team !== 'Draw') {
            const winningTeamIds = winner_team === 'Team 1' ? team1_ids : team2_ids;
            const losingTeamIds = winner_team === 'Team 1' ? team2_ids : team1_ids;

            // The Wall Badge
            if (margin >= 8) {
                for (const playerId of winningTeamIds) {
                    if (playerMap.get(playerId)?.role === 'guest') continue;
                    const player = playerMap.get(playerId);
                    const currentBadges = player?.badges || [];
                    const playerUpdate = playerUpdates.get(playerId) || {};
                    const newBadges = (playerUpdate.badges || currentBadges).slice();
                    
                    if (!newBadges.some(b => b.badgeId === 'the-wall')) {
                        const badge = ALL_BADGES.find(b => b.id === 'the-wall');
                        if (badge) {
                            newBadges.push({ badgeId: 'the-wall', timestamp: Timestamp.now() });
                            playerUpdate.badges = newBadges;
                            playerUpdates.set(playerId, playerUpdate);
                            notificationsToAdd.push({ playerId: playerId, config: { uid: playerId, title: 'BADGE UNLOCKED!', body: `Congratulations! You've earned the "${badge.name}" badge.`, timestamp: Timestamp.now(), isRead: false, link: '/profile', icon: 'Shield' }});
                        }
                    }
                }
            }

            // Giant Killer Badge
            const tierOrder: Tier[] = ['beginner', 'lower bronze', 'bronze', 'silver', 'gold'];
            const losingTeamTiers = losingTeamIds.map(id => playerMap.get(id)?.tier).filter(Boolean) as Tier[];
            const maxLosingTierIndex = Math.max(...losingTeamTiers.map(t => tierOrder.indexOf(t)));

            for (const winnerId of winningTeamIds) {
                if (playerMap.get(winnerId)?.role === 'guest') continue;
                const winner = playerMap.get(winnerId);
                const playerUpdate = playerUpdates.get(winnerId) || {};
                const currentBadges = winner?.badges || [];
                const newBadges = (playerUpdate.badges || currentBadges).slice();
                
                if (winner && !newBadges.some(b => b.badgeId === 'giant-killer')) {
                    const winnerTierIndex = tierOrder.indexOf(winner.tier);
                    if (maxLosingTierIndex >= winnerTierIndex + 2) { // 2 tiers higher
                        const badge = ALL_BADGES.find(b => b.id === 'giant-killer');
                        if (badge) {
                             newBadges.push({ badgeId: 'giant-killer', timestamp: Timestamp.now() });
                             playerUpdate.badges = newBadges;
                             playerUpdates.set(winnerId, playerUpdate);
                             notificationsToAdd.push({ playerId: winnerId, config: { uid: winnerId, title: 'BADGE UNLOCKED!', body: `Congratulations! You've earned the "${badge.name}" badge.`, timestamp: Timestamp.now(), isRead: false, link: '/profile', icon: 'Swords' }});
                        }
                    }
                }
            }
        }
        
        // Rank change notifications
        const newLeaderboard = oldLeaderboard.map((p: WithId<UserProfile>) => {
            const update = playerUpdates.get(p.id);
            return update ? { ...p, ...update } : p;
        }).sort((a: UserProfile, b: UserProfile) => b.total_points - a.total_points);

        for (const player of playersData) {
            if (player.role === 'guest') continue;
            const oldRankIndex = oldLeaderboard.findIndex((p: WithId<UserProfile>) => p.id === player.id);
            const newRankIndex = newLeaderboard.findIndex((p: WithId<UserProfile>) => p.id === player.id);

            if (oldRankIndex === -1) continue; 

            if (newRankIndex > oldRankIndex) {
                const overtaker = newLeaderboard[oldRankIndex];
                if (overtaker && overtaker.id !== player.id) {
                     notificationsToAdd.push({
                        playerId: player.id,
                        config: {
                            uid: player.id,
                            title: `DISALIP ${overtaker.name.toUpperCase()}!`,
                            body: `Posisi kamu baru saja disalip oleh ${overtaker.name}. Kamu turun ke peringkat #${newRankIndex + 1}. Yuk, rebut lagi posisimu!`,
                            timestamp: Timestamp.now(),
                            isRead: false,
                            link: '/',
                            icon: 'ArrowDown'
                        }
                    });
                }
            }
        }
        
        for (const [playerId, updates] of playerUpdates.entries()) {
            const playerRef = doc(firestore, 'users', playerId);
            batch.update(playerRef, updates);
        }

        for (const notif of notificationsToAdd) {
            const notifRef = doc(collection(firestore, 'users', notif.playerId, 'notifications'));
            batch.set(notifRef, notif.config);
        }
        
        const newMatchData: Omit<Match, 'id'> = { 
            timestamp: Timestamp.fromDate(matchTimestamp), 
            team_1: team1_ids, 
            team_2: team2_ids, 
            player_ids: allPlayerIdsInMatch, 
            score_1: data.score1, 
            score_2: data.score2, 
            winner_team: winner_team, 
            margin: margin,
            on_time_players: data.onTimePlayers,
            fair_play_players: data.fairPlayPlayers,
            slot_filler_players: data.slotFillerPlayers,
            point_breakdown: pointBreakdowns,
        };
        
        if (isEventMatch) {
            const event = events?.find(e => e.id === currentEventId);
            if (event) {
                newMatchData.eventId = event.id;
                newMatchData.eventName = event.name;

                const matchesForRoundQuery = query(collection(firestore, 'matches'), where('eventId', '==', currentEventId), where('roundNumber', '==', roundNumber));
                const matchesForRoundSnapshot = await getDocs(matchesForRoundQuery);
                const courtNumber = matchesForRoundSnapshot.size + 1;
                newMatchData.courtName = `Court ${courtNumber}`;

                if (event.courtId) {
                    const eventCourt = courtMap.get(event.courtId);
                    if (eventCourt) {
                        newMatchData.courtLocation = `${eventCourt.name} - ${eventCourt.location}`;
                    }
                    newMatchData.courtId = event.courtId;
                }
            }
        } else {
            const selectedCourt = courtMap.get(data.courtId!);
            newMatchData.courtId = data.courtId;
            newMatchData.courtName = selectedCourt!.name;
            newMatchData.courtLocation = selectedCourt!.location;
        }

        if (data.host_id) newMatchData.host_id = data.host_id;
        
        if (roundNumber) {
            newMatchData.roundNumber = roundNumber;
        }

        batch.set(newMatchRef, newMatchData);
        await batch.commit();

        for (const notif of notificationsToAdd) {
            const player = playerMap.get(notif.playerId);
            if (player?.fcmTokens && player.fcmTokens.length > 0) {
                await sendPushNotification(player.fcmTokens, {
                    title: notif.config.title,
                    body: notif.config.body,
                    link: notif.config.link,
                });
            }
        }

        toast({ title: 'Success!', description: "Match submitted and notifications sent." });
        
        if (currentEventId && currentEventId !== 'none') {
            router.push(`/admin/event-matches/${currentEventId}`);
        } else {
            router.push('/matches');
        }

    } catch (err) {
        console.error(err);
        let message = 'An unexpected error occurred.';
        if (err instanceof FirebaseError) {
            message = `Firestore error: ${err.message}`;
        } else if (err instanceof Error) {
            message = err.message;
        }
        setError(message);
        toast({ variant: "destructive", title: 'Match Submission Failed', description: message });
    } finally {
        setIsPending(false);
    }
  };
  
  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
            {error && (
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {isEventSelected && selectedEvent && roundNumber && (
                <Card className="bg-primary/10 border-primary/20">
                    <CardHeader className="text-center p-4">
                        <CardTitle className="text-lg">Event Match</CardTitle>
                        <CardDescription>
                            {selectedEvent.name} - <span className="font-bold">Round {roundNumber}</span>
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {!eventId && (
                <FormField
                    control={form.control}
                    name="eventId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Event (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={eventsLoading || !!eventId}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder={eventsLoading ? "Loading events..." : "Select an event"} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {events?.map(event => (
                            <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}


            <div className="relative text-center my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center">
                    <Button 
                        type="button" 
                        variant="secondary"
                        onClick={handleSuggestTeams}
                        disabled={matchPlayers.length !== 4 || isSuggesting || isPending}
                        className="px-4"
                    >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {isSuggesting ? 'Thinking...' : 'Suggest Teams'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-6">
              <div className="space-y-2 rounded-lg border p-3 sm:p-4">
                  <h3 className="font-bold text-center text-base sm:text-lg">TEAM 1</h3>
                  <div className="flex gap-2">
                      <PlayerSelectionSlot form={form} players={selectablePlayers} fieldName="team1_player1" />
                      <PlayerSelectionSlot form={form} players={selectablePlayers} fieldName="team1_player2" />
                  </div>
                  <ScoreInput form={form} name="score1" label="Skor Team 1" />
              </div>

              <div className="space-y-2 rounded-lg border p-3 sm:p-4">
                  <h3 className="font-bold text-center text-base sm:text-lg">TEAM 2</h3>
                  <div className="flex gap-2">
                      <PlayerSelectionSlot form={form} players={selectablePlayers} fieldName="team2_player1" />
                      <PlayerSelectionSlot form={form} players={selectablePlayers} fieldName="team2_player2" />
                  </div>
                  <ScoreInput form={form} name="score2" label="Skor Team 2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="matchDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Date</FormLabel>
                      <FormControl>
                        <Input 
                            placeholder="YYYY-MM-DD" 
                            {...field}
                            onChange={(e) => handleDateChange(e, field)}
                            maxLength={10}
                            disabled={isEventSelected}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="matchTime"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Match Time (24h)</FormLabel>
                            <FormControl>
                                <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            
            {!isEventSelected && (
              <FormField
                  control={form.control}
                  name="courtId"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Court</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={courtsLoading}>
                      <FormControl>
                          <SelectTrigger>
                          <SelectValue placeholder={courtsLoading ? "Loading courts..." : "Select a court"} />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {courts?.map(court => (
                          <SelectItem key={court.id} value={court.id}>{court.name} - {court.location}</SelectItem>
                          ))}
                      </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
                  )}
              />
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Bonus Pemain</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <BonusCheckboxes
                        form={form}
                        players={matchPlayers}
                        fieldName="onTimePlayers"
                        label="Datang On-Time"
                        icon={Clock}
                    />
                    <BonusCheckboxes
                        form={form}
                        players={matchPlayers}
                        fieldName="fairPlayPlayers"
                        label="Fair Play"
                        icon={Award}
                    />
                    <BonusCheckboxes
                        form={form}
                        players={matchPlayers}
                        fieldName="slotFillerPlayers"
                        label="Bantu Isi Slot Kosong"
                        icon={Users}
                    />
                    <HostSelection form={form} players={matchPlayers} />
                </CardContent>
            </Card>
            
            <SubmitButton isPending={isPending || form.formState.isSubmitting} />
        </form>
    </Form>
  );
}

const PlayerSelectionSlot = ({ form, players, fieldName }: { form: any, players: WithId<UserProfile>[], fieldName: keyof FormValues }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isScanSheetOpen, setScanSheetOpen] = useState(false);
    const scannerId = useId();
    const { toast } = useToast();

    const selectedPlayerId = form.watch(fieldName);
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    const allSelectedIds = form.watch(['team1_player1', 'team1_player2', 'team2_player1', 'team2_player2']);
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const handleSelect = (playerId: string) => {
        form.setValue(fieldName, playerId, { shouldValidate: true });
        setOpen(false);
        setSearch('');
    };
    
    const handleScanSuccess = (decodedText: string) => {
        try {
            const qrData = JSON.parse(decodedText);
            if (!qrData.uid || !qrData.timestamp) {
                toast({ variant: "destructive", title: "Invalid QR Code", description: "This QR code does not belong to a registered player." });
                setScanSheetOpen(false);
                return;
            }
    
            const now = Date.now();
            if (now - qrData.timestamp > 60000) { // 60-second validity
                toast({ variant: "destructive", title: "QR Code Expired", description: "Please ask the player to refresh their card." });
                setScanSheetOpen(false);
                return;
            }
    
            const player = playerMap.get(qrData.uid);
            if (!player) {
                toast({ variant: "destructive", title: "Player Not Found", description: "QR code not recognized." });
                setScanSheetOpen(false);
                return;
            }
    
            if (allSelectedIds.includes(player.id) && player.id !== selectedPlayerId) {
                toast({ variant: "destructive", title: "Player Already Selected", description: `${player.name} is already in another slot.` });
                setScanSheetOpen(false);
                return;
            }
            
            handleSelect(player.id);
            setScanSheetOpen(false);
    
        } catch (e) {
            toast({ variant: "destructive", title: "Invalid QR Code", description: "This QR code could not be read." });
            setScanSheetOpen(false);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      form.setValue(fieldName, '', { shouldValidate: true });
    }

    const filteredPlayers = useMemo(() => {
        return players.filter(p => p.name && p.name.toLowerCase().includes(search.toLowerCase()));
    }, [players, search]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <div className="flex-1 h-28 sm:h-auto sm:aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors relative group">
                    {selectedPlayer ? (
                        <>
                            <div className="flex flex-col items-center gap-1 text-center">
                                <Avatar className={cn("w-12 h-12 sm:w-16 sm:h-16", selectedPlayer.tier ? TIER_FRAME_CLASSES[selectedPlayer.tier] : 'border-2 border-border')}>
                                    {selectedPlayer.photoURL && <AvatarImage src={selectedPlayer.photoURL} alt={selectedPlayer.name} />}
                                    <AvatarFallback>{selectedPlayer.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <p className="text-xs font-semibold px-1 truncate w-24">{selectedPlayer.name}</p>
                            </div>
                            <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 z-10 opacity-0 group-hover:opacity-100" onClick={handleRemove}>
                                <X className="h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                         <div className="flex flex-col items-center justify-center text-muted-foreground hover:text-primary">
                            <UserPlus className="w-8 h-8 sm:w-10 sm:h-10" />
                            <span className="text-xs font-semibold mt-1">Select Player</span>
                        </div>
                    )}
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90dvh] flex flex-col">
                <SheetHeader className="text-center pt-4">
                    <SheetTitle>Select a Player</SheetTitle>
                </SheetHeader>
                 <div className="p-4 pt-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search existing player..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                         <Dialog open={isScanSheetOpen} onOpenChange={setScanSheetOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <QrCode className="h-5 w-5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Scan Player's QR Card</DialogTitle>
                                </DialogHeader>
                                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                    {isScanSheetOpen && <QrScanner readerId={scannerId} onScanSuccess={handleScanSuccess} />}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <ScrollArea className="flex-1 min-h-0 pb-4">
                    <div className="space-y-2 px-4">
                        {filteredPlayers.filter(p => !allSelectedIds.includes(p.id) || p.id === selectedPlayerId).map(p => (
                            <div key={p.id} onClick={() => handleSelect(p.id)} className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-accent cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        {p.photoURL && <AvatarImage src={p.photoURL} alt={p.name} />}
                                        <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold">{p.name}</p>
                                        <p className="text-sm text-muted-foreground">{capitalize(p.tier)}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
};


const BonusCheckboxes = ({ form, players, fieldName, label, icon: Icon }: { form: any, players: WithId<UserProfile>[], fieldName: "onTimePlayers" | "fairPlayPlayers" | "slotFillerPlayers", label: string, icon: React.ElementType }) => {
    return (
        <FormField
            control={form.control}
            name={fieldName}
            render={() => (
                <FormItem>
                    <div className="mb-2 flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        <FormLabel className="text-lg font-semibold">{label}</FormLabel>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {players.map((player) => (
                            <FormField
                                key={player.id}
                                control={form.control}
                                name={fieldName}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(player.id)}
                                                onCheckedChange={(checked) => {
                                                    return checked
                                                        ? field.onChange([...(field.value || []), player.id])
                                                        : field.onChange(field.value?.filter((value: string) => value !== player.id));
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal text-sm">{player.name}</FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};


const HostSelection = ({ form, players }: { form: any, players: WithId<UserProfile>[] }) => {
    const [open, setOpen] = useState(false);
    const { watch } = form;
    const hostId = watch('host_id');
    const hostPlayer = players.find(p => p.id === hostId);

    const handleSelect = (playerId: string) => {
        form.setValue('host_id', playerId);
        setOpen(false);
    };

    return (
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <Label htmlFor="host_match" className="text-lg font-semibold">Host Match</Label>
           </div>
           <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                  <Button variant="outline" className="h-10 min-w-[120px]">
                      {hostPlayer ? (
                          <div className="flex items-center gap-2">
                           <Avatar className="h-6 w-6">
                              {hostPlayer.photoURL && <AvatarImage src={hostPlayer.photoURL} alt={hostPlayer.name} />}
                              <AvatarFallback>{hostPlayer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{hostPlayer.name}</span>
                          </div>
                      ) : (
                          <span>Pilih Host</span>
                      )}
                  </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[90dvh] flex flex-col">
                  <SheetHeader className="text-center pt-4">
                      <SheetTitle>Select Match Host</SheetTitle>
                  </SheetHeader>
                   <ScrollArea className="flex-1 min-h-0 pb-4 mt-4">
                        <div className="space-y-2 px-4">
                            <div onClick={() => handleSelect('')} className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-accent cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <Avatar><AvatarFallback>?</AvatarFallback></Avatar>
                                    <p className="font-bold">No Host</p>
                                </div>
                                {!hostId && <Check className="h-5 w-5 text-primary" />}
                            </div>
                            {players.map(p => (
                                <div key={p.id} onClick={() => handleSelect(p.id)} className="flex items-center justify-between p-3 bg-card rounded-xl hover:bg-accent cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <Avatar>
                                            {p.photoURL && <AvatarImage src={p.photoURL} alt={p.name} />}
                                            <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold">{p.name}</p>
                                            <p className="text-sm text-muted-foreground">{capitalize(p.tier)}</p>
                                        </div>
                                    </div>
                                    {hostId === p.id && <Check className="h-5 w-5 text-primary" />}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
              </SheetContent>
          </Sheet>
        </div>
    );
}

function ScoreInput({ form, name, label }: { form: any; name: keyof FormValues; label: string }) {
  return (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem>
                <FormLabel className="sr-only">{label}</FormLabel>
                <FormControl>
                    <Input type="number" {...field} className="h-12 sm:h-14 text-center text-2xl sm:text-3xl font-black"/>
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
  );
}

function SubmitButton({ isPending }: { isPending: boolean }) {
    return (
        <Button type="submit" disabled={isPending} className="w-full h-14 bg-primary text-primary-foreground font-black text-lg uppercase tracking-widest">
            {isPending ? 'Submitting...' : 'Post Match Results'}
        </Button>
    );
}
