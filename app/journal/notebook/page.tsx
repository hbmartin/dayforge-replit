'use client';

import dynamic from 'next/dynamic';

const NotebookEditor = dynamic(
  () => import('@/components/journal/notebook-editor').then(mod => mod.NotebookEditor),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-amber-50 dark:bg-stone-950">
        <div className="text-stone-400 dark:text-stone-500">Loading editor...</div>
      </div>
    )
  }
);

export default function NotebookPage() {
  return (
    <div className="h-full flex flex-col">
      <NotebookEditor />
    </div>
  );
}
