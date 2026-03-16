'use client';

import React, { useState, useRef } from 'react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useUser, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Terminal, UploadCloud, User as UserIcon, Loader2, Eye, EyeOff } from 'lucide-react';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ProfileFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters long').optional(),
  whatsapp: z.string().min(10, 'WhatsApp number must be at least 10 characters').optional(),
  showWhatsapp: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
}).refine(data => {
    if (data.newPassword && !data.currentPassword) {
        return false;
    }
    return true;
}, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
}).refine(data => {
    if (data.newPassword && data.newPassword.length < 6) {
        return false;
    }
    return true;
}, {
    message: "New password must be at least 6 characters long",
    path: ["newPassword"],
});

type FormValues = z.infer<typeof ProfileFormSchema>;


async function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}


export function ProfileForm() {
  const [isPending, setIsPending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { firestore, auth } = useFirebase();
  const storage = useStorage();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const form = useForm<FormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      name: '',
      whatsapp: '',
      showWhatsapp: true,
      currentPassword: '',
      newPassword: '',
    },
  });
  
  React.useEffect(() => {
    if (userProfile) {
        form.reset({
            name: userProfile.name,
            whatsapp: userProfile.whatsapp,
            showWhatsapp: userProfile.showWhatsapp ?? true,
            currentPassword: '',
            newPassword: '',
        });
    }
  }, [userProfile, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
        });
        return;
      }
      setCrop(undefined); // Reset crop when new image is selected
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || '')
      );
      reader.readAsDataURL(file);
      setIsCropModalOpen(true);
      // Clear the input value to allow selecting the same file again
      event.target.value = '';
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1, // Aspect ratio 1:1
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }

  const handleUploadCroppedImage = async () => {
    if (!completedCrop || !imgRef.current) {
      toast({ variant: 'destructive', title: 'Crop Error', description: 'Could not process the cropped image.' });
      return;
    }
    
    const croppedBlob = await getCroppedBlob(imgRef.current, completedCrop);
    if (!croppedBlob) {
      toast({ variant: 'destructive', title: 'Crop Error', description: 'Failed to create cropped image.' });
      return;
    }

    if (!user || !storage || !userProfileRef) return;
    
    setIsUploading(true);
    setIsCropModalOpen(false); // Close modal on upload start

    const storageRef = ref(storage, `avatars/${user.uid}`);
    const uploadTask = uploadBytesResumable(storageRef, croppedBlob);

    uploadTask.on('state_changed',
        (snapshot) => {
            // Optional: handle progress updates
        },
        (error) => {
            console.error("Avatar upload error:", error);
            toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload your avatar." });
            setIsUploading(false);
        },
        async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await updateProfile(user, { photoURL: downloadURL });
                await updateDoc(userProfileRef, { photoURL: downloadURL });
                toast({ title: "Avatar Updated", description: "Your new avatar has been saved." });
            } catch (err) {
                 console.error("Error updating profile with new avatar:", err);
                 toast({ variant: "destructive", title: "Update Failed", description: "Could not save your new avatar." });
            } finally {
                setIsUploading(false);
            }
        }
    );
  };

  const onSubmit = async (data: FormValues) => {
      setIsPending(true);
      setError(null);
      
      if (!user || !auth || !firestore || !userProfile) {
          setError("User not authenticated or Firebase not available.");
          setIsPending(false);
          return;
      }

      try {
        const userDocRef = doc(firestore, 'users', user.uid);
        let changesMade = false;
        
        const updates: Partial<UserProfile> = {};

        // Update name if it has changed
        if (data.name && data.name !== userProfile.name) {
            updates.name = data.name;
            await updateProfile(user, { displayName: data.name });
            changesMade = true;
        }

        // Update whatsapp if it has changed
        if (data.whatsapp && data.whatsapp !== userProfile.whatsapp) {
            updates.whatsapp = data.whatsapp;
            changesMade = true;
        }
        
        // Update showWhatsapp if it has changed
        if (data.showWhatsapp !== (userProfile.showWhatsapp ?? true)) {
            updates.showWhatsapp = data.showWhatsapp;
            changesMade = true;
        }


        if (Object.keys(updates).length > 0) {
            await updateDoc(userDocRef, updates);
        }


        // Update password if new password is provided
        if (data.newPassword && data.currentPassword) {
            if (!user.email) {
                throw new Error("Cannot update password for accounts without an email.");
            }
            const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, data.newPassword);
            changesMade = true;
        }

        if (changesMade) {
             toast({ title: "Success", description: "Your profile has been updated." });
        } else {
             toast({ title: "No Changes", description: "You didn't make any changes." });
        }

        form.reset({
            ...form.getValues(),
            currentPassword: '',
            newPassword: '',
        });

      } catch (err) {
          console.error(err);
          let message = 'An unexpected error occurred.';
          if (err instanceof FirebaseError) {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                message = 'The current password you entered is incorrect.';
            } else {
                message = err.message;
            }
          } else if (err instanceof Error) {
              message = err.message;
          }
          setError(message);
          toast({ variant: "destructive", title: 'Update Failed', description: message });
      } finally {
          setIsPending(false);
      }
  };
  
  if (isProfileLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-end gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4 rounded-lg border p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!userProfile || !user) {
    return <p>Could not load user profile.</p>;
  }

  return (
    <>
       <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crop your new avatar</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '70vh' }}
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCropModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUploadCroppedImage} disabled={!completedCrop || isUploading}>
              {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Avatar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-8 flex flex-col gap-4">
          <div className="relative w-24 h-24">
              <Avatar className="h-24 w-24 border-2 border-primary/50">
                  <AvatarImage src={user.photoURL || ''} />
                  <AvatarFallback className="text-3xl bg-muted">
                    <UserIcon className="w-10 h-10 text-muted-foreground" />
                  </AvatarFallback>
              </Avatar>
              <Button 
                size="icon" 
                className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              </Button>
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/png, image/jpeg, image/gif"
          />
      </div>
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g. John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />

               <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>WhatsApp Number</FormLabel>
                          <FormControl>
                              <Input placeholder="e.g. 08123456789" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />

                <FormField
                    control={form.control}
                    name="showWhatsapp"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Show WhatsApp Number
                                </FormLabel>
                                <FormDescription>
                                    Allow other members to see your WhatsApp number on your profile.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

              <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="font-medium">Change Password</h3>
                   <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Current Password</FormLabel>
                               <div className="relative">
                                  <FormControl>
                                      <Input type={showCurrentPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                  </FormControl>
                                  <button
                                      type="button"
                                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                      className="absolute inset-y-0 right-0 flex items-center justify-center h-full w-10 text-muted-foreground"
                                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                                  >
                                      {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                  </button>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                   <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>New Password</FormLabel>
                               <div className="relative">
                                  <FormControl>
                                      <Input type={showNewPassword ? 'text' : 'password'} {...field} className="pr-10"/>
                                  </FormControl>
                                  <button
                                      type="button"
                                      onClick={() => setShowNewPassword(!showNewPassword)}
                                      className="absolute inset-y-0 right-0 flex items-center justify-center h-full w-10 text-muted-foreground"
                                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                  >
                                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                  </button>
                              </div>
                              <FormDescription>Must be at least 6 characters long.</FormDescription>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>
              
              <Button type="submit" disabled={isPending || form.formState.isSubmitting} className="w-full">
                  {isPending ? "Saving Changes..." : "Save Changes"}
              </Button>
          </form>
      </Form>
    </>
  );
}
