'use client';

import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile, AppSettings } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Gem, ShieldCheck, BarChart, Trophy, Star, Crown, MessageCircle, Gift, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function MembershipPage() {
    const { user, isUserLoading } = useUser();
    const { firestore } = useFirebase();
    const router = useRouter();

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
    
    const settingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'general');
    }, [firestore]);
    const { data: appSettings, isLoading: isSettingsLoading } = useDoc<AppSettings>(settingsRef);

    useEffect(() => {
        if (!isUserLoading && !isProfileLoading && (!user || !userProfile)) {
            router.push('/login');
        }
    }, [isUserLoading, isProfileLoading, user, userProfile, router]);
    
    const isLoading = isUserLoading || isProfileLoading || isSettingsLoading;

    if (isLoading || !user || !userProfile) {
        return (
            <SidebarInset>
                <div className="p-2 sm:p-6 lg:p-8">
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader className="text-center">
                            <Skeleton className="h-12 w-12 mx-auto" />
                            <Skeleton className="h-8 w-80 mx-auto mt-4" />
                            <Skeleton className="h-6 w-96 mx-auto mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <Skeleton className="h-24 w-full" />
                            <div className="grid md:grid-cols-2 gap-8">
                                <Skeleton className="h-80 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SidebarInset>
        );
    }
    
    const isMember = userProfile.role === 'member';
    const expiryDate = userProfile.membershipExpiryDate?.toDate();
    const isExpired = isMember && !userProfile.isUnlimitedMember && expiryDate && expiryDate < new Date();
    const isActive = isMember && (!!userProfile.isUnlimitedMember || (!!expiryDate && !isExpired));

    const phId = userProfile.phId || `PH-${userProfile.uid.substring(0, 4).toUpperCase()}`;
    const adminWhatsappNumber = appSettings?.membershipWhatsappNumber || "";

    const normalizeWaNumber = (numStr: string) => {
        if (!numStr) return '';
        let cleanNumber = numStr.replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) {
            return '62' + cleanNumber.substring(1);
        }
        return cleanNumber;
    };
    
    const normalizedAdminWaNumber = normalizeWaNumber(adminWhatsappNumber);

    const adminWhatsappUrl = normalizedAdminWaNumber
        ? `https://wa.me/${normalizedAdminWaNumber}?text=${encodeURIComponent(`Halo Admin Padel Hore, saya ${userProfile.name} dengan PH-ID ${phId} ingin mendaftar/memperpanjang keanggotaan Member.`)}`
        : '';


    const renderStatusCard = () => {
        const contactButton = (
            <Button asChild className="mt-4" disabled={!adminWhatsappUrl}>
                <a href={adminWhatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> Hubungi Admin
                </a>
            </Button>
        );

        if (isActive) {
            let messageElement;
            if (userProfile.isUnlimitedMember) {
                messageElement = 'Anda adalah member seumur hidup!';
            } else if (expiryDate) {
                messageElement = <>Keanggotaan Anda berlaku hingga <span className="font-bold text-foreground">{format(expiryDate, 'dd MMMM yyyy')}</span>.</>;
            } else {
                messageElement = 'Status keanggotaan Anda aktif.';
            }

            return (
                <Card className="bg-green-500/10 border-green-500 text-center p-6">
                    <CardTitle className="text-green-400">Membership Anda Aktif!</CardTitle>
                    <p className="text-muted-foreground mt-2">{messageElement}</p>
                </Card>
            );
        }

        if (isExpired) {
            return (
                <Card className="bg-destructive/10 border-destructive text-center p-6">
                    <CardTitle className="text-destructive">Keanggotaan Anda Telah Berakhir</CardTitle>
                    <p className="text-muted-foreground mt-2">Perpanjang sekarang untuk terus menikmati semua keuntungan eksklusif sebagai Member.</p>
                    {contactButton}
                </Card>
            );
        }

        // Default for Non-Members
        return (
             <Card className="bg-primary/10 border-primary text-center p-6">
                <CardTitle className="text-primary">Jadi Member Hari Ini!</CardTitle>
                <p className="text-muted-foreground mt-2">Ikuti langkah di bawah untuk upgrade akun Anda dan nikmati keuntungan eksklusif.</p>
                {contactButton}
            </Card>
        );
    };

    return (
        <SidebarInset>
            <div className="p-2 sm:p-6 lg:p-8">
                <Card className="max-w-4xl mx-auto">
                    <CardHeader className="text-center">
                        <Gem className="mx-auto h-12 w-12 text-primary" />
                        <CardTitle className="font-headline text-3xl mt-2">Padel Hore Membership</CardTitle>
                        <CardDescription className="text-lg">Buka Keuntungan Eksklusif & Maksimalkan Poin Anda!</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {renderStatusCard()}
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-xl mb-4">Keuntungan Member</h3>
                                 <p className="text-muted-foreground mb-4">
                                    Menjadi member di Padel Hore memberikan berbagai keuntungan eksklusif yang dirancang untuk meningkatkan pengalaman bermain dan loyalitas Anda. Berikut adalah rincian keuntungan utamanya:
                                </p>
                                <ul className="space-y-4">
                                    <BenefitItem icon={Star} title="Poin Partisipasi Lebih Tinggi" description="Setiap kali bertanding, member mendapatkan +10 poin, lebih tinggi dibandingkan non-member yang hanya mendapatkan +8 poin." />
                                    <BenefitItem icon={BarChart} title="Akses Statistik Mendalam" description="Member dapat melihat data performa pribadi yang detail, seperti persentase kemenangan (win rate), histori poin secara rinci, hingga partner bermain favorit." />
                                    <BenefitItem icon={ClipboardCheck} title="Prioritas Pendaftaran" description="Member mendapatkan prioritas atau slot lebih awal saat mendaftar turnamen atau acara khusus yang diadakan oleh klub." />
                                    <BenefitItem icon={Trophy} title="Akses Tier Tertinggi" description="Kenaikan peringkat ke tier eksklusif seperti silver atau gold beserta seluruh privilege-nya hanya dapat diaktifkan jika status pemain adalah member." />
                                    <BenefitItem icon={Gift} title="Keuntungan Tambahan" description="Mendapatkan akses ke coaching clinic gratis atau diskon khusus untuk pembelian merchandise dan booking lapangan sesuai dengan tier yang dicapai." />
                                    <BenefitItem icon={Crown} title="Identitas Digital Khusus" description="Kartu member digital pada profil aplikasi akan memiliki label 'MEMBER' yang mencolok dan badge tier yang menunjukkan prestise Anda di komunitas." />
                                </ul>
                            </div>
                             <div>
                                <h3 className="font-bold text-xl mb-4">Cara Bergabung</h3>
                                <ol className="list-decimal list-inside space-y-4">
                                    <li>
                                        <h4 className="font-semibold inline">Hubungi Admin</h4>
                                        <p className="text-muted-foreground text-sm pl-2">Klik tombol di atas atau kirim pesan WhatsApp ke admin kami untuk meminta keanggotaan.</p>
                                    </li>
                                     <li>
                                        <h4 className="font-semibold inline">Selesaikan Pembayaran</h4>
                                        <p className="text-muted-foreground text-sm pl-2">Admin akan memberikan detail pembayaran untuk biaya langganan.</p>
                                    </li>
                                     <li>
                                        <h4 className="font-semibold inline">Aktivasi</h4>
                                        <p className="text-muted-foreground text-sm pl-2">Setelah pembayaran dikonfirmasi, admin akan mengaktifkan status Member Anda langsung di sistem.</p>
                                    </li>
                                </ol>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarInset>
    );
}

function BenefitItem({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) {
    return (
        <li className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-semibold">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </li>
    );
}

    

    