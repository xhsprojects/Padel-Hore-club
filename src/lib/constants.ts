import type { Tier, TierThresholds } from './types';

export const POINT_RULES = {
  PARTICIPATION: {
    MEMBER: 10,
    NON_MEMBER: 8,
  },
  RESULT: {
    WIN: 15,
    LOSS: 5,
    DRAW: 5,
  },
  MARGIN_BONUS: {
    DOMINANT_WIN: 5, // Win by >= 5 games
    CLOSE_WIN: 3, // Win by 1-4 games
    HONORABLE_LOSS: 2, // Loss by <= 2 games
  },
  BEHAVIOR: {
    HOST_MATCH: 5,
    SLOT_FILLER: 3,
    ON_TIME: 2,
    FAIR_PLAY: 5,
  },
  CONSISTENCY: {
    WIN_STREAK_THRESHOLD: 3,
    WIN_STREAK_BONUS: 10,
    WEEKLY_ACTIVITY_THRESHOLD: 2, // 2 matches in a week
    WEEKLY_ACTIVITY_BONUS: 5,
    MONTHLY_ACTIVITY_THRESHOLD: 4, // 4 matches in a month
    MONTHLY_ACTIVITY_BONUS: 10,
  },
};

export const TIER_COLORS: Record<Tier, string> = {
    beginner: 'bg-tier-beginner text-white',
    "lower bronze": 'bg-tier-lower-bronze text-white',
    bronze: 'bg-tier-bronze text-white',
    silver: 'bg-tier-silver text-black',
    gold: 'bg-tier-gold text-black',
}

export const TIER_BANNER_COLORS: Record<Tier, string> = {
    beginner: 'bg-tier-beginner/20',
    "lower bronze": 'bg-tier-lower-bronze/20',
    bronze: 'bg-tier-bronze/20',
    silver: 'bg-tier-silver/20',
    gold: 'bg-tier-gold/20',
}

export const TIER_FRAME_CLASSES: Record<Tier, string> = {
    beginner: 'border-2 border-tier-beginner/60',
    "lower bronze": 'border-4 border-tier-lower-bronze ring-4 ring-tier-lower-bronze/30',
    bronze: 'border-4 border-tier-bronze ring-4 ring-tier-bronze/40',
    silver: 'border-4 border-tier-silver ring-8 ring-tier-silver/30',
    gold: 'border-4 border-tier-gold ring-8 ring-tier-gold/40',
};

export const DEFAULT_THRESHOLDS: TierThresholds = {
  beginner: { min: 0, max: 100 },
  "lower bronze": { min: 101, max: 300 },
  bronze: { min: 301, max: 600 },
  silver: { min: 601, max: 1000 },
  gold: { min: 1001, max: Infinity },
};

export const DEFAULT_RESET_PERCENTAGES: Record<Tier, number> = {
  beginner: 20,
  "lower bronze": 20,
  bronze: 25,
  silver: 30,
  gold: 35,
};
