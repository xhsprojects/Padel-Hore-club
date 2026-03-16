'use client';

import { FieldValue, Timestamp } from 'firebase/firestore';

export type UserRole = "admin" | "member" | "non-member" | "guest";

export type Tier = "beginner" | "lower bronze" | "bronze" | "silver" | "gold";

export type TierThresholds = Record<Tier, { min: number; max: number | typeof Infinity }>;

export interface UserBadge {
  badgeId: string;
  timestamp: Timestamp;
}

export interface UserProfile {
  uid: string;
  phId?: string;
  email?: string;
  name: string;
  whatsapp?: string;
  showWhatsapp?: boolean;
  role: UserRole;
  total_points: number;
  tier: Tier;
  win_count: number;
  match_count: number;
  photoURL: string | null;
  fcmTokens?: string[];
  win_streak: number;
  fair_play_count?: number;
  early_bird_count?: number;
  night_owl_count?: number;
  eventAttendanceCount?: number;
  skillLevel?: number;
  membershipExpiryDate?: Timestamp;
  isUnlimitedMember?: boolean;
  badges?: UserBadge[];
}

export type PointBreakdown = {
  base: number;
  result: number;
  margin: number;
  host_match: number;
  slot_filler: number;
  on_time: number;
  fair_play: number;
  consistency: number; // win_streak + loyalty
  total: number;
}

export interface Match {
  timestamp: Timestamp;
  team_1: string[]; // Array of user UIDs
  team_2: string[]; // Array of user UIDs
  player_ids: string[]; // For querying
  score_1: number;
  score_2: number;
  winner_team: "Team 1" | "Team 2" | "Draw";
  margin: number;
  host_id?: string;
  on_time_players?: string[];
  fair_play_players?: string[];
  slot_filler_players?: string[];
  point_breakdown?: { [playerId: string]: PointBreakdown };
  courtId?: string;
  courtName?: string;
  courtLocation?: string;
  eventId?: string;
  eventName?: string;
  roundNumber?: number;
}

export interface Notification {
  uid: string;
  title: string;
  body?: string;
  timestamp: Timestamp;
  isRead: boolean;
  link?: string;
  linkButtonText?: string;
  icon?: string;
}

export interface Court {
  name: string;
  location: string;
}

export interface AppSettings {
  isMaintenanceMode?: boolean;
  maintenanceMessage?: string;
  membershipWhatsappNumber?: string;
  shopWhatsappNumber?: string;
  tierThresholds?: Partial<TierThresholds>;
  tierResetPercentages?: Partial<Record<Tier, number>>;
}

export interface FinalLeaderboardPlayer {
  id: string;
  name: string;
  phId: string;
  photoURL: string | null;
  tier: Tier;
  total_points: number;
  win_count: number;
  match_count: number;
}

export interface Season {
    name: string;
    startDate: Timestamp;
    endDate: Timestamp;
    isActive: boolean;
    finalLeaderboard?: FinalLeaderboardPlayer[];
}

export interface Round {
  roundNumber: number;
  byePlayerIds?: string[];
}

export type EventType = 'Regular Match' | 'Versus' | 'Competition' | 'coaching-clinic' | 'social-gathering';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  name: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startDate: Timestamp;
  endDate: Timestamp;
  maxParticipants: number;
  participantIds: string[];
  waitlistIds: string[];
  attendancePoints?: number;
  pointMultiplier?: number;
  bannerUrl?: string;
  galleryUrls?: string[];
  courtId?: string;
  rounds?: Round[];
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export interface EventRegistration {
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  registrationTimestamp: Timestamp;
  status: RegistrationStatus;
  attended?: boolean;
  checkInTimestamp?: Timestamp;
}

// Shop and Order Types
export type ProductStatus = 'ready-stock' | 'pre-order' | 'out-of-stock';

export interface Variation {
    name: string; // e.g., 'Size'
    options: string[]; // e.g., ['S', 'M', 'L']
}

export interface Product {
    name: string;
    description: string;
    price: number;
    imageUrls?: string[];
    status: ProductStatus;
    poEstimate?: string;
    variations?: Variation[];
}

export type OrderStatus = 'pending-payment' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface Order {
    orderId: string;
    userId: string;
    userName: string;
    productId: string;
    productName: string;
    productImage?: string;
    priceAtOrder: number;
    quantity: number;
    totalPrice: number;
    selectedVariation: Record<string, string>;
    shippingAddress: string;
    status: OrderStatus;
    orderTimestamp: Timestamp;
    trackingNumber?: string;
}


export type SortKey = "total_points" | "win_rate" | "match_count";
export type SortDirection = "asc" | "desc";

export type WithId<T> = T & { id: string };

export type BadgeCategory = 'The Podium' | 'Performance' | 'Engagement & Loyalty' | 'Social' | 'History';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: React.ElementType;
}
