import { SidebarInset } from '@/components/ui/sidebar';
import { MatchHistoryClient } from './match-history-client';

export default function MatchHistoryPage() {
  return (
    <SidebarInset>
        <div className="p-2 sm:p-6 lg:p-8">
            <div className='flex justify-between items-center mb-4'>
                <h1 className="font-black text-2xl uppercase tracking-widest">Match History</h1>
            </div>
            <MatchHistoryClient />
        </div>
    </SidebarInset>
  );
}
