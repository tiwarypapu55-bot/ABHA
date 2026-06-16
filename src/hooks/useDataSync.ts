import { useEffect, useRef } from 'react';

/**
 * Custom React Hook that automatically subscribes to real-time database changes (via Supabase Broadcast or Postgres Replication)
 * and triggers a reactive state refetch. This supports seamless live-sync of data across devices, mobiles, and desktops.
 * 
 * @param fetchData The data-fetching routine of the component.
 * @param deps Optional list of dependencies which, when altered, will also trigger a fetch.
 */
export function useDataSync(fetchData: () => void | Promise<void>, deps: any[] = []) {
  const fetchRef = useRef(fetchData);

  // Keep the reference up-to-date with the latest enclosure scope variables to prevent stale closures.
  useEffect(() => {
    fetchRef.current = fetchData;
  }, [fetchData]);

  // Execute on initial run or whenever dependencies alter.
  useEffect(() => {
    fetchRef.current();
  }, deps);

  // Subcribe to local/remote real-time database change events.
  useEffect(() => {
    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('useDataSync: Refreshing component state due to real-time database change event:', customEvent.detail);
      fetchRef.current();
    };

    window.addEventListener('supabase-data-sync', handleSync);
    return () => {
      window.removeEventListener('supabase-data-sync', handleSync);
    };
  }, []);
}
