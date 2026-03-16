'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Event, EventType, Court, WithId, UserProfile } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { format } from 'date-fns';
import { sendPushNotification } from '@/actions/send-push-notification';
import { useRouter } from 'next/navigation';

const eventTypes: [EventType, ...EventType[]] = ['Regular Match', 'Versus', 'Competition', 'coaching-clinic', 'social-gathering'];

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format.",
});

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "Time must be in HH:MM format.",
});

const EventSchema = z.object({
  name: z.string().min(5, 'Event name must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  type: z.enum(eventTypes, { required_error: "Please select an event type." }),
  courtId: z.string().min(1, "Please select a court."),
  startDate: dateStringSchema,
  startTime: timeStringSchema,
  endDate: dateStringSchema,
  endTime: timeStringSchema,
  maxParticipants: z.coerce.number().min(1, 'There must be at least one participant.'),
  attendancePoints: z.coerce.number().optional(),
  pointMultiplier: z.coerce.number().optional(),
});

type EventFormValues = z.infer<typeof EventSchema>;

function CreateEventForm() {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const router = useRouter();

  const courtsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'courts'));
  }, [firestore]);
  const { data: courts, isLoading: courtsLoading } = useCollection<WithId<Court>>(courtsQuery);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(EventSchema),
    defaultValues: {
        name: '',
        description: '',
        type: undefined,
        courtId: '',
        startDate: '',
        startTime: '09:00',
        endDate: '',
        endTime: '17:00',
        maxParticipants: 16,
        attendancePoints: 0,
        pointMultiplier: 1,
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
  
  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          variant: "destructive",
          title: "File is too large",
          description: "Please select an image smaller than 5MB.",
        });
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: EventFormValues) => {
    if (!firestore || !storage) return;
    setIsSubmitting(true);
    try {
        const batch = writeBatch(firestore);
        const newEventRef = doc(collection(firestore, 'events'));

        let bannerUrl: string | undefined = undefined;
        if (bannerFile) {
            const fileId = uuidv4();
            const storageRef = ref(storage, `events/${newEventRef.id}/banner_${fileId}`);
            const uploadTask = await uploadBytesResumable(storageRef, bannerFile);
            bannerUrl = await getDownloadURL(uploadTask.ref);
        }

        const startDate = new Date(`${data.startDate}T${data.startTime}`);
        const endDate = new Date(`${data.endDate}T${data.endTime}`);

        const newEventData: Omit<Event, 'id'> = {
            name: data.name,
            description: data.description,
            type: data.type,
            courtId: data.courtId,
            status: 'upcoming',
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            maxParticipants: data.maxParticipants,
            participantIds: [],
            waitlistIds: [],
            attendancePoints: data.attendancePoints || 0,
            pointMultiplier: data.pointMultiplier || 1,
            bannerUrl: bannerUrl,
        };
        
        batch.set(newEventRef, newEventData);
        
        const usersQuery = query(collection(firestore, 'users'), where('role', '!=', 'admin'));
        const usersSnapshot = await getDocs(usersQuery);
        const userFcmTokens: string[] = [];

        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data() as UserProfile;
            const notifRef = doc(collection(firestore, 'users', userDoc.id, 'notifications'));
            batch.set(notifRef, {
                uid: userDoc.id,
                title: 'Acara Baru Telah Dibuat!',
                body: `Yuk, daftar di acara "${data.name}" yang akan diselenggarakan pada ${format(startDate, 'dd MMM yyyy')}.`,
                timestamp: Timestamp.now(),
                isRead: false,
                link: `/events/${newEventRef.id}`,
                icon: 'CalendarPlus'
            });
            if (user.fcmTokens) {
                userFcmTokens.push(...user.fcmTokens);
            }
        });


      await batch.commit();
      
      if (userFcmTokens.length > 0) {
        await sendPushNotification(userFcmTokens, {
            title: 'Acara Baru Telah Dibuat!',
            body: `Yuk, daftar di acara "${data.name}" yang akan diselenggarakan pada ${format(startDate, 'dd MMM yyyy')}.`,
            link: `/events/${newEventRef.id}`
        });
      }

      toast({ title: 'Success', description: 'Event created and notifications sent.' });
      form.reset();
      router.push('/admin/events');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create event.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Padel Hore Anniversary Tournament" {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
          <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe the event details..." {...field} /></FormControl>
                  <FormMessage />
              </FormItem>
              )}
          />
           <FormItem>
              <FormLabel>Banner Image (Optional)</FormLabel>
              <FormDescription>Recommended aspect ratio 16:9. Max 5MB.</FormDescription>
              <FormControl>
                <Input type="file" accept="image/*" onChange={handleBannerFileChange} />
              </FormControl>
              <FormMessage />
            </FormItem>

            {bannerPreview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-md border">
                    <Image src={bannerPreview} alt="Banner preview" fill className="object-cover" />
                </div>
            )}

           <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                  <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select an event type" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="Regular Match">Regular Match</SelectItem>
                              <SelectItem value="Versus">Versus</SelectItem>
                              <SelectItem value="Competition">Competition</SelectItem>
                              <SelectItem value="coaching-clinic">Coaching Clinic</SelectItem>
                              <SelectItem value="social-gathering">Social Gathering</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                  </FormItem>
              )}
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  name="startTime"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
          </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                  control={form.control}
                  name="maxParticipants"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Max Participants</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
               <FormField
                  control={form.control}
                  name="attendancePoints"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Attendance Points</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                       <FormDescription>Bonus points for just attending.</FormDescription>
                      <FormMessage />
                  </FormItem>
                  )}
              />
          </div>
           <FormField
                  control={form.control}
                  name="pointMultiplier"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Point Multiplier</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormDescription>Points for matches in this event will be multiplied by this value (e.g., 1.5 for 1.5x).</FormDescription>
                      <FormMessage />
                  </FormItem>
                  )}
              />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Create Event
        </Button>
      </form>
    </Form>
  )
}

export default function NewEventPage() {
    return (
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                     <Button asChild variant="outline" className="mb-4">
                        <Link href="/admin/events">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Event List
                        </Link>
                    </Button>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">Create New Event</CardTitle>
                            <CardDescription>
                                Fill in the details for the new event.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CreateEventForm />
                        </CardContent>
                    </Card>
                </div>
            </div>
    );
}
