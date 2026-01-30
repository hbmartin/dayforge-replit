import { Toaster } from 'sonner';
import { TRPCProvider } from '@/lib/trpc/provider';
import { ThemeProvider } from 'next-themes';
import { JournalSidebar } from '@/components/journal/sidebar';
import '@/app/globals.css';

export const metadata = {
  title: 'Structured Journal',
  description: 'A notebook that listens—then helps you process and act when you choose.',
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TRPCProvider>
        <div className="flex h-dvh bg-amber-50 dark:bg-stone-950">
          <JournalSidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
        <Toaster position="top-center" />
      </TRPCProvider>
    </ThemeProvider>
  );
}
