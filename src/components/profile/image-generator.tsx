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


const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

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
    beginner: 'hsla(145, 60%, 20%, 0.1)',
    'lower bronze': 'hsla(30, 54%, 40%, 0.1)',
    bronze: 'hsla(30, 54%, 50%, 0.1)',
    silver: 'hsla(220, 13%, 80%, 0.1)',
    gold: 'hsla(45, 96%, 51%, 0.1)',
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
        await document.fonts.load('500 50px "Inter"');
        await document.fonts.load('600 36px "Inter"');

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

// Redesigned drawIdCard function to match Padel Hore professional layout (v6)
async function drawIdCard(ctx: CanvasRenderingContext2D, player: UserProfile, rank: number) {
    // 1. Background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // 2. Banner Section (Blurred Profile Pic)
    const bannerHeight = 450;
    const tierColor = COLORS.tier[player.tier] || COLORS.primary;
    
    // Draw blurred profile pic as banner if available
    if (player.photoURL) {
        try {
            // Append cache-busting to avoid CORS issues from browser cache
            const photoUrlWithCacheBust = player.photoURL.includes('?') 
                ? `${player.photoURL}&v=${Date.now()}` 
                : `${player.photoURL}?v=${Date.now()}`;
                
            const bannerImg = await loadImage(photoUrlWithCacheBust);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, CARD_WIDTH, bannerHeight);
            ctx.clip();
            
            // Apply blur filter if supported
            if ('filter' in ctx) {
                ctx.filter = 'blur(20px)';
            }
            
            const aspect = bannerImg.width / bannerImg.height;
            let drawW = CARD_WIDTH;
            let drawH = CARD_WIDTH / aspect;
            if (drawH < bannerHeight) {
                drawH = bannerHeight;
                drawW = bannerHeight * aspect;
            }
            
            ctx.globalAlpha = 0.3;
            ctx.drawImage(bannerImg, (CARD_WIDTH - drawW) / 2, (bannerHeight - drawH) / 2, drawW, drawH);
            ctx.globalAlpha = 1.0;
            if ('filter' in ctx) {
                ctx.filter = 'none';
            }
            ctx.restore();
        } catch (e) {
            console.error("Banner image failed:", e);
        }
    }
    
    const tierBannerColor = COLORS.tierBanner[player.tier] || 'rgba(20, 77, 59, 0.1)';
    ctx.fillStyle = tierBannerColor;
    ctx.fillRect(0, 0, CARD_WIDTH, bannerHeight);

    // Header Content
    const contentPadding = 80;
    const headerY = 130;
    
    // Logo
    try {
        const logoImg = await loadImage('/logopadel.png');
        ctx.drawImage(logoImg, contentPadding, headerY - 50, 100, 100);
    } catch (e) {
        console.error("Could not load /logopadel.png, falling back to base64:", e);
        try {
            const logoImg = await loadImage(LOGO_DATA_URI);
            ctx.drawImage(logoImg, contentPadding, headerY - 50, 100, 100);
        } catch (e2) {}
    }

    // Club Name
    ctx.fillStyle = COLORS.foreground;
    ctx.textAlign = 'left';
    ctx.font = 'bold 64px "Space Grotesk"';
    ctx.textBaseline = 'middle';
    ctx.fillText('PADEL HORE', contentPadding + 120, headerY);

    // Tier Text (Top Right)
    ctx.textAlign = 'right';
    ctx.font = 'bold 48px "Space Grotesk"';
    ctx.fillStyle = tierColor;
    ctx.fillText(capitalize(player.tier), CARD_WIDTH - contentPadding, 100);

    // 3. Avatar Section
    const avatarY = 450;
    const avatarRadius = 180;
    
    // Avatar image or fallback
    let avatarLoaded = false;
    if (player.photoURL) {
        try {
            // Cache-busting for avatar
            const avatarUrlWithCacheBust = player.photoURL.includes('?') 
                ? `${player.photoURL}&v=${Date.now()}` 
                : `${player.photoURL}?v=${Date.now()}`;
                
            const avatarImg = await loadImage(avatarUrlWithCacheBust);
            ctx.save();
            ctx.beginPath();
            ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, CARD_WIDTH / 2 - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
            avatarLoaded = true;
        } catch (e) {
            console.error("Could not load avatar:", e);
        }
    }

    if (!avatarLoaded) {
        ctx.fillStyle = COLORS.card;
        ctx.beginPath();
        ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.font = 'bold 160px "Inter"';
        ctx.fillStyle = COLORS.mutedForeground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
        ctx.textBaseline = 'alphabetic';
    }

    // Avatar Ring
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.strokeStyle = tierColor;
    ctx.lineWidth = 24;
    ctx.stroke();

    // 4. Name, ID, and Status
    let currentY = avatarY + avatarRadius + 90;
    ctx.textAlign = 'center';
    
    // Name (wrapped)
    let nameFontSize = 80;
    ctx.font = `bold ${nameFontSize}px "Space Grotesk"`;
    ctx.fillStyle = COLORS.foreground;
    const nameToDraw = (player.name || 'Unknown User').toUpperCase();
    let nameLines = wrapText(ctx, nameToDraw, CARD_WIDTH - 160);
    
    if (nameLines.length > 1) {
        nameFontSize = 64;
        ctx.font = `bold ${nameFontSize}px "Space Grotesk"`;
        nameLines = wrapText(ctx, nameToDraw, CARD_WIDTH - 160);
    }
    nameLines = nameLines.slice(0, 2);

    const nameLineHeight = nameFontSize * 1.1;
    nameLines.forEach((line) => {
        ctx.fillText(line, CARD_WIDTH / 2, currentY);
        currentY += nameLineHeight;
    });

    // ID
    currentY += 10;
    ctx.font = '500 50px "Inter"';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(player.phId || `PH-XXXX`, CARD_WIDTH / 2, currentY);
    currentY += 60;

    // Member Badge
    const isMember = player.role === 'member' || player.isUnlimitedMember;
    if (isMember) {
        currentY += 15;
        ctx.font = 'bold 40px "Inter"';
        ctx.fillStyle = COLORS.primary;
        ctx.textAlign = 'center';
        ctx.fillText("🛡️ OFFICIAL MEMBER", CARD_WIDTH / 2, currentY);
        currentY += 40;
    }
    currentY += 30; // Reduced padding before stats grid

    // 5. Stats Grid
    const winRate = (player.match_count || 0) > 0 ? ((player.win_count || 0) / (player.match_count || 0)) * 100 : 0;
    const stats = [
        { label: 'RANKING', value: `#${rank || '-'}`, icon: ICONS.ranking },
        { label: 'POINTS', value: (player.total_points || 0).toLocaleString(), icon: ICONS.points },
        { label: 'WIN RATE', value: `${winRate.toFixed(0)}%`, icon: ICONS.winRate },
        { label: 'MATCHES', value: (player.match_count || 0).toLocaleString(), icon: ICONS.totalMain },
    ];
    
    const statBoxWidth = 420;
    const statBoxHeight = 200; // Adjusted for better text-only look
    const statGap = 40;
    const statGridX = (CARD_WIDTH - (statBoxWidth * 2 + statGap)) / 2;
    let statGridY = currentY; 

    stats.forEach((stat, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = statGridX + col * (statBoxWidth + statGap);
        const y = statGridY + row * (statBoxHeight + statGap);

        ctx.fillStyle = COLORS.card;
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        drawRoundRect(ctx, x, y, statBoxWidth, statBoxHeight, 32); 
        ctx.fill();
        ctx.stroke();

        // Label (centered)
        ctx.fillStyle = COLORS.mutedForeground;
        ctx.textAlign = 'center';
        ctx.font = '600 36px "Inter"';
        ctx.fillText(stat.label, x + statBoxWidth / 2, y + 65);
        
        // Value (centered)
        ctx.fillStyle = COLORS.foreground;
        ctx.font = 'bold 80px "Space Grotesk"'; 
        ctx.textAlign = 'center';
        ctx.fillText(stat.value, x + statBoxWidth / 2, y + 145);
    });

    currentY = statGridY + (Math.ceil(stats.length / 2) * (statBoxHeight + statGap)) + 40; // Tighten space before QR
    
    // 6. QR Code Section
    const qrSize = 180; 
    const qrX = (CARD_WIDTH - qrSize) / 2;
    
    ctx.fillStyle = 'white';
    drawRoundRect(ctx, qrX - 20, currentY - 20, qrSize + 40, qrSize + 40, 24); 
    ctx.fill();

    const qrText = `${window.location.origin}/players/${player.uid}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(qrText, {
            color: { dark: '#000000', light: '#FFFFFF' },
            margin: 1,
            width: qrSize
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrX, currentY, qrSize, qrSize);
    } catch (e) {
        console.error("Failed to generate QR code", e);
    }
    
    // 7. Footer
    currentY += qrSize + 40; // Tighten space before text
    ctx.font = 'bold 44px "Space Grotesk"';
    ctx.fillStyle = COLORS.primary;
    ctx.textAlign = 'center';
    ctx.fillText("Join the community. Let's play!", CARD_WIDTH / 2, currentY);

    ctx.font = '400 36px "Inter"';
    ctx.fillStyle = COLORS.mutedForeground;
    ctx.fillText('#PadelHoreClub #PadelStats', CARD_WIDTH / 2, currentY + 60);
}


// Redesigned drawTierUpCard function to match Padel Hore professional layout (v6)
async function drawTierUpCard(ctx: CanvasRenderingContext2D, player: UserProfile, oldTier: Tier) {
    // 1. Festive Background
    const newTierColor = COLORS.tier[player.tier] || COLORS.primary;
    const oldTierColor = COLORS.tier[oldTier] || COLORS.mutedForeground;
    
    // Draw blurred profile pic as background if available
    if (player.photoURL) {
        try {
            // Cache-busting for tier up banner
            const photoUrlWithCacheBust = player.photoURL.includes('?') 
                ? `${player.photoURL}&v=${Date.now()}` 
                : `${player.photoURL}?v=${Date.now()}`;
                
            const bannerImg = await loadImage(photoUrlWithCacheBust);
            ctx.save();
            if ('filter' in ctx) {
                ctx.filter = 'blur(40px)';
            }
            
            const aspect = bannerImg.width / bannerImg.height;
            let drawW = CARD_WIDTH;
            let drawH = CARD_WIDTH / aspect;
            if (drawH < CARD_HEIGHT) {
                drawH = CARD_HEIGHT;
                drawW = CARD_HEIGHT * aspect;
            }
            
            ctx.globalAlpha = 0.2;
            ctx.drawImage(bannerImg, (CARD_WIDTH - drawW) / 2, (CARD_HEIGHT - drawH) / 2, drawW, drawH);
            ctx.globalAlpha = 1.0;
            if ('filter' in ctx) {
                ctx.filter = 'none';
            }
            ctx.restore();
        } catch (e) {
            console.error("Tier up banner image failed:", e);
        }
    }

    const newTierHsla = newTierColor.replace('hsl', 'hsla').replace(')', ', 0.3)');
    const gradient = ctx.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT / 2, 0, CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_WIDTH);
    gradient.addColorStop(0, newTierHsla);
    gradient.addColorStop(1, COLORS.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Sparkles
    ctx.fillStyle = 'rgba(255, 255, 224, 0.4)';
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * CARD_WIDTH;
        const y = Math.random() * CARD_HEIGHT;
        const size = Math.random() * 4 + 1;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Header Content
    const contentPadding = 80;
    try {
        const logoImg = await loadImage('/logopadel.png');
        ctx.drawImage(logoImg, contentPadding, 60, 100, 100);
    } catch (e) {}
    ctx.textAlign = 'left';
    ctx.font = 'bold 64px "Space Grotesk"';
    ctx.fillStyle = COLORS.foreground;
    ctx.fillText('PADEL HORE', contentPadding + 110, 130);

    // 3. Main Text
    ctx.textAlign = 'center';
    ctx.font = 'bold 100px "Space Grotesk"';
    ctx.fillStyle = COLORS.primary;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText('LEVEL UP!', CARD_WIDTH / 2, 350);
    ctx.shadowBlur = 0;

    ctx.font = '500 50px "Inter"';
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
    let avatarLoaded = false;
    if (player.photoURL) {
        try {
            // Cache-busting for tier up avatar
            const avatarUrlWithCacheBust = player.photoURL.includes('?') 
                ? `${player.photoURL}&v=${Date.now()}` 
                : `${player.photoURL}?v=${Date.now()}`;
                
            const avatarImg = await loadImage(avatarUrlWithCacheBust);
            ctx.save();
            ctx.beginPath();
            ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, CARD_WIDTH / 2 - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
            avatarLoaded = true;
        } catch (e) {}
    }

    if (!avatarLoaded) {
        ctx.fillStyle = COLORS.card;
        ctx.beginPath();
        ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.font = 'bold 180px "Inter"';
        ctx.fillStyle = COLORS.mutedForeground;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player?.name?.charAt(0)?.toUpperCase() || 'U', CARD_WIDTH / 2, avatarY);
        ctx.textBaseline = 'alphabetic';
    }
    
    // Avatar Ring
    ctx.beginPath();
    ctx.arc(CARD_WIDTH / 2, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.strokeStyle = newTierColor;
    ctx.lineWidth = 20;
    ctx.stroke();

    // 6. Player Name & CTA
    let nameY = 1280;
    ctx.font = 'bold 80px "Space Grotesk"';
    ctx.fillStyle = COLORS.foreground;
    ctx.textAlign = 'center';
    const nameToDraw = (player.name || 'Unknown User').toUpperCase();
    const nameLines = wrapText(ctx, nameToDraw, CARD_WIDTH - 160);
    const nameLineHeight = 80 * 1.1;
    nameY -= (nameLines.length - 1) * nameLineHeight / 2;
    nameLines.forEach((line, index) => {
        ctx.fillText(line, CARD_WIDTH / 2, nameY + index * nameLineHeight);
    });

    ctx.font = '400 40px "Inter"';
    ctx.fillStyle = COLORS.mutedForeground;
    ctx.fillText(`The grind never stops!`, CARD_WIDTH / 2, 1400);

    ctx.font = 'bold 48px "Inter"';
    ctx.fillStyle = COLORS.primary;
    ctx.fillText('Challenge me on the court!', CARD_WIDTH / 2, 1600);

    // 7. Social Tag
    ctx.font = '36px "Inter"';
    ctx.fillStyle = COLORS.mutedForeground;
    ctx.textAlign = 'center';
    ctx.fillText('#PadelHoreClub #LevelUp', CARD_WIDTH / 2, 1790);
}
