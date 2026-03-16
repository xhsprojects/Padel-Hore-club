'use client';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Product, WithId, ProductStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, ShoppingCart, Clock, LogIn, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { OrderForm } from '@/components/shop/order-form';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';

const statusDetails: { [key in ProductStatus]: { label: string, className: string } } = {
    'ready-stock': { label: 'Ready Stock', className: 'bg-green-500 text-white' },
    'pre-order': { label: 'Pre-Order', className: 'bg-blue-500 text-white' },
    'out-of-stock': { label: 'Out of Stock', className: 'bg-muted text-muted-foreground border-border' },
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();

    const productRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'products', id);
    }, [firestore, id]);
    const { data: product, isLoading } = useDoc<WithId<Product>>(productRef);

    if (isLoading || isUserLoading) {
        return (
            <div className="p-2 sm:p-6 lg:p-8">
                 <div className="max-w-4xl mx-auto">
                    <Skeleton className="h-10 w-48 mb-4" />
                    <Card className="overflow-hidden">
                        <div className="grid md:grid-cols-2">
                            <Skeleton className="h-full aspect-square w-full" />
                            <div className="flex flex-col">
                                <CardHeader>
                                    <Skeleton className="h-6 w-28" />
                                    <Skeleton className="h-9 w-3/4 pt-2" />
                                    <Skeleton className="h-8 w-1/2 pt-1" />
                                </CardHeader>
                                <CardContent className="flex-grow space-y-6">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-20 w-full" />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Skeleton className="h-12 w-full" />
                                </CardFooter>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }
    
    if (!product) {
        notFound();
    }
    
    const details = statusDetails[product.status];

    const renderOrderButton = () => {
        if (product.status === 'out-of-stock') {
            return <Button className="w-full" disabled>Out of Stock</Button>;
        }

        if (!user) {
            return (
                <Button className="w-full" onClick={() => router.push('/login')}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Login to Order
                </Button>
            );
        }

        return (
            <Sheet>
                <SheetTrigger asChild>
                    <Button className="w-full">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Order Now
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto max-h-[95dvh] flex flex-col p-0">
                    <SheetHeader className="p-6 pb-4 border-b text-left">
                        <SheetTitle>Confirm Your Order</SheetTitle>
                        <SheetDescription>
                            Review your order details and confirm to proceed.
                        </SheetDescription>
                    </SheetHeader>
                    <OrderForm product={product} />
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div className="p-2 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <Button variant="outline" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Shop
                </Button>
                <Card className="overflow-hidden">
                    <div className="grid md:grid-cols-2">
                         <div className="bg-muted p-4">
                            {product.imageUrls && product.imageUrls.length > 0 ? (
                                <Carousel className="w-full">
                                    <CarouselContent>
                                        {product.imageUrls.map((url, index) => (
                                            <CarouselItem key={index}>
                                                <div className="relative aspect-square">
                                                    <Image src={url} alt={`${product.name} image ${index + 1}`} fill className="object-contain rounded-md" />
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious />
                                    <CarouselNext />
                                </Carousel>
                            ) : (
                                <div className="flex h-full aspect-square w-full items-center justify-center bg-muted rounded-md">
                                    <Package className="h-32 w-32 text-muted-foreground/30" />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <CardHeader>
                                <Badge className={cn("w-fit", details.className)}>{details.label}</Badge>
                                <CardTitle className="font-headline text-3xl pt-2">{product.name}</CardTitle>
                                <CardDescription className="font-bold text-2xl text-primary pt-1">
                                    Rp {product.price.toLocaleString('id-ID')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-6">
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Deskripsi</h4>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                                </div>
                                 {product.status === 'pre-order' && product.poEstimate && (
                                    <div className="flex items-center gap-2 text-sm text-blue-400">
                                        <Clock className="h-4 w-4" />
                                        <span>Estimasi Pre-Order: {product.poEstimate}</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                {renderOrderButton()}
                            </CardFooter>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
