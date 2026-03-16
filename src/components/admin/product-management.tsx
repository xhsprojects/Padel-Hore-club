'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import type { Product, WithId } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit, ImageIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';

export function ProductManagement() {
  const { firestore, storage } = useFirebase();
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<WithId<Product> | null>(null);

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading } = useCollection<WithId<Product>>(productsQuery);
  const { toast } = useToast();

  const handleDelete = (product: WithId<Product>) => {
    setSelectedProduct(product);
    setDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;
    try {
        await deleteDoc(doc(firestore, 'products', selectedProduct.id));
        
        if (selectedProduct.imageUrls) {
            for (const url of selectedProduct.imageUrls) {
                try {
                const imageRef = ref(storage, url);
                await deleteObject(imageRef);
                } catch (error: any) {
                    if (error.code !== 'storage/object-not-found') {
                        console.warn(`Could not delete image from storage: ${url}`, error);
                    }
                }
            }
        }
        
        toast({ title: 'Product Deleted' });
    } catch (e) {
        console.error("Error deleting product", e);
        toast({ variant: 'destructive', title: 'Error', description: "Failed to delete product." });
    } finally {
        setDeleteAlertOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild>
            <Link href="/admin/shop/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Product
            </Link>
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
                <>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-md" />
                                    <Skeleton className="h-5 w-40" />
                                </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </>
            ) : products && products.length > 0 ? (
              products.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium flex items-center gap-4">
                    {product.imageUrls && product.imageUrls[0] ? <Image src={product.imageUrls[0]} alt={product.name} width={40} height={40} className="rounded-md object-cover" /> : <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground"/></div>}
                    {product.name}
                  </TableCell>
                  <TableCell>Rp {product.price.toLocaleString('id-ID')}</TableCell>
                  <TableCell><Badge variant={product.status === 'ready-stock' ? 'default' : product.status === 'out-of-stock' ? 'destructive' : 'secondary'}>{product.status.replace('-', ' ')}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/admin/shop/${product.id}/edit`}>
                            <Edit className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(product)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            ) : <TableRow><TableCell colSpan={4} className="text-center h-24">No products found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the product "{selectedProduct?.name}" and all its images. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
