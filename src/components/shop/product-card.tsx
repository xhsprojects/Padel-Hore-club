'use client';

import type { Product, WithId, ProductStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
    product: WithId<Product>;
}

const statusDetails: { [key in ProductStatus]: { label: string, className: string } } = {
    'ready-stock': { label: 'Ready Stock', className: 'bg-green-500 text-white' },
    'pre-order': { label: 'Pre-Order', className: 'bg-blue-500 text-white' },
    'out-of-stock': { label: 'Out of Stock', className: 'bg-muted text-muted-foreground border-border' },
}

export function ProductCard({ product }: ProductCardProps) {
    const details = statusDetails[product.status];

    return (
        <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg">
            <Link href={`/shop/${product.id}`} className="block">
                <div className="relative h-40 w-full bg-muted">
                    {product.imageUrls && product.imageUrls[0] ? (
                        <Image src={product.imageUrls[0]} alt={product.name} fill className="object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-24 w-24 text-muted-foreground/30" />
                        </div>
                    )}
                </div>
            </Link>
            {/* The CardHeader will be a flex-grow container to push footer down */}
            <CardHeader className="p-3 flex-grow flex flex-col">
                <div className="flex justify-between items-start">
                    <Badge className={cn("text-[10px] px-1.5 py-0.5", details.className)}>{details.label}</Badge>
                </div>
                {/* Title with fixed height to allow wrapping and prevent layout shifts */}
                <CardTitle className="pt-2 text-sm font-bold min-h-[2.5rem]">
                    {product.name}
                </CardTitle>
                {/* Price pushed to the bottom of the header */}
                <CardDescription className="!mt-auto pt-1 font-bold text-base text-primary">
                    Rp {product.price.toLocaleString('id-ID')}
                </CardDescription>
            </CardHeader>
            <CardFooter className="p-3 pt-0">
                 <Button asChild className="w-full" size="sm">
                    <Link href={`/shop/${product.id}`}>
                        <ShoppingCart className="mr-2 h-4" />
                        Details
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
