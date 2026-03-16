'use client';

import { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import type { Product, ProductStatus, WithId } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, X, UploadCloud } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';

const productStatuses: [ProductStatus, ...ProductStatus[]] = ['ready-stock', 'pre-order', 'out-of-stock'];

const VariationSchema = z.object({
  name: z.string().min(1, "Variation name is required"),
  options: z.string().min(1, "Options are required (comma-separated)"),
});

const ProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
  status: z.enum(productStatuses),
  poEstimate: z.string().optional(),
  variations: z.array(VariationSchema).optional(),
});

type ProductFormValues = z.infer<typeof ProductSchema>;

interface ProductFormProps {
    productToEdit?: WithId<Product>;
}

export function ProductForm({ productToEdit }: ProductFormProps) {
  const { firestore, storage } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<(string | { file: File, url: string })[]>(productToEdit?.imageUrls || []);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      name: productToEdit?.name || '',
      description: productToEdit?.description || '',
      price: productToEdit?.price || 0,
      status: productToEdit?.status || 'ready-stock',
      poEstimate: productToEdit?.poEstimate || '',
      variations: productToEdit?.variations?.map(v => ({ ...v, options: v.options.join(', ') })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "variations",
  });

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(file => ({ file, url: URL.createObjectURL(file) }));

    setImageFiles(prev => [...prev, ...newFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
    
    // Clear the file input value to allow re-selecting the same file(s)
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveImage = (image: string | { file: File, url: string }, index: number) => {
    if (typeof image === 'string') {
      setImagesToDelete(prev => [...prev, image]);
    } else {
      setImageFiles(prev => prev.filter(f => f !== image.file));
    }
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };


  const onSubmit = async (data: ProductFormValues) => {
    if (!firestore || !storage) return;
    setIsSubmitting(true);
    try {
      let finalImageUrls = productToEdit?.imageUrls?.filter(url => !imagesToDelete.includes(url)) || [];
      
      for (const urlToDelete of imagesToDelete) {
        try {
          const imageRef = ref(storage, urlToDelete);
          await deleteObject(imageRef);
        } catch (error: any) {
          if (error.code !== 'storage/object-not-found') {
            console.warn(`Failed to delete old image ${urlToDelete}:`, error);
          }
        }
      }

      const uploadPromises = imageFiles.map(file => {
        const fileId = uuidv4();
        const docId = productToEdit?.id || doc(collection(firestore, 'products')).id;
        const newStorageRef = ref(storage, `products/${docId}/${fileId}`);
        return uploadBytesResumable(newStorageRef, file).then(uploadTask => getDownloadURL(uploadTask.ref));
      });

      const newImageUrls: string[] = await Promise.all(uploadPromises);
      finalImageUrls = [...finalImageUrls, ...newImageUrls];

      const productData: Product = {
        ...data,
        imageUrls: finalImageUrls,
        variations: data.variations?.map(v => ({ ...v, options: v.options.split(',').map(opt => opt.trim()).filter(Boolean) })),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData as any);
        toast({ title: 'Success', description: 'Product updated successfully.' });
      } else {
        await addDoc(collection(firestore, 'products'), productData);
        toast({ title: 'Success', description: 'Product created successfully.' });
      }

      router.push('/admin/shop');
      router.refresh(); // To ensure the list is updated

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save product.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Padel Hore Club Jersey" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormItem>
            <FormLabel>Product Images</FormLabel>
            <FormDescription>Upload one or more images. The first image will be the main display.</FormDescription>
            <FormControl>
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </>
            </FormControl>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {imagePreviews.map((img, index) => (
                <div key={index} className="relative aspect-square w-full">
                <Image src={typeof img === 'string' ? img : img.url} alt="Preview" fill className="rounded-md object-cover" />
                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveImage(img, index)}>
                    <X className="h-4 w-4"/>
                </Button>
                </div>
            ))}
            </div>
        </FormItem>
        <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the product..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>
        )}/>
        <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="price" render={({ field }) => (
            <FormItem><FormLabel>Price (IDR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                <SelectContent>
                    <SelectItem value="ready-stock">Ready Stock</SelectItem>
                    <SelectItem value="pre-order">Pre-Order (PO)</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
                </Select><FormMessage /></FormItem>
            )}/>
        </div>
        {form.watch('status') === 'pre-order' && (
            <FormField control={form.control} name="poEstimate" render={({ field }) => (
            <FormItem><FormLabel>Pre-Order Estimate</FormLabel><FormControl><Input placeholder="e.g., 2-3 weeks" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
        )}
        
        <div className="space-y-4 rounded-md border p-4">
            <h4 className="font-medium">Product Variations</h4>
            {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 p-2 border rounded-md">
                    <div className="grid grid-cols-2 gap-2 flex-grow">
                            <FormField
                            control={form.control}
                            name={`variations.${index}.name`}
                            render={({ field }) => (
                            <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Size" {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                            <FormField
                            control={form.control}
                            name={`variations.${index}.options`}
                            render={({ field }) => (
                            <FormItem><FormLabel>Options</FormLabel><FormControl><Input placeholder="e.g. S, M, L" {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                        />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ))}
                <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: "", options: "" })}
                >
                Add Variation
            </Button>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full mt-6">
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : productToEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </form>
    </Form>
  );
}
