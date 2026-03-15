import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Tier, TierThresholds, Event, EventStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getEventStatus(event: Pick<Event, 'startDate' | 'endDate' | 'status'>): EventStatus {
  if (event.status === 'cancelled') {
    return 'cancelled';
  }
  const now = new Date();
  const startDate = event.startDate.toDate();
  const endDate = event.endDate.toDate();

  if (now < startDate) {
    return 'upcoming';
  }
  if (now >= startDate && now <= endDate) {
    return 'ongoing';
  }
  return 'completed';
}

export function getTier(points: number, thresholds: TierThresholds): Tier {
  // Tiers must be checked from highest to lowest
  if (points >= thresholds.gold.min) return 'gold';
  if (points >= thresholds.silver.min) return 'silver';
  if (points >= thresholds.bronze.min) return 'bronze';
  if (points >= thresholds["lower bronze"].min) return 'lower bronze';
  return 'beginner';
}

export function getSkillLevelFromWinRate(winRate: number): number {
  if (winRate < 0 || winRate > 100) {
    return 1.0;
  }
  // Scale from 1.0 to 5.0.
  // winRate 0 -> 1.0
  // winRate 100 -> 5.0
  const skill = 1.0 + (winRate / 100) * 4.0;
  // Clamp the value just in case and return with one decimal place
  return Math.round(Math.min(5.0, Math.max(1.0, skill)) * 10) / 10;
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
