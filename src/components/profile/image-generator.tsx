'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { loadImage, drawRoundRect } from '@/lib/image-utils';
import { capitalize } from '@/lib/utils';
import type { UserProfile, Tier, UserBadge, Badge } from '@/lib/types';
import { ALL_BADGES } from '@/lib/badges';
import { BADGE_SVGS } from '@/lib/badge-svgs';
import { Timestamp } from 'firebase/firestore';
import { LOGO_DATA_URI } from '@/lib/logo-base64';
import QRCode from 'qrcode';


const CARD_WIDTH = 900;
const CARD_HEIGHT = 1600;

// Centralized color palette for the canvas
const COLORS = {
  background: 'hsl(150, 60%, 97%)',
  foreground: 'hsl(145, 60%, 20%)',
  card: 'hsl(0, 0%, 100%)',
  primary: 'hsl(145, 60%, 30%)',
  mutedForeground: 'hsl(145, 60%, 40%)',
  border: 'hsl(150, 18%, 85%)',
  tier: {
    beginner: 'hsl(145, 60%, 20%)',
    'lower bronze': 'hsl(30, 54%, 40%)',
    bronze: 'hsl(30, 54%, 50%)',
    silver: 'hsl(220, 13%, 80%)',
    gold: 'hsl(45, 96%, 51%)',
  },
  tierBanner: {
    beginner: 'hsla(220, 13%, 69%, 0.15)',
    'lower bronze': 'hsla(30, 54%, 40%, 0.15)',
    bronze: 'hsla(30, 54%, 50%, 0.15)',
    silver: 'hsla(220, 13%, 80%, 0.15)',
    gold: 'hsla(45, 96%, 51%, 0.15)',
  },
};

const ICONS = {
    ranking: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    points: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    winRate: '<path d="M3 3v18h18"/><path d="M18 17V7"/><path d="M13 17V3"/><path d="M8 17v-4"/>',
    totalMain: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    shield: BADGE_SVGS['the-wall'].path,
};

type ImageGeneratorProps = {
  cardType: 'tier-up' | 'id-card';
  player: UserProfile;
  rank?: number;
  oldTier?: Tier;
  onReady: (downloadFn: () => void) => void;
};

