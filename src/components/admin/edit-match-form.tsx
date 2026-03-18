'use client';

import { useState, useMemo } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import type { UserProfile, WithId, PointBreakdown, Match, Court, TierThresholds, AppSettings } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Terminal, UserPlus, X, Award, Clock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { POINT_RULES, TIER_FRAME_CLASSES, DEFAULT_THRESHOLDS } from '@/lib/constants';
import { collection, doc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { cn, getTier } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';

const MatchFormSchema = z.object({
  team1_player1: z.string().min(1, 'Player is required'),
  team1_player2: z.string().min(1, 'Player is required'),
  team2_player1: z.string().min(1, 'Player is required'),
  team2_player2: z.string().min(1, 'Player is required'),
  score1: z.coerce.number().min(0, 'Score must be non-negative'),
  score2: z.coerce.number().min(0, 'Score must be non-negative'),
  courtId: z.string().min(1, 'Court is required'),
  host_id: z.string().optional(),
  onTimePlayers: z.array(z.string()),
  fairPlayPlayers: z.array(z.string()),
  slotFillerPlayers: z.array(z.string()),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid format, use YYYY-MM-DD'),
  matchTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
}).refine(data => {
    const players = [data.team1_player1, data.team1_player2, data.team2_player1, data.team2_player2];
    const validPlayers = players.filter(p => p && p.length > 0);
    return new Set(validPlayers).size === validPlayers.length;
}, {
    message: 'Each player must be unique and cannot be selected more than once.',
    path: ['team1_player1'],
});

type FormValues = z.infer<typeof MatchFormSchema>;

interface EditMatchFormProps {
    match: WithId<Match>;
    allPlayers: WithId<UserProfile>[];
    setOpen: (open: boolean) => void;
}

export function EditMatchForm({ match, allPlayers, setOpen }: EditMatchFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const courtsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courts');
  }, [firestore]);
  const { data: courts, isLoading: courtsLoading } = useCollection<Court>(courtsQuery);
  const courtMap = useMemo(() => new Map(courts?.map(c => [c.id, c])), [courts]);
  
  const tierSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'tier_thresholds');
  }, [firestore]);
  const { data: tierSettings } = useDoc<TierThresholds>(tierSettingsRef);
  const thresholds = tierSettings || DEFAULT_THRESHOLDS;

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'settings', 'general');
  }, [firestore]);
  const { data: appSettings } = useDoc<AppSettings>(settingsRef);

  const selectablePlayers = useMemo(() => allPlayers.filter(p => p.role !== 'admin'), [allPlayers]);
  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers]);

  const form = useForm<FormValues>({
    resolver: zodResolver(MatchFormSchema),
    defaultValues: {
        team1_player1: match.team_1[0] || '',
        team1_player2: match.team_1[1] || '',
        team2_player1: match.team_2[0] || '',
        team2_player2: match.team_2[1] || '',
        score1: match.score_1,
        score2: match.score_2,
        courtId: match.courtId || '',
        host_id: match.host_id || undefined,
        onTimePlayers: match.on_time_players || [],
        fairPlayPlayers: match.fair_play_players || [],
        slotFillerPlayers: match.slot_filler_players || [],
        matchDate: format(match.timestamp.toDate(), 'yyyy-MM-dd'),
        matchTime: format(match.timestamp.toDate(), 'HH:mm'),
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

  const selectedPlayerIds = form.watch(['team1_player1', 'team1_player2', 'team2_player1', 'team2_player2']);
  const matchPlayers = useMemo(() => {
    return selectedPlayerIds.map(id => playerMap.get(id)).filter(Boolean) as WithId<UserProfile>[];
  }, [selectedPlayerIds, playerMap]);


  const onSubmit = async (data: FormValues) => {
    setIsPending(true);
    setError(null);
    if (!firestore) {
        setError("Firestore is not available.");
        setIsPending(false);
        return;
    }
    const selectedCourt = courtMap.get(data.courtId);
    if (!selectedCourt) {
        setError("Selected court not found.");
        setIsPending(false);
        return;
    }

    const batch = writeBatch(firestore);

    try {
        const { matchDate, matchTime } = data;
        const matchTimestamp = new Date(`${matchDate}T${matchTime}`);

        // --- Part 1: Revert old stats ---
        const originalPlayerIds = match.player_ids;
        const playerProfilesToUpdate: { [key: string]: WithId<UserProfile> } = {};

        for(const playerId of originalPlayerIds) {
            const playerDoc = await getDoc(doc(firestore, 'users', playerId));
            if(playerDoc.exists()){
                playerProfilesToUpdate[playerId] = { ...playerDoc.data(), id: playerId } as WithId<UserProfile>;
            }
        }

        for (const playerId of originalPlayerIds) {
            const player = playerProfilesToUpdate[playerId];
            const pointInfo = match.point_breakdown?.[playerId];
            if (player && pointInfo) {
                const isWinner = (match.winner_team === 'Team 1' && match.team_1.includes(playerId)) ||
                                (match.winner_team === 'Team 2' && match.team_2.includes(playerId));
                
                player.total_points -= Math.round(pointInfo.total);
                player.match_count -= 1;
                if (isWinner) player.win_count -= 1;
            }
        }

        // --- Part 2: Calculate and apply new stats ---
        const newTeam1Ids = [data.team1_player1, data.team1_player2];
        const newTeam2Ids = [data.team2_player1, data.team2_player2];
        const newAllPlayerIds = [...newTeam1Ids, ...newTeam2Ids];
        const newPointBreakdowns: { [key: string]: PointBreakdown } = {};

        const rules = {
            PARTICIPATION: { ...POINT_RULES.PARTICIPATION, ...appSettings?.pointRules?.PARTICIPATION },
            RESULT: { ...POINT_RULES.RESULT, ...appSettings?.pointRules?.RESULT },
            MARGIN_BONUS: { ...POINT_RULES.MARGIN_BONUS, ...appSettings?.pointRules?.MARGIN_BONUS },
            BEHAVIOR: { ...POINT_RULES.BEHAVIOR, ...appSettings?.pointRules?.BEHAVIOR },
            CONSISTENCY: { ...POINT_RULES.CONSISTENCY, ...appSettings?.pointRules?.CONSISTENCY },
        };

        for (const playerId of newAllPlayerIds) {
             if (!playerProfilesToUpdate[playerId]) {
                const playerDoc = await getDoc(doc(firestore, 'users', playerId));
                if(playerDoc.exists()){
                    playerProfilesToUpdate[playerId] = { ...playerDoc.data(), id: playerId } as WithId<UserProfile>;
                }
            }

            const player = playerProfilesToUpdate[playerId];
            if (!player) continue;

            const breakdown: PointBreakdown = { base: 0, result: 0, margin: 0, host_match: 0, slot_filler: 0, on_time: 0, fair_play: 0, consistency: 0, total: 0 };
            const winnerTeam = data.score1 > data.score2 ? 'Team 1' : data.score2 > data.score1 ? 'Team 2' : 'Draw';
            const margin = Math.abs(data.score1 - data.score2);
            const isWinner = (winnerTeam === 'Team 1' && newTeam1Ids.includes(playerId)) || (winnerTeam === 'Team 2' && newTeam2Ids.includes(playerId));
            
            breakdown.base = player.role === 'member' ? rules.PARTICIPATION.MEMBER : rules.PARTICIPATION.NON_MEMBER;
            if (winnerTeam === 'Draw') breakdown.result = rules.RESULT.DRAW;
            else if (isWinner) breakdown.result = rules.RESULT.WIN;
            else breakdown.result = rules.RESULT.LOSS;

            if (winnerTeam !== 'Draw') {
                if (isWinner) {
                    if (margin >= 5) breakdown.margin = rules.MARGIN_BONUS.DOMINANT_WIN;
                    else if (margin >= 1 && margin <= 4) breakdown.margin = rules.MARGIN_BONUS.CLOSE_WIN;
                } else {
                    if (margin <= 2) breakdown.margin = rules.MARGIN_BONUS.HONORABLE_LOSS;
                }
            }

            if (data.host_id === playerId) breakdown.host_match = rules.BEHAVIOR.HOST_MATCH;
            if (data.onTimePlayers.includes(playerId)) breakdown.on_time = rules.BEHAVIOR.ON_TIME;
            if (data.fairPlayPlayers.includes(playerId)) breakdown.fair_play = rules.BEHAVIOR.FAIR_PLAY;
            if (data.slotFillerPlayers.includes(playerId)) breakdown.slot_filler = rules.BEHAVIOR.SLOT_FILLER;
            
            // Note: Consistency bonus calculation is omitted in edit for simplicity, as it depends on historical data.
            
            const totalPointsForMatch = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
            breakdown.total = totalPointsForMatch;
            newPointBreakdowns[playerId] = breakdown;

            player.total_points += Math.round(totalPointsForMatch);
            player.match_count += 1;
            if (isWinner) player.win_count += 1;
            player.tier = getTier(player.total_points, thresholds);
            // Ignoring win_streak update in edit for simplicity
        }

        // --- Part 3: Batch update all affected users ---
        for (const playerId in playerProfilesToUpdate) {
            const playerRef = doc(firestore, 'users', playerId);
            const { id, ...playerData } = playerProfilesToUpdate[playerId];
            batch.update(playerRef, playerData as any);
        }

        // --- Part 4: Update the match document ---
        const matchRef = doc(firestore, 'matches', match.id);
        batch.update(matchRef, {
            timestamp: Timestamp.fromDate(matchTimestamp),
            team_1: newTeam1Ids,
            team_2: newTeam2Ids,
            player_ids: newAllPlayerIds,
            score_1: data.score1,
            score_2: data.score2,
            winner_team: data.score1 > data.score2 ? 'Team 1' : data.score2 > data.score1 ? 'Team 2' : 'Draw',
            margin: Math.abs(data.score1 - data.score2),
            courtId: data.courtId,
            courtName: selectedCourt.name,
            courtLocation: selectedCourt.location,
            on_time_players: data.onTimePlayers,
            fair_play_players: data.fairPlayPlayers,
            slot_filler_players: data.slotFillerPlayers,
            point_breakdown: newPointBreakdowns,
            host_id: data.host_id || null,
        });

        await batch.commit();

        toast({ title: 'Success!', description: "Match updated and stats recalculated." });
        setOpen(false);

    } catch (err) {
        console.error("Error updating match:", err);
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        setError(message);
        toast({ variant: "destructive", title: 'Update Failed', description: message });
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
            
            <FormField
                control={form.control}
                name="courtId"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Court</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={courtsLoading}>
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
            
            <Button type="submit" disabled={isPending || form.formState.isSubmitting} className="w-full">
                {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
        </form>
    </Form>
  );
}

// Re-using sub-components from match-form.tsx

const PlayerSelectionSlot = ({ form, players, fieldName }: { form: any, players: WithId<UserProfile>[], fieldName: keyof FormValues }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selectedPlayerId = form.watch(fieldName);
    const selectedPlayer = players.find(p => p.id === selectedPlayerId);
    
    // In edit form, all players are technically "selected" initially, so we adjust the filter logic
    const allSelectedOnForm = form.watch(['team1_player1', 'team1_player2', 'team2_player1', 'team2_player2']);
    const otherSelectedIds = allSelectedOnForm.filter((id: string) => id !== selectedPlayerId);


    const handleSelect = (playerId: string) => {
        form.setValue(fieldName, playerId, { shouldValidate: true });
        setOpen(false);
        setSearch('');
    };

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      form.setValue(fieldName, '', { shouldValidate: true });
    }

    const filteredPlayers = useMemo(() => {
        return players.filter(p => p.name && p.name.toLowerCase().includes(search.toLowerCase()));
    }, [players, search]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
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
                        <PlusCircle className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                    )}
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select a Player</DialogTitle>
                </DialogHeader>
                 <div className="p-4 pt-0">
                    <Input
                        placeholder="Search player..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-2 p-4 pt-0">
                        {filteredPlayers.filter(p => !otherSelectedIds.includes(p.id)).map(p => (
                            <div key={p.id} onClick={() => handleSelect(p.id)} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent cursor-pointer">
                                <Avatar>
                                    {p.photoURL && <AvatarImage src={p.photoURL} alt={p.name} />}
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{p.name}</span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
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
    const { watch } = form;
    const hostId = watch('host_id');
    const hostPlayer = players.find(p => p.id === hostId);

    const handleSelect = (playerId: string) => {
        form.setValue('host_id', playerId);
    };

    return (
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <Label htmlFor="host_match" className="text-lg font-semibold">Host Match</Label>
           </div>
           <Dialog>
              <DialogTrigger asChild>
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
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Select Match Host</DialogTitle>
                  </DialogHeader>
                   <div className="space-y-2 p-4">
                        <div onClick={() => handleSelect('')} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent cursor-pointer">
                            <span>No Host</span>
                        </div>
                        {players.map(p => (
                            <div key={p.id} onClick={() => handleSelect(p.id)} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent cursor-pointer">
                                <Avatar>
                                    {p.photoURL && <AvatarImage src={p.photoURL} alt={p.name} />}
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{p.name}</span>
                            </div>
                        ))}
                    </div>
              </DialogContent>
          </Dialog>
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
