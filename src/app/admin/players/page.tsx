'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserManagementTable } from '@/components/admin/player-form';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { useUser, useDoc, useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Loader2, UserPlus, Edit, Trash2 } from 'lucide-react';
import type { UserProfile, WithId } from '@/lib/types';
import { doc, collection, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { EditUserForm } from '@/components/admin/edit-user-form';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export default function ManageUsersPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();

    // State for all dialogs on this page
    const [isCreateUserOpen, setCreateUserOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<WithId<UserProfile> | null>(null);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
    
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    // Handlers for edit/delete actions, passed down to the table
    const handleEditClick = (user: WithId<UserProfile>) => {
        setSelectedUser(user);
        setIsEditDialogOpen(true);
    };

    const handleDeleteClick = (user: WithId<UserProfile>) => {
        setSelectedUser(user);
        setIsDeleteDialogOpen(true);
    };

    // Dialog open/close change handlers
    const handleEditOpenChange = (isOpen: boolean) => {
        setIsEditDialogOpen(isOpen);
        if (!isOpen) {
            setSelectedUser(null);
        }
    };

    const handleDeleteOpenChange = (isOpen: boolean) => {
        setIsDeleteDialogOpen(isOpen);
        if (!isOpen) {
            setSelectedUser(null);
        }
    };

    const confirmDelete = async () => {
        if (!firestore || !selectedUser) return;
        const userRef = doc(firestore, 'users', selectedUser.id);
        try {
            await deleteDoc(userRef);
            toast({
                title: "User Deleted",
                description: `${selectedUser.name}'s profile data has been deleted.`,
            });
        } catch (error) {
            console.error("Error deleting user: ", error);
            let message = "Failed to delete user profile.";
            if (error instanceof FirebaseError) {
                message = error.message;
            }
            toast({
                variant: "destructive",
                title: "Error",
                description: message,
            });
        }
        setIsDeleteDialogOpen(false);
    };


    if (isUserLoading || isProfileLoading || !user) {
        return (
                 <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-40 w-full" />
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
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">User Management</CardTitle>
                            <CardDescription>View, create, edit, and delete users.</CardDescription>
                        </div>
                         <Dialog open={isCreateUserOpen} onOpenChange={setCreateUserOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create User
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Create New User</DialogTitle>
                                    <DialogDescription>
                                        Enter the details for the new user. They will be able to log in with this email and password.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="pt-4">
                                  <CreateUserForm setOpen={setCreateUserOpen} />
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <UserManagementTable 
                            users={users || []}
                            isLoading={usersLoading}
                            onEditUser={handleEditClick}
                            onDeleteUser={handleDeleteClick}
                        />
                    </CardContent>
                </Card>
            </div>

             {/* Dialogs are now here at the page level */}
            <Dialog open={isEditDialogOpen} onOpenChange={handleEditOpenChange}>
                <DialogContent 
                    className="sm:max-w-[425px]"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    {selectedUser && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Edit: {selectedUser.name}</DialogTitle>
                                <DialogDescription>
                                    Update the user's details. Click save when you're done.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="pt-4">
                                <EditUserForm user={selectedUser} setOpen={setIsEditDialogOpen} />
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={handleDeleteOpenChange}>
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user profile
                            for <span className="font-bold">{selectedUser?.name}</span>. The authentication record will remain.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
