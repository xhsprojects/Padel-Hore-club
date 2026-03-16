import { EventListClient } from './event-list-client';

export default function EventsPage() {
  return (
    <div className="p-2 sm:p-6 lg:p-8">
        <div className='flex justify-between items-center mb-4'>
            <h1 className="font-black text-2xl uppercase tracking-widest">Club Events</h1>
        </div>
        <EventListClient />
    </div>
  );
}
