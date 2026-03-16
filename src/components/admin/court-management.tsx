'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import type { Court, WithId } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Loader2 } from 'lucide-react';
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

const CourtSchema = z.object({
  name: z.string().min(3, 'Court name must be at least 3 characters'),
  location: z.string().min(3, 'Location must be at least 3 characters'),
});

type CourtFormValues = z.infer<typeof CourtSchema>;

export function CourtManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [courtToDelete, setCourtToDelete] = useState<WithId<Court> | null>(null);

  const form = useForm<CourtFormValues>({
    resolver: zodResolver(CourtSchema),
    defaultValues: { name: '', location: '' },
  });

  const courtsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'courts');
  }, [firestore]);
  const { data: courts, isLoading } = useCollection<Court>(courtsQuery);

  const onSubmit = async (data: CourtFormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'courts'), data);
      toast({ title: 'Success', description: 'Court added successfully.' });
      form.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add court.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (court: WithId<Court>) => {
    setCourtToDelete(court);
    setIsAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!firestore || !courtToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'courts', courtToDelete.id));
      toast({ title: 'Success', description: 'Court deleted successfully.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete court.' });
    } finally {
      setIsDeleting(false);
      setIsAlertOpen(false);
      setCourtToDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add Court Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-end gap-4 border p-4 rounded-lg">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="flex-1 w-full">
                <FormLabel>Court Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Lapangan 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem className="flex-1 w-full">
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Padel Hore Jakarta" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto mt-4 sm:mt-0">
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Court
          </Button>
        </form>
      </Form>

      {/* Courts Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Court Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  Loading courts...
                </TableCell>
              </TableRow>
            ) : courts && courts.length > 0 ? (
              courts.map(court => (
                <TableRow key={court.id}>
                  <TableCell className="font-medium">{court.name}</TableCell>
                  <TableCell>{court.location}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(court)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No courts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the court
              <span className="font-bold"> {courtToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
