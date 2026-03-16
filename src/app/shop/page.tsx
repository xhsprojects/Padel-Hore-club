import { ShopClient } from './shop-client';

export default function ShopPage() {
  return (
    <div className="p-2 sm:p-6 lg:p-8">
        <div className='flex justify-between items-center mb-4'>
            <h1 className="font-black text-2xl uppercase tracking-widest">Club Shop</h1>
        </div>
        <ShopClient />
    </div>
  );
}
