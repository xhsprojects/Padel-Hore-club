
'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, setDoc, Timestamp, getDoc, deleteDoc } from 'firebase/firestore';
import type { Order, OrderStatus, WithId, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { sendPushNotification } from '@/actions/send-push-notification';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const statusStyles: { [key: string]: string } = {
  'pending-payment': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'processing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'shipped': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'completed': 'bg-green-500/20 text-green-400 border-green-500/30',
  'cancelled': 'bg-destructive/20 text-destructive border-destructive/30',
}

const statusOptions: OrderStatus[] = ['pending-payment', 'processing', 'shipped', 'completed', 'cancelled'];

export function OrderManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<WithId<Order> | null>(null);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), orderBy('orderTimestamp', 'desc'));
  }, [firestore]);

  const { data: orders, isLoading } = useCollection<WithId<Order>>(ordersQuery);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchTerm) return orders;
    return orders.filter(order =>
        order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.userName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);


  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (!firestore) return;
    setUpdatingStatus(orderId);
    try {
      const orderRef = doc(firestore, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
      
      const order = orders?.find(o => o.id === orderId);
      if (order) {
          const notifRef = doc(collection(firestore, 'users', order.userId, 'notifications'));
          const notifPayload = {
              uid: order.userId,
              title: `Pesanan Anda Diperbarui!`,
              body: `Status pesanan Anda untuk "${order.productName}" telah diubah menjadi: ${newStatus.replace('-', ' ')}.`,
              timestamp: Timestamp.now(),
              isRead: false,
              link: '/my-orders',
              icon: 'Package'
          };
          await setDoc(notifRef, notifPayload);
      }

      toast({ title: 'Status Updated', description: `Order ${orderId} is now ${newStatus}.` });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update order status.' });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteClick = (order: WithId<Order>) => {
    setOrderToDelete(order);
    setDeleteAlertOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!firestore || !orderToDelete) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'orders', orderToDelete.orderId));
        toast({ title: 'Order Deleted', description: 'The order has been permanently removed.' });
    } catch (e) {
        console.error('Error deleting order:', e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the order.' });
    } finally {
        setIsDeleting(false);
        setDeleteAlertOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
            placeholder="Search by Order ID or Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
        />
      </div>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                  {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
                  </TableRow>
                  ))}
              </>
            ) : filteredOrders && filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                  <TableCell>{order.userName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {order.productImage ? <Image src={order.productImage} alt={order.productName} width={24} height={24} className="rounded-sm" /> : <Package className="w-6 h-6 text-muted-foreground" />}
                      <span>{order.productName}</span>
                    </div>
                  </TableCell>
                  <TableCell>Rp {order.totalPrice.toLocaleString('id-ID')}</TableCell>
                  <TableCell>{format(order.orderTimestamp.toDate(), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                      {updatingStatus === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                          <Select onValueChange={(value) => handleStatusChange(order.id, value as OrderStatus)} defaultValue={order.status}>
                              <SelectTrigger className={cn("w-[150px] text-xs h-8", statusStyles[order.status])}>
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  {statusOptions.map(status => (
                                      <SelectItem key={status} value={status} className="capitalize">
                                          {status.replace('-', ' ')}
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(order)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the order for <span className="font-bold">{orderToDelete?.userName}</span> (ID: {orderToDelete?.orderId}). This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
