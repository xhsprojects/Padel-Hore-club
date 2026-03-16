'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, writeBatch, Timestamp, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import type { Season, WithId, UserProfile, Match, FinalLeaderboardPlayer, Tier, TierThresholds, AppSettings } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2, PlayCircle, CheckCircle2, Edit, Trash2, Medal } from 'lucide-react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, add } from 'date-fns';
import { getTier } from '@/lib/utils';
import { ALL_BADGES } from '@/lib/badges';
import { DEFAULT_THRESHOLDS, DEFAULT_RESET_PERCENTAGES } from '@/lib/constants';
import { sendPushNotification } from '@/actions/send-push-notification';
import { Skeleton } from '../ui/skeleton';


const SeasonSchema = z.object({
  name: z.string().min(3, 'Season name must be at least 3 characters'),
  durationInMonths: z.coerce.number().min(1, 'Duration must be at least 1 month').max(12, "Duration cannot exceed 12 months"),
});

type SeasonFormValues = z.infer<typeof SeasonSchema>;

interface SeasonManagementProps {
    onEdit: (season: WithId<Season>) => void;
    onDelete: (season: WithId<Season>) => void;
}

export function SeasonManagement({ onEdit, onDelete }: SeasonManagementProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [seasonToActivate, setSeasonToActivate] = useState<WithId<Season> | null>(null);

  const form = useForm<SeasonFormValues>({
    resolver: zodResolver(SeasonSchema),
    defaultValues: { name: '', durationInMonths: 3 },
  });

  const seasonsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'seasons'), orderBy('startDate', 'desc'));
  }, [firestore]);
  const { data: seasons, isLoading } = useCollection<Season>(seasonsQuery);

  const onSubmit = async (data: SeasonFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
        const now = new Date();
        const endDate = add(now, { months: data.durationInMonths });
      
        const newSeasonData: Omit<Season, 'id'> = {
            name: data.name,
            startDate: Timestamp.fromDate(now),
            endDate: Timestamp.fromDate(endDate),
            isActive: false, // Will be activated manually
        };

      await addDoc(collection(firestore, 'seasons'), newSeasonData);
      toast({ title: 'Success', description: 'Season created. You can now activate it.' });
      form.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create season.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateClick = (season: WithId<Season>) => {
    setSeasonToActivate(season);
    setIsAlertOpen(true);
  };

  const getRetentionRate = (tier: Tier, percentages: Record<Tier, number>): number => {
    return (percentages[tier] ?? 20) / 100;
  };

  const confirmActivation = async () => {
    if (!firestore || !seasonToActivate || !seasons) return;
    setIsSubmitting(true);
    
    const batch = writeBatch(firestore);
    const notificationsToAdd: any[] = [];
    const currentActiveSeason = seasons.find(s => s.isActive);
    
    // Fetch tier settings for calculations
    const appSettingsDoc = await getDoc(doc(firestore, 'settings', 'general'));
    const appSettings = appSettingsDoc.exists() ? appSettingsDoc.data() as AppSettings : {} as AppSettings;
    const thresholds = appSettings.tierThresholds || DEFAULT_THRESHOLDS;
    const percentages = appSettings.tierResetPercentages || DEFAULT_RESET_PERCENTAGES;
    
    // This object will hold the calculated points for each player in the season that is ending.
    // It's crucial for both archiving the final leaderboard and for calculating the reset points.
    const playerStatsForEndedSeason: { [playerId: string]: { points: number; wins: number; matches: number } } = {};
    
    if (currentActiveSeason) {
        const allMatchesSnapshot = await getDocs(collection(firestore, 'matches'));
        const allMatches = allMatchesSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as WithId<Match>[];
        
        const allPlayersSnapshot = await getDocs(collection(firestore, 'users'));
        const allPlayers = allPlayersSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as WithId<UserProfile>[];

        const seasonMatches = allMatches.filter(match => {
            const matchDate = match.timestamp.toDate();
            const startDate = currentActiveSeason.startDate.toDate();
            const endDate = currentActiveSeason.endDate.toDate();
            return matchDate >= startDate && matchDate <= endDate;
        });

        // Initialize stats for all players
        allPlayers.forEach(p => { playerStatsForEndedSeason[p.id] = { points: 0, wins: 0, matches: 0 }; });

        // Calculate stats for the ending season
        seasonMatches.forEach(match => {
            for (const playerId of match.player_ids) {
                 if (playerStatsForEndedSeason[playerId]) {
                    playerStatsForEndedSeason[playerId].matches++;
                    if (match.point_breakdown && match.point_breakdown[playerId]) {
                        playerStatsForEndedSeason[playerId].points += Math.round(match.point_breakdown[playerId].total);
                    }
                    const isWinner = (match.winner_team === 'Team 1' && match.team_1.includes(playerId)) ||
                                     (match.winner_team === 'Team 2' && match.team_2.includes(playerId));
                    if (isWinner) {
                        playerStatsForEndedSeason[playerId].wins++;
                    }
                }
            }
        });

        const finalLeaderboard = allPlayers
            .map(p => ({
                ...p,
                total_points: playerStatsForEndedSeason[p.id]?.points || 0,
                win_count: playerStatsForEndedSeason[p.id]?.wins || 0,
                match_count: playerStatsForEndedSeason[p.id]?.matches || 0,
            }))
            .sort((a, b) => b.total_points - a.total_points);

        const podiumPlayers = finalLeaderboard.filter(p => p.role !== 'admin').slice(0, 3);
        
        podiumPlayers.forEach((player, index) => {
            if (player.total_points > 0) {
                const badgeId = `podium-${index + 1}`;
                const playerRef = doc(firestore, 'users', player.id);
                const existingBadges = player.badges || [];
                
                if (!existingBadges.find(b => b.badgeId === badgeId)) {
                    const updatedBadges = [...existingBadges, { badgeId, timestamp: Timestamp.now() }];
                     if (index === 0) {
                        const podium1Count = updatedBadges.filter(b => b.badgeId === 'podium-1').length;
                        if (podium1Count === 3 && !updatedBadges.find(b => b.badgeId === 'hat-trick')) {
                            const badge = ALL_BADGES.find(b => b.id === 'hat-trick');
                            if (badge) {
                                updatedBadges.push({ badgeId: 'hat-trick', timestamp: Timestamp.now() });
                                notificationsToAdd.push({ playerId: player.id, config: { uid: player.id, title: 'BADGE UNLOCKED!', body: `Congratulations! You've earned the "${badge.name}" badge.`, timestamp: Timestamp.now(), isRead: false, link: '/profile', icon: 'Medal' }});
                            }
                        }
                    }
                    batch.update(playerRef, { badges: updatedBadges });
                }
            }
        });
        
        const finalLeaderboardForStorage: FinalLeaderboardPlayer[] = finalLeaderboard
          .filter(p => p.role !== 'admin')
          .map(p => ({
            id: p.id,
            name: p.name || 'Unknown Player',
            phId: p.phId || `PH-${p.id.substring(0, 4).toUpperCase()}`,
            photoURL: p.photoURL || null,
            tier: getTier(p.total_points, thresholds),
            total_points: p.total_points,
            win_count: p.win_count,
            match_count: p.match_count,
        }));

        const endingSeasonRef = doc(firestore, 'seasons', currentActiveSeason.id);
        batch.update(endingSeasonRef, { finalLeaderboard: finalLeaderboardForStorage });
    }

    const usersCollectionRef = collection(firestore, 'users');
    const usersSnapshot = await getDocs(usersCollectionRef);

    usersSnapshot.forEach(userDoc => {
        const player = userDoc.data() as UserProfile;
        if (player.role === 'admin') return;

        const pointsFromEndedSeason = playerStatsForEndedSeason[userDoc.id]?.points || 0;
        const playerTier = getTier(player.total_points, thresholds);
        const baseTierPoints = thresholds[playerTier]?.min ?? 0;
        const retentionRate = getRetentionRate(playerTier, percentages);
        const newPoints = Math.round((pointsFromEndedSeason * retentionRate) + baseTierPoints);
        const newTier = getTier(newPoints, thresholds);
        
        const playerRef = doc(firestore, 'users', userDoc.id);
        batch.update(playerRef, {
            total_points: newPoints,
            tier: newTier,
            win_streak: 0,
        });
    });


    seasons.forEach(s => {
        if (s.id !== seasonToActivate.id) {
            const seasonRef = doc(firestore, 'seasons', s.id);
            batch.update(seasonRef, { isActive: false });
        }
    });

    const newActiveSeasonRef = doc(firestore, 'seasons', seasonToActivate.id);
    batch.update(newActiveSeasonRef, { isActive: true });
    
    for (const notif of notificationsToAdd) {
        const notifRef = doc(collection(firestore, 'users', notif.playerId, 'notifications'));
        batch.set(notifRef, notif.config);
    }
    
    try {
      await batch.commit();

      for (const notif of notificationsToAdd) {
          const userDoc = await getDoc(doc(firestore, 'users', notif.playerId));
          if (userDoc.exists()) {
              const userProfile = userDoc.data() as UserProfile;
              if (userProfile.fcmTokens && userProfile.fcmTokens.length > 0) {
                  await sendPushNotification(userProfile.fcmTokens, {
                      title: notif.config.title,
                      body: notif.config.body,
                      link: notif.config.link,
                  });
              }
          }
      }

      toast({ title: 'Success!', description: `${seasonToActivate.name} is now active, points reset, and badges awarded.` });
    } catch (error) {
      console.error("Error activating season:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not activate the new season.' });
    } finally {
      setIsSubmitting(false);
      setIsAlertOpen(false);
      setSeasonToActivate(null);
    }
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-end gap-4 border p-4 rounded-lg">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1 w-full">
                <FormLabel>New Season Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Season 1: The Dawn" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationInMonths"
            render={({ field }) => (
              <FormItem className="w-full sm:w-48">
                <FormLabel>Duration (Months)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto mt-4 sm:mt-0">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Create Season
          </Button>
        </form>
      </Form>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-48 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </>
            ) : seasons && seasons.length > 0 ? (
              seasons.map(season => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">{season.name}</TableCell>
                  <TableCell>{format(season.startDate.toDate(), 'dd MMM yyyy')} - {format(season.endDate.toDate(), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    {season.isActive ? (
                        <div className="flex items-center gap-2 text-green-500 font-semibold">
                            <CheckCircle2 className="h-4 w-4" /> Active
                        </div>
                    ) : (
                         <span className="text-muted-foreground">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleActivateClick(season)} disabled={season.isActive || isSubmitting}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Activate
                    </Button>
                     <Button variant="ghost" size="icon" className="ml-2" onClick={() => onEdit(season)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={season.isActive ? 0 : -1}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => onDelete(season)} 
                              disabled={season.isActive}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {season.isActive && (
                          <TooltipContent>
                            <p>Cannot delete the active season.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No seasons found. Create one to begin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate New Season?</AlertDialogTitle>
            <AlertDialogDescription>
              You will activate '<span className="font-bold">{seasonToActivate?.name}</span>'. This will perform a{' '}
              <strong className="text-destructive">soft reset</strong> of all player points based on their final tier.
              <br /><br />
              This will also save the final leaderboard for the ending season and award podium badges. This action cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActivation} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting ? 'Activating...' : 'Activate & Reset Points'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