// Helper function to wrap text.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    if (maxWidth <= 0) {
        return [text];
    }
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine === '' ? word : currentLine + ' ' + word;
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    return lines;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({
  cardType,
  player,
  rank,
  oldTier,
  onReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !player?.name) return;
    const link = document.createElement('a');
    link.download = `${player.name}-${cardType}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [canvasRef, player?.name, cardType]);

  useEffect(() => {
    if (player?.name) {
      onReady(downloadImage);
    }
  }, [onReady, downloadImage, player?.name]);

  useEffect(() => {
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

      if (cardType === 'tier-up' && !oldTier) {
          ctx.font = '50px Inter';
          ctx.textAlign = 'center';
          ctx.fillStyle = COLORS.foreground;
          ctx.fillText('Loading image...', CARD_WIDTH / 2, CARD_HEIGHT / 2);
          return;
      }
      
      try {
        await document.fonts.load('bold 100px "Space Grotesk"');
        await document.fonts.load('bold 80px "Inter"');

        if (cardType === 'tier-up') {
            await drawTierUpCard(ctx, player, oldTier!);
        } else {
            await drawIdCard(ctx, player, rank || 0);
        }
      } catch (error) {
          console.error("Failed to draw card:", error);
          ctx.fillStyle = 'red';
          ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
          ctx.fillStyle = 'white';
          ctx.font = '50px Inter';
          ctx.textAlign = 'center';
          const errorLines = wrapText(ctx, `Could not generate image.`, CARD_WIDTH - 40);
          errorLines.forEach((line, i) => {
            ctx.fillText(line, CARD_WIDTH / 2, CARD_HEIGHT / 2 - 30 + (i * 60));
          });
          if (error instanceof Error) {
            ctx.font = '30px Inter';
            const detailLines = wrapText(ctx, error.message, CARD_WIDTH - 40);
            detailLines.forEach((line, i) => {
                ctx.fillText(line, CARD_WIDTH / 2, CARD_HEIGHT / 2 + 30 + (i * 40));
            });
          }
      }
    };

    draw();
  }, [cardType, player, rank, oldTier]);

  return <canvas ref={canvasRef} className="w-full max-w-sm mx-auto rounded-lg shadow-lg" />;
};

// Redesigned drawIdCard function to match the image
async function drawIdCard(ctx: CanvasRenderingContext2D, player: UserProfile, rank: number) {
    // 1. Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 2. Header
    try {
        const logoImg = await loadImage(LOGO_DATA_URI);
        ctx.drawImage(logoImg, 60, 60, 110, 110);
    } catch (e) {
        console.error("Could not load logo for ID card:", e);
        ctx.fillStyle = 'red';
        ctx.fillRect(60, 60, 110, 110);
    }

    ctx.fillStyle = COLORS.foreground;
    ctx.font = 'bold 72px "Space Grotesk"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('PADEL HORE', 200, 115);

    ctx.fillStyle = COLORS.foreground;
    ctx.font = '56px "Inter"';
    ctx.textAlign = 'right';
    ctx.fillText(capitalize(player.tier), CARD_WIDTH - 60, 115);

    // 3. Avatar
    const avatarY = 380;
    const avatarRadius = 130;
    
    // Outer circle
    ctx.strokeStyle = COLORS.foreground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius + 12, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle (background for avatar)
    ctx.fillStyle = COLORS.tierBanner.silver;
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    // Avatar image
    try {
        const avatarImg = player.photoURL ? await loadImage(player.photoURL) : null;
        ctx.save();
        ctx.beginPath();
        ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        if (avatarImg) {
            ctx.drawImage(avatarImg, CARD_WIDTH / 2 - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        } else {
            ctx.font = 'bold 130px "Inter"';
            ctx.fillStyle = COLORS.foreground;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
        }
        ctx.restore();
    } catch (e) {
        // Fallback drawing if image fails
        ctx.font = 'bold 130px "Inter"';
        ctx.fillStyle = COLORS.foreground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
    }
    
    // 4. Name & ID
    let currentY = avatarY + avatarRadius + 80;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.foreground;
    ctx.font = 'bold 72px "Space Grotesk"';
    ctx.fillText(player.name.toUpperCase(), CARD_WIDTH / 2, currentY);
    currentY += 60;
    
    ctx.font = '48px "Inter"';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(player.phId || `PH-XXXX`, CARD_WIDTH / 2, currentY);
    currentY += 60;

    // Member badge
    const isMember = player.role === 'member' && (player.isUnlimitedMember || (player.membershipExpiryDate && player.membershipExpiryDate.toDate() > new Date()));
    if (isMember) {
        const memberText = "MEMBER";
        ctx.font = 'bold 36px "Inter"';
        const textWidth = ctx.measureText(memberText).width;
        const totalWidth = textWidth + 30 + 10;
        const startX = (CARD_WIDTH - totalWidth) / 2;
        
        ctx.save();
        ctx.translate(startX, currentY - 32);
        ctx.scale(1.3, 1.3);
        const p = new Path2D(ICONS.shield);
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 1.8;
        ctx.stroke(p);
        ctx.restore();

        ctx.fillStyle = COLORS.primary;
        ctx.fillText(memberText, startX + 30 + 10 + (textWidth / 2), currentY);
    }
    currentY += 80;
    
    // 5. Stats
    const winRate = (player.match_count || 0) > 0 ? ((player.win_count || 0) / (player.match_count || 0)) * 100 : 0;
    const stats = [
        { label: 'Ranking', value: `#${rank || '-'}`, icon: ICONS.ranking },
        { label: 'Total Poin', value: (player.total_points || 0).toLocaleString(), icon: ICONS.points },
        { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, icon: ICONS.winRate },
        { label: 'Total Main', value: (player.match_count || 0).toLocaleString(), icon: ICONS.totalMain },
    ];
    
    const statBoxWidth = 380;
    const statBoxHeight = 160;
    const statGap = 40;
    const statGridX = (CARD_WIDTH - (statBoxWidth * 2 + statGap)) / 2;

    stats.forEach((stat, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = statGridX + col * (statBoxWidth + statGap);
        const y = currentY + row * (statBoxHeight + statGap);

        ctx.fillStyle = COLORS.card;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        drawRoundRect(ctx, x, y, statBoxWidth, statBoxHeight, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLORS.mutedForeground;
        ctx.textAlign = 'left';
        ctx.font = '32px "Inter"';
        
        // Draw icon
        ctx.save();
        ctx.translate(x + 30, y + 35);
        ctx.scale(1.2, 1.2);
        const p = new Path2D(stat.icon);
        ctx.strokeStyle = COLORS.mutedForeground;
        ctx.lineWidth = 2;
        ctx.stroke(p);
        ctx.restore();
        
        ctx.fillText(stat.label, x + 30 + 32, y + 58);
        
        ctx.fillStyle = COLORS.foreground;
        ctx.font = 'bold 72px "Space Grotesk"';
        ctx.textAlign = 'left';
        ctx.fillText(stat.value, x + 30, y + 125);
    });

    currentY += 2 * (statBoxHeight + statGap) + 10;
    
    // 6. QR Code
    const qrText = `${window.location.origin}/players/${player.uid}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(qrText, {
            color: { dark: '#144d3b', light: '#00000000' }, // dark green, transparent background
            margin: 1,
            width: 180
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, (CARD_WIDTH - 180) / 2, currentY, 180, 180);
    } catch (e) {
        console.error("Failed to generate QR code", e);
    }
    currentY += 180 + 30;

    // 7. Footer
    ctx.font = 'bold 36px "Inter"';
    ctx.fillStyle = COLORS.foreground;
    ctx.textAlign = 'center';
    ctx.fillText("Join the community. Let's play!", CARD_WIDTH / 2, currentY);
    currentY += 50;

    ctx.font = '32px "Inter"';
    ctx.fillStyle = COLORS.mutedForeground;
    ctx.fillText('#PadelHoreClub #PadelStats', CARD_WIDTH / 2, currentY);
}


async function drawTierUpCard(ctx: CanvasRenderingContext2D, player: UserProfile, oldTier: Tier) {
  if (!player || !oldTier) {
    throw new Error("Missing player data or oldTier for card generation.");
  }

  // 1. Background
  const newTierColor = COLORS.tier[player.tier] || COLORS.primary;
  const oldTierColor = COLORS.tier[oldTier] || COLORS.mutedForeground;
  const newTierHsla = newTierColor.replace('hsl', 'hsla').replace(')', ', 0.3)');
  const gradient = ctx.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT / 2, 0, CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_WIDTH);
  gradient.addColorStop(0, newTierHsla);
  gradient.addColorStop(1, COLORS.background);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 2. Logo
  try {
    const logoImg = await loadImage(LOGO_DATA_URI);
    ctx.drawImage(logoImg, 80, 60, 100, 100);
  } catch (e) {
    console.error("Could not load logo for tier-up card:", e);
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 64px "Space Grotesk"';
  ctx.fillStyle = COLORS.foreground;
  ctx.fillText('Padel Hore', 200, 130);

  // 3. Main Text
  ctx.textAlign = 'center';
  ctx.font = 'bold 100px "Space Grotesk"';
  ctx.fillStyle = COLORS.primary;
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 10;
  ctx.fillText('LEVEL UP!', CARD_WIDTH / 2, 350);
  ctx.shadowBlur = 0;

  ctx.font = '50px "Inter"';
  ctx.fillStyle = COLORS.foreground;
  ctx.fillText('NEW TIER UNLOCKED!', CARD_WIDTH / 2, 450);

  // 4. Tier Transition
  ctx.font = 'bold 64px "Space Grotesk"';
  ctx.textAlign = 'right';
  ctx.fillStyle = oldTierColor;
  ctx.fillText(capitalize(oldTier), CARD_WIDTH / 2 - 80, 650);

  ctx.font = 'bold 80px "Inter"';
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.foreground;
  ctx.fillText('→', CARD_WIDTH / 2, 650);

  ctx.font = 'bold 72px "Space Grotesk"';
  ctx.textAlign = 'left';
  ctx.fillStyle = newTierColor;
  ctx.fillText(capitalize(player.tier), CARD_WIDTH / 2 + 80, 650);

  // 5. Avatar
  const avatarRadius = 200;
  const avatarY = 980;
  try {
    const avatarImg = player.photoURL ? await loadImage(player.photoURL) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    if (avatarImg) {
        ctx.drawImage(avatarImg, CARD_WIDTH / 2 - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } else {
        ctx.fillStyle = COLORS.card;
        ctx.fill();
        ctx.font = 'bold 180px "Inter"';
        ctx.fillStyle = COLORS.mutedForeground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
    }
    ctx.restore();
  } catch (e) {
    console.error("Error loading avatar:", e);
    // Draw fallback if image fails to load
    ctx.save();
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = COLORS.card;
    ctx.fill();
    ctx.font = 'bold 180px "Inter"';
    ctx.fillStyle = COLORS.mutedForeground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
    ctx.restore();
  }
    
  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
  ctx.strokeStyle = newTierColor;
  ctx.lineWidth = 20;
  ctx.stroke();

  // 6. Player Name & Footer
  let currentY = avatarY + avatarRadius + 90;
  ctx.font = 'bold 80px "Space Grotesk"';
  ctx.fillStyle = COLORS.foreground;
  ctx.textAlign = 'center';
  const nameLines = wrapText(ctx, player.name.toUpperCase(), CARD_WIDTH - 120);
  nameLines.slice(0, 2).forEach((line) => {
    ctx.fillText(line, CARD_WIDTH / 2, currentY);
    currentY += 90;
  });

  currentY += 20;
  ctx.font = '40px "Inter"';
  ctx.fillStyle = COLORS.mutedForeground;
  ctx.fillText('The grind never stops!', CARD_WIDTH / 2, currentY);

  currentY = CARD_HEIGHT - 60;
  ctx.font = 'bold 36px "Inter"';
  ctx.fillStyle = COLORS.mutedForeground;
  ctx.fillText('#PadelHoreClub #LevelUp', CARD_WIDTH / 2, currentY);
}
