'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { UserProfile, Season, WithId } from '@/lib/types';
import { doc, deleteDoc } from 'firebase/firestore';
import { SeasonManagement } from '@/components/admin/season-management';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EditSeasonForm } from '@/components/admin/edit-season-form';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function ManageSeasonsPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [seasonToEdit, setSeasonToEdit] = useState<WithId<Season> | null>(null);
    const [seasonToDelete, setSeasonToDelete] = useState<WithId<Season> | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');


    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    const handleEditClick = (season: WithId<Season>) => {
        setSeasonToEdit(season);
        setIsEditDialogOpen(true);
    };

    const handleDeleteClick = (season: WithId<Season>) => {
        setSeasonToDelete(season);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!firestore || !seasonToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'seasons', seasonToDelete.id));
            toast({ title: 'Success', description: 'Season deleted successfully.' });
        } catch (error) {
            console.error("Error deleting season:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the season.' });
        } finally {
            setIsDeleteDialogOpen(false);
            setSeasonToDelete(null);
            setDeleteConfirmation('');
        }
    };

    if (isUserLoading || isProfileLoading || !user) {
        return (
                 <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-8 w-56" />
                            <Skeleton className="h-4 w-80" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-64 w-full" />
                        </CardContent>
                    </Card>
                </div>
        )
    }

    const isDefaultAdmin = user.uid === DEFAULT_ADMIN_UID;
    if (userProfile?.role !== 'admin' && !isDefaultAdmin) {
        return (
                <div className="p-2 sm:p-6 lg:p-8 text-center">
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle>Access Denied</CardTitle>
                            <CardDescription>You do not have the required permissions to view this page.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/')}>Go to Leaderboard</Button>
                        </CardContent>
                    </Card>
                </div>
        );
    }

    return (
        <>
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Season Management</CardTitle>
                        <CardDescription>Create, edit, activate, and delete competitive seasons.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SeasonManagement onEdit={handleEditClick} onDelete={handleDeleteClick} />
                    </CardContent>
                </Card>
            </div>
            
            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    {seasonToEdit && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Edit Season</DialogTitle>
                                <DialogDescription>Modify the details for {seasonToEdit.name}.</DialogDescription>
                            </DialogHeader>
                            <EditSeasonForm season={seasonToEdit} setOpen={setIsEditDialogOpen} />
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setDeleteConfirmation('');
                }
                setIsDeleteDialogOpen(open);
             }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the season
                            '<span className="font-bold">{seasonToDelete?.name}</span>'. This will only remove the season from archives, it will not revert any player stats.
                            <br/><br/>
                            Please type <strong className="text-destructive">DELETE</strong> to confirm.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input 
                        id="delete-confirm"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="bg-background"
                        placeholder="DELETE"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteConfirmation.toUpperCase() !== 'DELETE'}
                            className="bg-destructive hover:bg-destructive/90 disabled:cursor-not-allowed"
                        >
                            Delete Season
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
