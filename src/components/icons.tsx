
import type { SVGProps } from 'react';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logopadel.png"
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
