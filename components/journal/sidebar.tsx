'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Calendar,
  Settings,
  Brain,
  Target,
  Moon,
  Heart,
  Lightbulb,
  FileEdit,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { href: '/journal/notebook', label: 'Notebook', icon: BookOpen },
  { href: '/journal/timeline', label: 'Timeline', icon: Calendar },
];

const sessionModes = [
  { mode: 'plan', label: 'Plan', icon: Target, color: 'text-blue-600' },
  { mode: 'reflect', label: 'Reflect', icon: Lightbulb, color: 'text-amber-600' },
  { mode: 'sleep', label: 'Sleep', icon: Moon, color: 'text-indigo-600' },
  { mode: 'lift', label: 'Lift', icon: Heart, color: 'text-rose-600' },
  { mode: 'clarity', label: 'Clarity', icon: Brain, color: 'text-emerald-600' },
  { mode: 'unpack', label: 'Unpack', icon: FileEdit, color: 'text-purple-600' },
  { mode: 'create', label: 'Create', icon: Sparkles, color: 'text-orange-600' },
];

export function JournalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-amber-200 dark:border-stone-800 bg-amber-100/50 dark:bg-stone-900/50 flex flex-col">
      <div className="p-4 border-b border-amber-200 dark:border-stone-800">
        <h1 className="text-xl font-serif font-semibold text-stone-800 dark:text-stone-200">
          Structured Journal
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Capture. Process. Act.
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-6">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-amber-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-amber-200/50 dark:hover:bg-stone-800/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div>
          <h3 className="px-3 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
            Sessions
          </h3>
          <div className="space-y-1">
            {sessionModes.map((session) => {
              const Icon = session.icon;
              return (
                <button
                  key={session.mode}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-amber-200/50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <Icon className={cn('h-4 w-4', session.color)} />
                  {session.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-amber-200 dark:border-stone-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-amber-200/50 dark:hover:bg-stone-800/50 transition-colors">
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
