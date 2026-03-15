'use client';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, writeBatch, arrayUnion, updateDoc, where, getDoc } from 'firebase/firestore';
import type { Event, EventRegistration, WithId, Match, UserProfile, Round } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Users, Trash2, PlusCircle, Edit, Swords, UserX, Crown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EditMatchForm } from '@/components/admin/edit-match-form';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TIER_FRAME_CLASSES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// NOTE: This page is for managing rounds and matches within an event.
// The main event details/participant management is on /admin/events/[id]

export default function AdminEventMatchManagementPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [matchToDelete, setMatchToDelete] = useState<WithId<Match> | null>(null);
    const [matchToEdit, setMatchToEdit] = useState<WithId<Match> | null>(null);

    const eventRef = useMemoFirebase(() => firestore ? doc(firestore, 'events', id) : null, [firestore, id]);
    const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

    const registrationsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'events', id, 'registrations')) : null, [firestore, id]);
    const { data: registrations, isLoading: registrationsLoading } = useCollection<WithId<EventRegistration>>(registrationsQuery);

    const matchesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'matches'), where('eventId', '==', id)) : null, [firestore, id]);
    const { data: matches, isLoading: matchesLoading } = useCollection<WithId<Match>>(matchesQuery);

    const allPlayersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: allPlayers, isLoading: allPlayersLoading } = useCollection<WithId<UserProfile>>(allPlayersQuery);

    const playersMap = useMemo(() => new Map(allPlayers?.map(p => [p.id, p])), [allPlayers]);

    const roundsWithData = useMemo(() => {
        if (!event?.rounds) return [];
        return event.rounds.map(round => ({
            ...round,
            matches: matches?.filter(m => m.roundNumber === round.roundNumber).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()) || [],
            byePlayers: round.byePlayerIds?.map(id => playersMap.get(id)).filter(Boolean) as WithId<UserProfile>[] || [],
        })).sort((a, b) => a.roundNumber - b.roundNumber);
    }, [event, matches, playersMap]);

    const handleAddRound = async () => {
        if (!eventRef || !event) return;
        setIsProcessing(true);
        const nextRoundNumber = (event.rounds?.length || 0) + 1;
        const newRound: Round = { roundNumber: nextRoundNumber, byePlayerIds: [] };
        try {
            await updateDoc(eventRef, {
                rounds: arrayUnion(newRound)
            });
            toast({ title: 'Success', description: `Round ${nextRoundNumber} has been added.` });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add a new round.' });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDeleteMatch = async () => {
        // This is a simplified delete, doesn't revert points for now.
        if (!firestore || !matchToDelete) return;
        setIsProcessing(true);
        try {
            await writeBatch(firestore).delete(doc(firestore, 'matches', matchToDelete.id)).commit();
            toast({ title: 'Match Deleted' });
            setMatchToDelete(null);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the match.' });
        } finally {
            setIsProcessing(false);
        }
    }

    const isLoading = eventLoading || matchesLoading || allPlayersLoading || registrationsLoading;

    if (isLoading) {
        return (
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32 ml-auto" />
                    <Card><CardHeader><Skeleton className="h-8 w-64" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
                </div>
            </div>
        );
    }
    
    if (!event) notFound();

    const participants = registrations?.filter(r => r.status === 'confirmed').map(r => playersMap.get(r.userId)).filter(Boolean) as WithId<UserProfile>[] || [];

    return (
        <>
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                             <Button variant="outline" onClick={() => router.push('/admin/event-matches')} className="mb-2">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Event List
                            </Button>
                            <h1 className="font-headline text-3xl">{event.name}</h1>
                            <p className="text-muted-foreground">Match & Round Management</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleAddRound} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Round</Button>
                        </div>
                    </div>
                    {roundsWithData.map(round => (
                        <Card key={round.roundNumber}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Round {round.roundNumber}</CardTitle>
                                <div className="flex gap-2">
                                    <SetByePlayersDialog event={event} round={round} participants={participants} />
                                    <Button asChild size="sm">
                                        <Link href={`/admin?eventId=${id}&roundNumber=${round.roundNumber}`}><PlusCircle className="mr-2 h-4 w-4"/>Add Match</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {round.matches.length === 0 && round.byePlayers.length === 0 && <p className="text-muted-foreground text-center p-4">No matches or bye players for this round yet.</p>}
                                {round.matches.length > 0 && (
                                    <div className="space-y-3">
                                        {round.matches.map(m => <MatchResultCard key={m.id} match={m} playersMap={playersMap} onEdit={() => setMatchToEdit(m)} onDelete={() => setMatchToDelete(m)} />)}
                                    </div>
                                )}
                                {round.byePlayers.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-bold mb-2 flex items-center gap-2"><UserX className="h-4 w-4" />Bye Players</h4>
                                        <div className="flex flex-wrap gap-4">
                                            {round.byePlayers.map(p => (
                                                <div key={p.id} className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarImage src={p.photoURL || undefined} /><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <p className="text-sm">{p.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
            
            <AlertDialog open={!!matchToDelete} onOpenChange={(open) => !open && setMatchToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this match?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the match record. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteMatch} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : "Delete"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={!!matchToEdit} onOpenChange={(open) => !open && setMatchToEdit(null)}>
                <DialogContent className="max-w-4xl">
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
                            setOpen={(open) => !open && setMatchToEdit(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function MatchResultCard({ match, playersMap, onEdit, onDelete }: { match: WithId<Match>, playersMap: Map<string, WithId<UserProfile>>, onEdit: () => void, onDelete: () => void }) {
    const team1 = match.team_1.map(id => playersMap.get(id));
    const team2 = match.team_2.map(id => playersMap.get(id));
    return (
        <Card className="p-3 bg-card/50 relative group">
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit className="h-4 w-4"/></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4"/></Button>
            </div>
            <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-muted-foreground">
                    <p>{format(match.timestamp.toDate(), 'p')}</p>
                    {match.courtName && <p className="font-semibold flex items-center gap-1"><MapPin className="h-3 w-3" />{match.courtName}</p>}
                </div>
                <p className="font-black text-xl">{match.score_1} - {match.score_2}</p>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                <div className="flex flex-col gap-1 items-start text-left">{team1.map(p => <PlayerChip key={p?.id} player={p} />)}</div>
                <Swords className="text-muted-foreground" />
                <div className="flex flex-col gap-1 items-end text-right">{team2.map(p => <PlayerChip key={p?.id} player={p} />)}</div>
            </div>
        </Card>
    );
}

function PlayerChip({ player }: { player?: WithId<UserProfile> }) {
    if (!player) return null;
    return <div className="flex items-center gap-2"><Avatar className={cn("w-5 h-5", TIER_FRAME_CLASSES[player.tier])}><AvatarImage src={player.photoURL || undefined} /><AvatarFallback className="text-[10px]">{player.name.charAt(0)}</AvatarFallback></Avatar><p className="text-xs font-medium truncate">{player.name}</p></div>;
}

function SetByePlayersDialog({ event, round, participants }: { event: WithId<Event>, round: Round & { id?: string }, participants: WithId<UserProfile>[] }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedByePlayers, setSelectedByePlayers] = useState<string[]>(round.byePlayerIds || []);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (!firestore) return;
        setIsSubmitting(true);
        const eventRef = doc(firestore, 'events', event.id);
        const updatedRounds = event.rounds?.map(r => 
            r.roundNumber === round.roundNumber 
            ? { ...r, byePlayerIds: selectedByePlayers } 
            : r
        ) || [];
        try {
            await updateDoc(eventRef, { rounds: updatedRounds });
            toast({ title: "Bye players updated!" });
            setIsOpen(false);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: "Error", description: "Could not save bye players." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><UserX className="mr-2 h-4 w-4"/>Set Byes</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Set Bye Players for Round {round.roundNumber}</DialogTitle><DialogDescription>Select players who will not play in this round.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto p-1">
                    {participants.map(p => (
                        <div key={p.id} className="flex items-center space-x-2">
                             <Checkbox
                                id={`bye-${p.id}`}
                                checked={selectedByePlayers.includes(p.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedByePlayers(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                                }}
                            />
                            <Label htmlFor={`bye-${p.id}`} className="text-sm font-medium leading-none flex items-center gap-2">
                                <Avatar className="h-6 w-6"><AvatarImage src={p.photoURL || undefined}/><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar>
                                {p.name}
                            </Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
