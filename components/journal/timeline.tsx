'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { listOfflineEntries } from '@/lib/offline/entries';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Target,
  Lightbulb,
  Moon,
  Heart,
  Brain,
  FileEdit,
  Sparkles,
} from 'lucide-react';
import { useJournalUser } from '@/hooks/use-journal-user';

const modeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  notebook: BookOpen,
  plan: Target,
  reflect: Lightbulb,
  sleep: Moon,
  lift: Heart,
  clarity: Brain,
  unpack: FileEdit,
  create: Sparkles,
};

const modeColors: Record<string, string> = {
  notebook: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  plan: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
  reflect: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
  sleep: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
  lift: 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400',
  clarity: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
  unpack: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
  create: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400',
};

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

export function Timeline() {
  const { userId } = useJournalUser();
  
  const entries = useLiveQuery(
    () => listOfflineEntries(userId),
    []
  );

  if (!entries || entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-600 dark:text-stone-400">
            No entries yet
          </h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-1">
            Start writing in the notebook to create your first entry.
          </p>
        </div>
      </div>
    );
  }

  const groupedEntries: Record<string, typeof entries> = {};
  for (const entry of entries) {
    const dateKey = format(entry.createdAt, 'yyyy-MM-dd');
    if (!groupedEntries[dateKey]) {
      groupedEntries[dateKey] = [];
    }
    groupedEntries[dateKey].push(entry);
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-8">
      {Object.entries(groupedEntries).map(([dateKey, dayEntries]) => (
        <div key={dateKey}>
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-3">
            {formatDateLabel(new Date(dateKey))}
          </h2>
          <div className="space-y-3">
            {dayEntries.map((entry) => {
              const Icon = modeIcons[entry.mode] || BookOpen;
              return (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-stone-900 rounded-lg border border-amber-200 dark:border-stone-800 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg', modeColors[entry.mode])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200 capitalize">
                          {entry.mode}
                        </span>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          entry.status === 'active' && 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
                          entry.status === 'completed' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
                          entry.status === 'abandoned' && 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
                        )}>
                          {entry.status}
                        </span>
                        {entry.syncStatus === 'pending' && (
                          <span className="text-xs text-amber-500">
                            Syncing...
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-stone-400 dark:text-stone-500 mt-1 block">
                        {format(entry.createdAt, 'h:mm a')}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
