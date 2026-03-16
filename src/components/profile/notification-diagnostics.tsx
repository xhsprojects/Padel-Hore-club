'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Info, RefreshCw, Bell, Terminal } from 'lucide-react';
import { isSupported, requestNotificationPermission } from '@/firebase/messaging';
import { useFirebase } from '@/firebase';

interface DiagnosticState {
    isSecure: boolean;
    hasServiceWorker: boolean;
    hasNotificationAPI: boolean;
    hasPushManager: boolean;
    isStandalone: boolean;
    permission: string;
    fcmSupported: boolean | null;
    swStatus: string;
    vapidKeyPreview: string;
    currentToken: string | null;
    firestoreTokenCount: number;
}

export function NotificationDiagnostics({ userId, firestore }: { userId: string, firestore: any }) {
    const [diagnostics, setDiagnostics] = useState<DiagnosticState | null>(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const { getDoc, doc } = useFirebase();

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
    };

    const runDiagnostics = async () => {
        setLoading(true);
        addLog("Menjalankan diagnosa...");
        
        const state: DiagnosticState = {
            isSecure: typeof window !== 'undefined' && window.isSecureContext,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasNotificationAPI: 'Notification' in window,
            hasPushManager: 'PushManager' in window,
            isStandalone: window.matchMedia('(display-mode: standalone)').matches,
            permission: 'Notification' in window ? (Notification as any).permission : 'unsupported',
            fcmSupported: null,
            swStatus: 'checking...',
            vapidKeyPreview: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ? 
                `${process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY.substring(0, 5)}...` : 
                'MISSING',
            currentToken: null,
            firestoreTokenCount: 0
        };

        try {
            state.fcmSupported = await isSupported();
            const registrations = await navigator.serviceWorker.getRegistrations();
            state.swStatus = registrations.length > 0 ? `${registrations.length} registered` : 'none';
            
            if (firestore && userId) {
                const userDoc = await getDoc(doc(firestore, 'users', userId));
                if (userDoc.exists()) {
                    state.firestoreTokenCount = userDoc.data()?.fcmTokens?.length || 0;
                }
            }
        } catch (e) {
            addLog(`Error diagnosa: ${e instanceof Error ? e.message : String(e)}`);
        }

        setDiagnostics(state);
        setLoading(false);
        addLog("Diagnosa selesai.");
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    const handleEnable = async () => {
        setLoading(true);
        addLog("Mulai proses 'Enable'...");
        try {
            const result = await requestNotificationPermission(userId, firestore);
            if (result.success) {
                addLog(`BERHASIL: Token didapat (${result.token?.substring(0, 6)}...)`);
            } else {
                addLog(`GAGAL: ${result.error}`);
            }
            await runDiagnostics();
        } catch (e) {
            addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setLoading(false);
        }
    };

    if (!diagnostics) return null;

    const StatusIcon = ({ val }: { val: boolean }) => val ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Push Notification Diagnostics
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                        {diagnostics.firestoreTokenCount} tokens in DB
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>HTTPS / Secure Context</span>
                        <StatusIcon val={diagnostics.isSecure} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>PWA / Standalone</span>
                        <StatusIcon val={diagnostics.isStandalone} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>Notification API</span>
                        <StatusIcon val={diagnostics.hasNotificationAPI} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>Push Manager API</span>
                        <StatusIcon val={diagnostics.hasPushManager} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>Service Worker Support</span>
                        <StatusIcon val={diagnostics.hasServiceWorker} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>FCM Library Supported</span>
                        <StatusIcon val={!!diagnostics.fcmSupported} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-background/50">
                        <span>VAPID Key (env)</span>
                        <span className="font-mono text-[9px]">{diagnostics.vapidKeyPreview}</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs items-center">
                    <span className="text-muted-foreground">Permission:</span>
                    <Badge variant={diagnostics.permission === 'granted' ? 'default' : 'secondary'}>
                        {diagnostics.permission}
                    </Badge>
                    <span className="text-muted-foreground ml-2">SW:</span>
                    <span className="font-mono">{diagnostics.swStatus}</span>
                </div>

                {(!diagnostics.fcmSupported || diagnostics.permission !== 'granted') && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-2 items-start">
                        <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 leading-tight">
                            <b>Info iOS:</b> Pastikan Anda sudah "Add to Home Screen". Izin push hanya bisa diberikan jika PWA sudah terinstall.
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button size="sm" onClick={handleEnable} disabled={loading} className="flex-1">
                        {loading ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Bell className="h-3 w-3 mr-2" />}
                        {diagnostics.permission === 'granted' ? 'Refresh Token' : 'Enable Notifications'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={runDiagnostics} disabled={loading}>
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {logs.length > 0 && (
                    <div className="mt-2 p-2 rounded bg-zinc-950 text-[10px] font-mono text-zinc-400 max-h-40 overflow-y-auto">
                        <div className="flex items-center gap-1 mb-1 text-zinc-500">
                             <Terminal className="h-3 w-3" />
                             <span>LOGS:</span>
                        </div>
                        {logs.map((log, i) => (
                            <div key={i} className="py-0.5 border-b border-zinc-900 last:border-0">&gt; {log}</div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
            </CardContent>
        </Card>
    );
}
