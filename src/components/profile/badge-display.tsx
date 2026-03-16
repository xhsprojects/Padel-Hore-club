'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ALL_BADGES } from '@/lib/badges';
import type { UserBadge, Badge as BadgeType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BadgeDisplayProps {
  badges?: UserBadge[];
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const [selectedBadge, setSelectedBadge] = useState<(BadgeType & { awarded: any }) | null>(null);

  if (!badges || badges.length === 0) {
    return null;
  }

  const badgeMap = new Map(ALL_BADGES.map((b) => [b.id, b]));

  const sortedBadges = badges
    .map((ub) => ({ ...badgeMap.get(ub.badgeId), awarded: ub.timestamp }))
    .filter((b): b is BadgeType & { awarded: any } => !!b.id)
    .sort((a, b) => {
      // Sort podium badges first
      if (a.category === 'The Podium' && b.category !== 'The Podium') return -1;
      if (a.category !== 'The Podium' && b.category === 'The Podium') return 1;
      // Then sort by when it was awarded
      return b.awarded.toMillis() - a.awarded.toMillis();
    });

  return (
    <>
      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-2">Achievements</h3>
        <div className="flex flex-wrap gap-3">
          <TooltipProvider>
            {sortedBadges.map((badge) => {
              if (!badge || !badge.id) return null;
              const Icon = badge.icon;
              
              const isApex = badge.id === 'podium-1';
              const isPodium2 = badge.id === 'podium-2';
              const isPodium3 = badge.id === 'podium-3';
              
              let colorClass = 'bg-secondary text-secondary-foreground';
              if (isApex) colorClass = 'bg-amber-400 text-black';
              if (isPodium2) colorClass = 'bg-slate-400 text-black';
              if (isPodium3) colorClass = 'bg-orange-500 text-white';

              return (
                  <Tooltip key={badge.id} delayDuration={100}>
                    <TooltipTrigger asChild>
                        <div
                          onClick={() => setSelectedBadge(badge)}
                          className={cn(
                            'h-12 w-12 rounded-full flex items-center justify-center relative cursor-pointer transition-transform hover:scale-110',
                            colorClass,
                            isApex && 'animate-pulse ring-4 ring-amber-400/50'
                          )}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-bold">{badge.name}</p>
                        <p className="text-xs text-muted-foreground">Click to see details</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        {selectedBadge && (
          <DialogContent>
            <DialogHeader className="items-center text-center">
                {(() => {
                    const Icon = selectedBadge.icon;
                    const isApex = selectedBadge.id === 'podium-1';
                    const isPodium2 = selectedBadge.id === 'podium-2';
                    const isPodium3 = selectedBadge.id === 'podium-3';
                    let colorClass = 'bg-secondary text-secondary-foreground';
                    if (isApex) colorClass = 'bg-amber-400 text-black';
                    if (isPodium2) colorClass = 'bg-slate-400 text-black';
                    if (isPodium3) colorClass = 'bg-orange-500 text-white';
                    return (
                        <div className={cn('h-20 w-20 rounded-full flex items-center justify-center mb-4', colorClass)}>
                           <Icon className="h-10 w-10" />
                        </div>
                    )
                })()}
              <DialogTitle className="font-headline text-2xl">{selectedBadge.name}</DialogTitle>
              <DialogDescription className="text-base pt-2">
                {selectedBadge.description}
              </DialogDescription>
              <p className="text-sm text-muted-foreground pt-4">Category: {selectedBadge.category}</p>
              <p className="text-xs text-muted-foreground pt-1">Earned on: {format(selectedBadge.awarded.toDate(), 'dd MMMM yyyy')}</p>
            </DialogHeader>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
