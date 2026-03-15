'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, Timestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import type { Product, WithId, Order, AppSettings, UserProfile } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Store, Truck, Minus, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

const OrderFormSchema = z.object({
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  shippingType: z.enum(['pickup', 'delivery'], { required_error: 'Please select a shipping method.' }),
  shippingAddress: z.string().optional(),
  variations: z.record(z.string().min(1, 'Please select an option')),
}).refine(data => {
    if (data.shippingType === 'delivery' && (!data.shippingAddress || data.shippingAddress.length < 10)) {
        return false;
    }
    return true;
}, {
    message: 'Shipping address must be at least 10 characters long for delivery.',
    path: ['shippingAddress'],
});

type OrderFormValues = z.infer<typeof OrderFormSchema>;

interface OrderFormProps {
    product: WithId<Product>;
}

export function OrderForm({ product }: OrderFormProps) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = (window as any).next.router;

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

    const form = useForm<OrderFormValues>({
        resolver: zodResolver(OrderFormSchema),
        defaultValues: {
            quantity: 1,
            shippingType: 'pickup',
            variations: product.variations?.reduce((acc, v) => ({ ...acc, [v.name]: '' }), {}) || {},
        },
    });

    const quantity = form.watch('quantity');
    const totalPrice = useMemo(() => product.price * (quantity || 0), [product.price, quantity]);

    const onSubmit = async (data: OrderFormValues) => {
        if (!firestore || !user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit order. User or DB not ready.' });
            return;
        }
        setIsSubmitting(true);

        try {
            // Fetch settings directly inside the handler for reliability
            const settingsDocRef = doc(firestore, 'settings', 'general');
            const settingsSnap = await getDoc(settingsDocRef);

            if (!settingsSnap.exists() || !settingsSnap.data()?.shopWhatsappNumber) {
                toast({ variant: 'destructive', title: 'Admin Contact Not Set', description: 'The shop contact number has not been configured by the admin.' });
                setIsSubmitting(false);
                return;
            }
            const shopWhatsappNumber = settingsSnap.data().shopWhatsappNumber;
            
            const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
            const newOrderId = `GPC${randomPart}`;

            const newOrder: Order = {
                orderId: newOrderId,
                userId: user.uid,
                userName: userProfile.name,
                productId: product.id,
                productName: product.name,
                productImage: product.imageUrls?.[0] || '',
                priceAtOrder: product.price,
                quantity: data.quantity,
                totalPrice: totalPrice,
                selectedVariation: data.variations,
                shippingAddress: data.shippingType === 'pickup' ? 'Ambil di Lapangan' : data.shippingAddress!,
                status: 'pending-payment',
                orderTimestamp: Timestamp.now(),
            };

            await setDoc(doc(firestore, 'orders', newOrderId), newOrder);

            const variationsText = Object.entries(data.variations).map(([key, value]) => `${key}: ${value}`).join(', ');
            const message = `Halo Admin Padel Hore, saya ingin konfirmasi pesanan:\nOrder ID: ${newOrderId}\nNama: ${userProfile.name}\nProduk: ${product.name}\n${variationsText ? `Varian: ${variationsText}` : ''}\nJumlah: ${data.quantity}\nTotal: Rp ${totalPrice.toLocaleString('id-ID')}\nPengiriman: ${newOrder.shippingAddress}\n\nSaya akan segera mengirimkan bukti pembayarannya. Terima kasih!`;
            
            const normalizeWaNumber = (numStr: string) => {
                if (!numStr) return '';
                let cleanNumber = numStr.replace(/\D/g, '');
                if (cleanNumber.startsWith('0')) {
                    return '62' + cleanNumber.substring(1);
                }
                return cleanNumber;
            };

            const normalizedAdminWaNumber = normalizeWaNumber(shopWhatsappNumber);
            const whatsappUrl = `https://wa.me/${normalizedAdminWaNumber}?text=${encodeURIComponent(message)}`;
            
            toast({ title: 'Order Placed!', description: "You will be redirected to WhatsApp to confirm your payment." });
            window.location.href = whatsappUrl;
        } catch (error) {
            console.error('Failed to save order:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your order.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isProfileLoading) {
        return <div className="flex-1 flex justify-center items-center p-8"><Loader2 className="animate-spin" /></div>
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {product.variations && product.variations.length > 0 && (
                            <div className="bg-card rounded-xl p-4 border">
                                <FormLabel className="block text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-widest">Variations</FormLabel>
                                <div className="space-y-4">
                                {product.variations.map(variation => (
                                    <FormField
                                        key={variation.name}
                                        control={form.control}
                                        name={`variations.${variation.name}`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="sr-only">{variation.name}</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-background"><SelectValue placeholder={`Select ${variation.name}`} /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {variation.options.map(option => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-card rounded-xl p-4 border">
                            <FormLabel className="block text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-widest">Quantity</FormLabel>
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="flex items-center">
                                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-r-none" onClick={() => field.value > 1 && field.onChange(field.value - 1)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input type="number" min={1} {...field} className="text-center h-10 rounded-none focus-visible:ring-0" />
                                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-l-none" onClick={() => field.onChange(field.value + 1)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        
                        <div className="bg-card rounded-xl p-4 border">
                            <FormField
                                control={form.control}
                                name="shippingType"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shipping Method</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-3">
                                                <FormItem>
                                                    <FormControl>
                                                        <Label className="group flex items-center p-3 rounded-lg border bg-background has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer transition-all relative">
                                                            <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                                                            <div className="ml-3 flex flex-1 items-center">
                                                                <Store className="mr-3 h-5 w-5 text-muted-foreground group-has-[:checked]:text-primary" />
                                                                <div className="flex flex-col">
                                                                    <span className="block text-sm font-semibold">Ambil di Lapangan (Free)</span>
                                                                    <span className="block text-xs text-muted-foreground">Pickup at the club directly</span>
                                                                </div>
                                                            </div>
                                                        </Label>
                                                    </FormControl>
                                                </FormItem>
                                                 <FormItem>
                                                    <FormControl>
                                                        <Label className="group flex items-center p-3 rounded-lg border bg-background has-[:checked]:border-primary has-[:checked]:bg-primary/5 cursor-pointer transition-all relative">
                                                            <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                                                            <div className="ml-3 flex flex-1 items-center">
                                                                <Truck className="mr-3 h-5 w-5 text-muted-foreground group-has-[:checked]:text-primary" />
                                                                <div className="flex flex-col">
                                                                    <span className="block text-sm font-semibold">Kirim ke Alamat</span>
                                                                    <span className="block text-xs text-muted-foreground">Delivery charges may apply</span>
                                                                </div>
                                                            </div>
                                                        </Label>
                                                    </FormControl>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {form.watch('shippingType') === 'delivery' && (
                                <FormField
                                    control={form.control}
                                    name="shippingAddress"
                                    render={({ field }) => (
                                        <FormItem className="mt-4">
                                            <FormLabel className="sr-only">Shipping Address</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Enter your full address" {...field} className="bg-background" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t shrink-0">
                    <div className="flex justify-between items-center py-2">
                        <span className="text-base font-medium text-muted-foreground">Total Price:</span>
                        <span className="text-3xl font-bold text-primary tracking-tight">Rp {totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                    {form.watch('shippingType') === 'delivery' && (
                        <p className="text-xs text-muted-foreground text-right -mt-2 mb-4">
                            *Harga belum termasuk ongkos kirim.
                        </p>
                    )}
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 font-bold text-base">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <><MessageCircle className="mr-2 h-5 w-5" /> Confirm via WhatsApp</>}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

    