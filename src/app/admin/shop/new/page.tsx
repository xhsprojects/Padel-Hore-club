'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductForm } from '@/components/admin/product-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NewProductPage() {
    return (
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
                            <CardTitle className="font-headline text-2xl">Create New Product</CardTitle>
                            <CardDescription>Fill in the details for the new product to add it to the shop.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProductForm />
                        </CardContent>
                    </Card>
                </div>
            </div>
    );
}
