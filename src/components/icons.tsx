
import type { SVGProps } from 'react';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="https://firebasestorage.googleapis.com/v0/b/padel-hore.firebasestorage.app/o/logo-app-hore-padel.png?alt=media&token=2f2017a9-3908-4b53-9dc0-a19d6b63e0e6"
      alt="Padel Hore Club Logo"
      width={64}
      height={64}
      priority
      className={className}
    />
  );
}

export function Crown(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M5,16L3,5L8.5,10L12,4L15.5,10L21,5L19,16H5M19,19H5V18H19V19Z" />
        </svg>
    );
}
