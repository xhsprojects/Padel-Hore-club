'use client';

import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ALL_BADGES } from '@/lib/badges';
import type { Badge as BadgeType, BadgeCategory } from '@/lib/types';
import { Award } from 'lucide-react';
import React from 'react';

const CATEGORY_ORDER: BadgeCategory[] = [
    'The Podium',
    'Performance',
    'Engagement & Loyalty',
    'Social',
    'History',
];

export default function BadgeSystemPage() {
    const groupedBadges = React.useMemo(() => {
        const groups: Record<BadgeCategory, BadgeType[]> = {
            'The Podium': [],
            'Performance': [],
            'Engagement & Loyalty': [],
            'Social': [],
            'History': [],
        };
        for (const badge of ALL_BADGES) {
            if (groups[badge.category]) {
                groups[badge.category].push(badge);
            }
        }
        return groups;
    }, []);

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="text-center">
                        <Award className="mx-auto h-12 w-12 text-primary" />
                        <CardTitle className="font-headline text-3xl mt-2">Sistem Badge Padel Hore</CardTitle>
                        <CardDescription className="text-lg">
                            Koleksi semua lencana untuk buktikan status legendamu di lapangan!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Accordion type="multiple" className="w-full" defaultValue={CATEGORY_ORDER.map(c => c.toLowerCase())}>
                            {CATEGORY_ORDER.map(category => (
                                <BadgeCategorySection
                                    key={category}
                                    title={category}
                                    badges={groupedBadges[category]}
                                />
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    );
}

function BadgeCategorySection({ title, badges }: { title: string, badges: BadgeType[] }) {
    return (
        <AccordionItem value={title.toLowerCase()}>
            <AccordionTrigger className="text-xl font-bold hover:no-underline">
                {title}
            </AccordionTrigger>
            <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                    {badges.map(badge => (
                        <BadgeDetail
                            key={badge.id}
                            icon={badge.icon}
                            name={badge.name}
                            description={badge.description}
                        />
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function BadgeDetail({ icon: Icon, name, description }: { icon: React.ElementType, name: string, description: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h4 className="font-semibold">{name}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}
