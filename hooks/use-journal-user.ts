'use client';

import { useSession } from 'next-auth/react';

export function useJournalUser() {
  const { data: session, status } = useSession();
  
  const userId = session?.user?.id ?? 'offline-user';
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';
  
  return {
    userId,
    isAuthenticated,
    isLoading,
    session,
  };
}
