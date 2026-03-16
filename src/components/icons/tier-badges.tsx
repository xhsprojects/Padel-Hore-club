'use client';

import { TIER_COLORS } from "@/lib/constants";
import type { Tier } from "@/lib/types";

// These functions will return an SVG string that can be used in a data URI.
const getBadgeSvgString = (tier: Tier, primaryColor: string, secondaryColor: string, icon: string) => `
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad-${tier}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
        </linearGradient>
    </defs>
    <path d="M100 10 L190 60 L190 140 L100 190 L10 140 L10 60 Z" fill="url(#grad-${tier})" stroke="#FFFFFF" stroke-width="5"/>
    ${icon}
    <text x="100" y="150" font-family="Space Grotesk, sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="bold" text-transform="uppercase">${tier}</text>
</svg>
`;

const RookieIcon = `<path d="M100 95 l-20 -20 l40 0 Z" fill="white" opacity="0.8"/>`;
const RegularIcon = `<path d="M100 70 l20 25 l-40 0 Z M100 100 l20 25 l-40 0 Z" fill="white" opacity="0.8"/>`;
const ChallengerIcon = `<g transform="translate(100, 90) scale(0.3)"><path d="M96.4,55.2,74.9,33.7,53.4,55.2l-3.3-3.3,21.5-21.5,21.5,21.5Z M53.4,124.8l21.5,21.5,21.5-21.5,3.3,3.3-21.5,21.5-21.5-21.5Z M124.8,53.4l21.5,21.5-21.5,21.5,3.3,3.3,21.5-21.5-21.5-21.5Z M55.2,96.4,33.7,74.9,55.2,53.4l-3.3-3.3-21.5,21.5,21.5,21.5Z" fill="white" opacity="0.8"/></g>`;
const EliteIcon = `<g transform="translate(100, 90) scale(0.4)"><path d="M100,28.9,88.9,55.3,60,59.2l22.2,19-6.7,28.2L100,92.2l24.5,14.2-6.7-28.2,22.2-19-28.9-3.9Z" fill="white" opacity="0.8"/></g>`;
const LegendIcon = `<g transform="translate(100, 90) scale(0.4)"><path d="M5,16L3,5L8.5,10L12,4L15.5,10L21,5L19,16H5M19,19H5V18H19V19Z" fill="white" transform="translate(-12, -12) scale(2.5)" opacity="0.8"/></g>`;

const badgeData: Record<Tier, {colors: [string, string], icon: string}> = {
    beginner: { colors: ["#94a3b8", "#64748b"], icon: RookieIcon },
    "lower bronze": { colors: ["#38bdf8", "#0ea5e9"], icon: RegularIcon },
    bronze: { colors: ["#a78bfa", "#8b5cf6"], icon: ChallengerIcon },
    silver: { colors: ["#facc15", "#eab308"], icon: EliteIcon },
    gold: { colors: ["#f43f5e", "#e11d48"], icon: LegendIcon },
}

export function getTierBadgeDataUri(tier: Tier): string {
    const { colors, icon } = badgeData[tier];
    const svgString = getBadgeSvgString(tier, colors[0], colors[1], icon);
    const encodedSvg = btoa(svgString);
    return `data:image/svg+xml;base64,${encodedSvg}`;
}
