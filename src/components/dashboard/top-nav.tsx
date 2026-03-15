'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECONDARY_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/library', label: 'Library' },
  { href: '/read', label: 'Read' },
];

interface TopNavProps {
  dueCount: number;
}

export function TopNav({ dueCount }: TopNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <nav className="flex items-center gap-1" aria-label="Main navigation">
      {SECONDARY_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'px-2.5 py-1.5 rounded-lg text-[13px] transition-colors',
            isActive(href)
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </Link>
      ))}

      <div className="flex-1 min-w-3" />

      <Link
        href="/capture"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-primary-foreground bg-primary transition-all hover:bg-primary/90 active:scale-[0.97]"
      >
        <Camera className="h-3.5 w-3.5" />
        Capture
      </Link>

      <Link
        href="/review"
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
          isActive('/review')
            ? 'text-foreground bg-foreground/[0.05]'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <GraduationCap className="h-4 w-4" />
        Review
        {dueCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 leading-none"
          >
            {dueCount > 99 ? '99+' : dueCount}
          </span>
        )}
      </Link>
    </nav>
  );
}
