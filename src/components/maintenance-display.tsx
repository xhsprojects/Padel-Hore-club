'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/icons';

interface MaintenanceDisplayProps {
    message?: string;
    isLoading?: boolean;
}

export default function MaintenanceDisplay({ message, isLoading }: MaintenanceDisplayProps) {
    if (isLoading) {
        return (
            <div
                className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-center"
            >
                <Card className="w-full max-w-lg overflow-hidden border-border shadow-2xl shadow-primary/10">
                    <div className="p-8 sm:p-12 space-y-6">
                        <div className="flex justify-center">
                            <Skeleton className="h-20 w-20 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-3/4 mx-auto" />
                            <div className="space-y-2 pt-2">
                                <Skeleton className="h-5 w-full mx-auto" />
                                <Skeleton className="h-5 w-5/6 mx-auto" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-card/50 p-4 border-t border-border flex items-center justify-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                </Card>
            </div>
        )
    }
    
    return (
        <div 
            className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-center"
        >
            <Card className="w-full max-w-lg overflow-hidden border-border shadow-2xl shadow-primary/10">
                <div className="p-8 sm:p-12 space-y-6">
                    <div className="flex justify-center">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                            <Wrench className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="font-headline text-3xl sm:text-4xl text-foreground">
                            Under Maintenance
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground">
                            {message || 'We are currently performing some upgrades to improve your experience. The app will be back online shortly.'}
                        </CardDescription>
                    </div>
                </div>
                <div className="bg-card/50 p-4 border-t border-border flex items-center justify-center gap-3">
                    <Logo className="h-6 w-6" />
                    <p className="font-bold tracking-widest text-muted-foreground">PADEL HORE</p>
                </div>
            </Card>
        </div>
    );
}

    