'use client';

import dynamic from 'next/dynamic';

const Timeline = dynamic(
  () => import('@/components/journal/timeline').then(mod => mod.Timeline),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-400 dark:text-stone-500">Loading timeline...</div>
      </div>
    )
  }
);

export default function TimelinePage() {
  return (
    <div className="h-full flex flex-col p-6">
      <h1 className="text-2xl font-serif text-stone-800 dark:text-stone-200 mb-6">
        Timeline
      </h1>
      <Timeline />
    </div>
  );
}
