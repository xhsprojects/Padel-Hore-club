'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import type { Season, WithId } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Terminal } from 'lucide-react';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid format, use YYYY-MM-DD");

const EditSeasonFormSchema = z.object({
  name: z.string().min(3, 'Season name must be at least 3 characters'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

type FormValues = z.infer<typeof EditSeasonFormSchema>;

interface EditSeasonFormProps {
    season: WithId<Season>;
    setOpen: (open: boolean) => void;
}

export function EditSeasonForm({ season, setOpen }: EditSeasonFormProps) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const form = useForm<FormValues>({
        resolver: zodResolver(EditSeasonFormSchema),
        defaultValues: {
            name: season.name,
            startDate: format(season.startDate.toDate(), 'yyyy-MM-dd'),
            endDate: format(season.endDate.toDate(), 'yyyy-MM-dd'),
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

    const handleUpdateSeason = async (data: FormValues) => {
        setIsPending(true);
        setError(null);
        if (!firestore) {
            setError('Firestore is not initialized');
            setIsPending(false);
            return;
        }

        const seasonRef = doc(firestore, 'seasons', season.id);

        try {
            const updates: Partial<Season> = {
                name: data.name,
                startDate: Timestamp.fromDate(new Date(data.startDate)),
                endDate: Timestamp.fromDate(new Date(data.endDate)),
            };
            
            await updateDoc(seasonRef, updates as any);
            
            toast({
                title: "Season Updated",
                description: `"${data.name}" has been successfully updated.`,
            });
            setOpen(false);
        } catch (err) {
            console.error("Error updating season: ", err);
            let message = "An unknown error occurred.";
            if (err instanceof FirebaseError) {
                message = err.message;
            } else if (err instanceof Error) {
                message = err.message;
            }
            setError(message);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateSeason)} className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Season Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Season 1: Genesis" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Start Date</FormLabel>
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
                    name="endDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>End Date</FormLabel>
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

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
