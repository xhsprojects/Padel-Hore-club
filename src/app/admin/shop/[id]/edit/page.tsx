'use client';

import { useParams, useRouter } from 'next/navigation';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm } from '@/components/admin/product-form';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product, WithId } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EditProductPage() {
    const params = useParams();
    const id = params.id as string;
    const { firestore } = useFirebase();

    const productRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'products', id);
    }, [firestore, id]);

    const { data: product, isLoading } = useDoc<WithId<Product>>(productRef);

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto">
                     <Button asChild variant="outline" className="mb-4">
                        <Link href="/admin/shop">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Shop Management
                        </Link>
                    </Button>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">Edit Product</CardTitle>
                            <CardDescription>Update the details for "{product?.name || 'product'}".</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : product ? (
                                <ProductForm productToEdit={product} />
                            ) : (
                                <p>Product not found.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SidebarInset>
    );
}
