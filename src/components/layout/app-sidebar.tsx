'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { TIER_FRAME_CLASSES } from '@/lib/constants';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { getAuth, signOut } from 'firebase/auth';
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Notifications } from './notifications';
import { Award, BarChart3, History, LogIn, LogOut, User, Users, Send, PlusSquare, PanelLeft, MapPin, QrCode, Gem, Info, Trophy, CalendarCheck, SlidersHorizontal, Settings, Calendar, CalendarDays, Store, Receipt, Swords } from 'lucide-react';
import { SidebarTrigger } from '../ui/sidebar';
import { cn } from '@/lib/utils';
import React, { useMemo } from 'react';

const DEFAULT_ADMIN_UID = "sWO5cXkN9CcuwyhLTG3gfUmY0HH2";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const { open, openMobile, setOpenMobile, state, toggleSidebar, isMobile } = useSidebar();
  const auth = getAuth();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
  const isAdmin = userProfile?.role === 'admin' || isDefaultAdmin;

  React.useEffect(() => {
    if (userProfile && firestore && user) {
      const { role, membershipExpiryDate, uid, isUnlimitedMember } = userProfile;

      // Only run this logic for members whose role hasn't been downgraded yet
      if (role === 'member' && !isUnlimitedMember && membershipExpiryDate) {
        const expiry = membershipExpiryDate.toDate();
        const now = new Date();
        
        if (expiry < now) {
          const handleExpiry = async () => {
            const userRef = doc(firestore, 'users', uid);
            const notifRef = doc(collection(firestore, 'users', uid, 'notifications'));

            const batch = writeBatch(firestore);

            // Update role to non-member
            batch.update(userRef, { role: 'non-member' });

            // Send notification
            batch.set(notifRef, {
              uid,
              title: "Keanggotaan Anda Telah Berakhir",
              body: "Keanggotaan Padel Hore Anda telah berakhir. Perpanjang sekarang untuk terus menikmati keuntungan eksklusif.",
              timestamp: Timestamp.now(),
              isRead: false,
              link: '/membership',
              icon: 'Hourglass'
            });

            try {
              await batch.commit();
            } catch (error) {
              console.error("Failed to process membership expiry:", error);
            }
          };

          handleExpiry();
        }
      }
    }
  }, [userProfile, firestore, user]);

  const handleSignOut = () => {
      signOut(auth);
  }
  
  const handleLinkClick = () => {
    if (openMobile) {
        setOpenMobile(false);
    }
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4 border-b border-sidebar-border">
            <Link href="/" className="flex items-center gap-3">
                <Logo className="w-10 h-10 flex-shrink-0"/>
                <div className="group-data-[collapsible=icon]:hidden">
                    <h2 className="font-black text-base uppercase tracking-wider">
                        PADEL <span className="text-primary">HORE</span>
                    </h2>
                    <p className="text-xs text-muted-foreground -mt-1 font-bold tracking-wider">ELITE EXPERIENCE</p>
                </div>
            </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel>GENERAL</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/'} tooltip={{ children: 'Leaderboard' }} suppressHydrationWarning >
                        <Link href="/" onClick={handleLinkClick}><BarChart3 /><span>Leaderboard</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/matches')} tooltip={{ children: 'Match History' }} suppressHydrationWarning >
                        <Link href="/matches" onClick={handleLinkClick}><History /><span>Match History</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/shop')} tooltip={{ children: 'Shop' }} suppressHydrationWarning >
                        <Link href="/shop" onClick={handleLinkClick}><Store /><span>Shop</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/events')} tooltip={{ children: 'Events' }} suppressHydrationWarning>
                        <Link href="/events" onClick={handleLinkClick}><Calendar /><span>Events</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/badges')} tooltip={{ children: 'Badges' }} suppressHydrationWarning>
                        <Link href="/badges" onClick={handleLinkClick}><Award /><span>Badges</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/point-system')} tooltip={{ children: 'Point System' }} suppressHydrationWarning>
                        <Link href="/point-system" onClick={handleLinkClick}><Info /><span>Point System</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/tiers')} tooltip={{ children: 'Hierarchy Tier' }} suppressHydrationWarning>
                        <Link href="/tiers" onClick={handleLinkClick}><Trophy /><span>Hierarchy Tier</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarGroupContent>
            </SidebarGroup>
            
            {isUserLoading || (user && isProfileLoading) ? (
              <SidebarGroup>
                  <SidebarGroupLabel>MANAGEMENT</SidebarGroupLabel>
                  <SidebarGroupContent>
                     <Skeleton className="h-8 w-full rounded-md mt-1" />
                     <Skeleton className="h-8 w-full rounded-md mt-1" />
                  </SidebarGroupContent>
              </SidebarGroup>
            ) : isAdmin && (
              <SidebarGroup>
                  <SidebarGroupLabel>MANAGEMENT</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/players')} tooltip={{ children: 'Manage Users' }} suppressHydrationWarning >
                            <Link href="/admin/players" onClick={handleLinkClick}><Users /><span>Manage Users</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/courts')} tooltip={{ children: 'Manage Courts' }} suppressHydrationWarning >
                            <Link href="/admin/courts" onClick={handleLinkClick}><MapPin /><span>Manage Courts</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/notifications')} tooltip={{ children: 'Send Notification' }} suppressHydrationWarning >
                            <Link href="/admin/notifications" onClick={handleLinkClick}><Send /><span>Send Notification</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/seasons')} tooltip={{ children: 'Manage Seasons' }} suppressHydrationWarning >
                            <Link href="/admin/seasons" onClick={handleLinkClick}><CalendarCheck /><span>Manage Seasons</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/events')} tooltip={{ children: 'Manage Events' }} suppressHydrationWarning >
                            <Link href="/admin/events" onClick={handleLinkClick}><CalendarDays /><span>Manage Events</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/event-matches')} tooltip={{ children: 'Event Matches' }} suppressHydrationWarning>
                            <Link href="/admin/event-matches" onClick={handleLinkClick}><Swords /><span>Event Matches</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/shop')} tooltip={{ children: 'Manage Shop' }} suppressHydrationWarning >
                            <Link href="/admin/shop" onClick={handleLinkClick}><Store /><span>Manage Shop</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/orders')} tooltip={{ children: 'Manage Orders' }} suppressHydrationWarning >
                            <Link href="/admin/orders" onClick={handleLinkClick}><Receipt /><span>Manage Orders</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/settings')} tooltip={{ children: 'App Settings' }} suppressHydrationWarning >
                            <Link href="/admin/settings" onClick={handleLinkClick}><Settings /><span>App Settings</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/tier-settings')} tooltip={{ children: 'Tier Settings' }} suppressHydrationWarning >
                            <Link href="/admin/tier-settings" onClick={handleLinkClick}><SlidersHorizontal /><span>Tier Settings</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="flex flex-col gap-2 p-2 mt-auto">
          <SidebarMenu className="p-0">
              <SidebarMenuItem>
                  <Notifications onClick={handleLinkClick} />
              </SidebarMenuItem>
          </SidebarMenu>
          
          <UserMenu 
            onSignOut={handleSignOut} 
            userProfile={userProfile} 
            isProfileLoading={isProfileLoading}
            isMobile={isMobile} 
            onLinkClick={handleLinkClick} 
          />
          
          <SidebarMenu className="p-0">
            <SidebarMenuItem>
                <SidebarMenuButton onClick={toggleSidebar} variant="outline" className="w-full justify-start">
                    <PanelLeft className={cn("transition-transform duration-300", state === 'collapsed' && 'rotate-180')}/>
                    <span className="group-data-[collapsible=icon]:hidden">Collapse Menu</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

function UserMenu({ onSignOut, userProfile, isProfileLoading, isMobile, onLinkClick }: { 
    onSignOut: () => void; 
    userProfile: UserProfile | null | undefined; 
    isProfileLoading: boolean;
    isMobile: boolean; 
    onLinkClick: () => void;
}) {
    const { user, isUserLoading } = useUser();
    const isDefaultAdmin = user?.uid === DEFAULT_ADMIN_UID;
    
    const displayProfile = useMemo(() => {
        if (!user) return null;

        if (!userProfile) {
            if (isDefaultAdmin) {
                return {
                    uid: user.uid, name: 'Padel Hore Admin', email: user.email || 'admin@padel-hore.com',
                    tier: 'silver' as const, phId: 'PH-ADMIN', role: 'admin' as const, photoURL: null,
                    total_points: 0, win_count: 0, match_count: 0, win_streak: 0, whatsapp: '',
                    showWhatsapp: false, fcmTokens: [], badges: [],
                } as UserProfile;
            }
            return {
                uid: user.uid, name: user.displayName || user.email || "User", email: user.email || "",
                tier: 'beginner' as const, role: 'non-member' as const, photoURL: user.photoURL,
                total_points: 0, win_count: 0, match_count: 0, win_streak: 0, whatsapp: '',
                showWhatsapp: false, fcmTokens: [], badges: [],
            } as UserProfile;
        }

        if (isDefaultAdmin && !userProfile.name) {
            return { ...userProfile, name: 'Padel Hore Admin', email: user.email };
        }

        return userProfile;
    }, [user, userProfile, isDefaultAdmin]);


    if (isUserLoading || (user && isProfileLoading)) {
        return (
            <div className="flex items-center gap-3 p-2 rounded-md bg-sidebar-accent/50">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="flex-1 group-data-[collapsible=icon]:hidden space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
        )
    }

    if (user && displayProfile) {
        return (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 p-2 w-full text-left cursor-pointer bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-md group-data-[collapsible=icon]:justify-center">
                        <Avatar className="w-9 h-9">
                            <AvatarImage src={displayProfile.photoURL || ''} alt={displayProfile.name || ''} />
                            <AvatarFallback>{displayProfile?.name?.charAt(0) || user.email?.charAt(0) || 'A'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                            <span className="text-sm font-semibold truncate">{displayProfile.name}</span>
                            <span className="text-xs text-sidebar-foreground/70 truncate">{displayProfile.email}</span>
                        </div>
                        <LogOut className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-56 mb-2">
                     <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{displayProfile.name}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {displayProfile.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <DropdownMenuItem asChild>
                        <Link href={isDefaultAdmin ? "/admin" : "/profile"} onClick={onLinkClick}>
                            <User className="mr-2 h-4 w-4" />
                            <span>{isDefaultAdmin ? "Admin Home" : "Profile"}</span>
                        </Link>
                    </DropdownMenuItem>
                    
                    {!isDefaultAdmin && (
                        <>
                            <DropdownMenuItem asChild>
                                <Link href="/my-orders" onClick={onLinkClick}>
                                    <Receipt className="mr-2 h-4 w-4" />
                                    <span>My Orders</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/profile/card" onClick={onLinkClick}>
                                    <QrCode className="mr-2 h-4 w-4" />
                                    <span>My Card</span>
                                </Link>
                            </DropdownMenuItem>
                            {displayProfile.role !== 'admin' && (
                                <DropdownMenuItem asChild>
                                    <Link href="/membership" onClick={onLinkClick}>
                                        <Gem className="mr-2 h-4 w-4" />
                                        <span>Membership</span>
                                    </Link>
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    <DropdownMenuItem onClick={() => { onSignOut(); onLinkClick(); }}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return (
        <SidebarMenu className="p-0">
            <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={{children: 'Login'}}>
                    <Link href="/login" onClick={onLinkClick}>
                        <LogIn/>
                        <span className="group-data-[collapsible=icon]:hidden">Login</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

    