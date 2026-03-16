'use client';

import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Product, WithId } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/shop/product-card';
import { Skeleton } from '@/components/ui/skeleton';

function ProductCardSkeleton() {
    return (
        <Card className="flex flex-col overflow-hidden">
            <Skeleton className="h-56 w-full" />
            <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-3/4 pt-2" />
                <Skeleton className="h-7 w-1/2 pt-1" />
            </CardHeader>
            <CardFooter className="mt-auto">
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
}

export function ShopClient() {
    const { firestore } = useFirebase();

    const productsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'products'));
    }, [firestore]);

    const { data: products, isLoading } = useCollection<WithId<Product>>(productsQuery);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
            </div>
        );
    }

    if (!products || products.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    There are no products available at the moment.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
    );
}
