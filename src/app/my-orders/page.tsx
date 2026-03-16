'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Order, WithId } from '@/lib/types';
import { Loader2, Package, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

const statusStyles: { [key: string]: string } = {
  'pending-payment': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'processing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'shipped': 'bg-green-500/20 text-green-400 border-green-500/30',
  'completed': 'bg-green-500/20 text-green-400 border-green-500/30',
  'cancelled': 'bg-destructive/20 text-destructive border-destructive/30',
}

export default function MyOrdersPage() {
    const { firestore, user, isUserLoading } = useFirebase();
    const router = useRouter();

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'orders'),
            where('userId', '==', user.uid)
            // No orderBy here to avoid needing a composite index
        );
    }, [firestore, user]);

    const { data, isLoading } = useCollection<WithId<Order>>(ordersQuery);
    
    const orders = useMemo(() => {
        if (!data) return null;
        // Sort on the client-side
        return [...data].sort((a, b) => b.orderTimestamp.toMillis() - a.orderTimestamp.toMillis());
    }, [data]);
    
    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [isUserLoading, user, router]);

    if (isLoading || isUserLoading) {
        return (
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                     <CardHeader>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-28 w-full" />
                        <Skeleton className="h-28 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!user) {
        return null;
    }

    return (
        <div className="p-2 sm:p-6 lg:p-8">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                       <Receipt className="h-6 w-6" />
                       My Orders
                    </CardTitle>
                    <CardDescription>
                        Here is a list of your past and current orders.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {orders && orders.length > 0 ? (
                        <div className="space-y-4">
                            {orders.map(order => (
                                <Card key={order.id} className="p-4 flex flex-col sm:flex-row items-start gap-4">
                                    <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                        {order.productImage ? (
                                            <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                                        ) : (
                                            <Package className="w-full h-full text-muted-foreground/30 p-4"/>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold">{order.productName}</h3>
                                            <Badge className={statusStyles[order.status]}>{order.status.replace('-', ' ')}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">Order ID: {order.id}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(order.orderTimestamp.toDate(), 'dd MMMM yyyy, p')}
                                        </p>
                                        
                                        <div className="mt-2 text-sm space-y-1">
                                            {Object.entries(order.selectedVariation).map(([key, value]) => (
                                                <p key={key}>
                                                    <span className="font-semibold">{key}:</span> {value}
                                                </p>
                                            ))}
                                            <p><span className="font-semibold">Quantity:</span> {order.quantity}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 sm:pl-4">
                                        <p className="font-black text-primary text-lg">
                                            Rp {order.totalPrice.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>You haven't placed any orders yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
