'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TabIcon } from '@/lib/icons';

export default function Nav() {
  const path = usePathname() ?? '';
  const board = path.startsWith('/home');
  const house = path.startsWith('/household') || path.startsWith('/chores');
  const feed = path.startsWith('/activity');

  return (
    <nav className="nav">
      <Link href="/home" data-on={board} prefetch>
        <TabIcon kind="board" on={board} />
        Board
      </Link>
      <Link href="/household" data-on={house} prefetch>
        <TabIcon kind="household" on={house} />
        Household
      </Link>
      <Link href="/activity" data-on={feed} prefetch>
        <TabIcon kind="activity" on={feed} />
        Activity
      </Link>
    </nav>
  );
}
