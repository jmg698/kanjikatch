'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera, GraduationCap, BookOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'ホーム', labelEn: 'Home' },
  { href: '/capture', icon: Camera, label: 'キャプチャ', labelEn: 'Capture' },
  { href: '/review', icon: GraduationCap, label: '復習', labelEn: 'Review' },
  { href: '/library', icon: BookOpen, label: 'ライブラリ', labelEn: 'Library' },
  { href: '/read', icon: FileText, label: '読む', labelEn: 'Read' },
];

interface BottomNavProps {
  dueCount: number;
}

export function BottomNav({ dueCount }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/92 backdrop-blur-md"
      style={{ borderColor: 'hsl(35 15% 87%)' }}
    >
      <div className="flex items-stretch h-[60px] max-w-screen-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, labelEn }) => {
          const isReview = href === '/review';
          const active =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-150',
                active
                  ? 'text-primary'
                  : 'text-stone-400 hover:text-stone-600'
              )}
            >
              {/* Active indicator bar at top */}
              <span
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200',
                  active ? 'w-8 bg-primary' : 'w-0'
                )}
              />

              {/* Icon — review gets a badge */}
              <span className="relative">
                <Icon
                  className={cn(
                    'transition-transform duration-150',
                    active ? 'scale-110' : 'scale-100',
                    isReview ? 'h-[22px] w-[22px]' : 'h-5 w-5'
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {isReview && dueCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold px-1 leading-none">
                    {dueCount > 99 ? '99+' : dueCount}
                  </span>
                )}
              </span>

              <span
                className={cn(
                  'text-[10px] font-medium leading-none transition-opacity',
                  active ? 'opacity-100' : 'opacity-60'
                )}
              >
                {labelEn}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
