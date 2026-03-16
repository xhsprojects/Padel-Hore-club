import type { Badge } from './types';
import {
  Trophy,
  Crown,
  Swords,
  Flame,
  Shield,
  Target,
  Sunrise,
  Moon,
  Bike,
  CalendarCheck,
  Users,
  Gem,
  UserPlus,
  Sparkles,
  Rocket,
  Medal,
  CalendarDays,
} from 'lucide-react';

export const ALL_BADGES: Badge[] = [
  // The Podium
  {
    id: 'podium-1',
    name: 'The Apex Padelist',
    description: 'Juara 1 Musim. Penguasa klasemen akhir musim.',
    category: 'The Podium',
    icon: Trophy,
  },
  {
    id: 'podium-2',
    name: 'The Silver Striker',
    description: 'Juara 2 Musim. Runner-up yang hampir mencapai puncak.',
    category: 'The Podium',
    icon: Trophy,
  },
  {
    id: 'podium-3',
    name: 'The Bronze Basher',
    description: 'Juara 3 Musim. Pemain elit di posisi tiga besar.',
    category: 'The Podium',
    icon: Trophy,
  },
  // Performance
  {
    id: 'giant-killer',
    name: 'The Giant Killer',
    description: 'Mengalahkan lawan yang berada di tier jauh lebih tinggi.',
    category: 'Performance',
    icon: Swords,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Mencapai Win Streak 5 kali berturut-turut dalam satu musim.',
    category: 'Performance',
    icon: Flame,
  },
  {
    id: 'the-wall',
    name: 'The Wall',
    description: 'Menang dengan skor telak (lawan hampir tidak diberi poin).',
    category: 'Performance',
    icon: Shield,
  },
  // Engagement & Loyalty
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Sering bermain di sesi pagi (sebelum jam 9 pagi).',
    category: 'Engagement & Loyalty',
    icon: Sunrise,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Sering bermain di sesi paling malam (di atas jam 9 malam).',
    category: 'Engagement & Loyalty',
    icon: Moon,
  },
  {
    id: 'marathoner',
    name: 'Marathoner',
    description: 'Bermain lebih dari 5 pertandingan dalam satu minggu.',
    category: 'Engagement & Loyalty',
    icon: Bike,
  },
  {
    id: 'event-enthusiast',
    name: 'Event Enthusiast',
    description: 'Hadir dalam 5 acara klub yang berbeda.',
    category: 'Engagement & Loyalty',
    icon: CalendarCheck,
  },
  // Social
  {
    id: 'socialite',
    name: 'The Socialite',
    description: 'Sudah bertanding dengan lebih dari 20 pemain yang berbeda.',
    category: 'Social',
    icon: Users,
  },
  {
    id: 'fair-play',
    name: 'Fair Play',
    description: 'Diberikan untuk perilaku paling sopan dan sportif.',
    category: 'Social',
    icon: Sparkles,
  },
  // History
  {
    id: 'pioneer',
    name: 'Season 1 Pioneer',
    description: 'Bergabung dan bertanding di musim pertama Padel Hore Club.',
    category: 'History',
    icon: Rocket,
  },
  {
    id: 'hat-trick',
    name: 'Hat-trick Hero',
    description: 'Menjadi Juara 1 sebanyak 3 kali (kumulatif).',
    category: 'History',
    icon: Medal,
  },
  {
    id: 'holiday-hero',
    name: 'Holiday Hero',
    description: 'Aktif bermain saat hari libur nasional atau event khusus.',
    category: 'History',
    icon: CalendarDays,
  },
];
