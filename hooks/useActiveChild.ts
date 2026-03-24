
import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ChildProfile } from '../types';

const STORAGE_KEY = 'tiny_closet_active_child';

export function useActiveChild() {
  const profiles = useLiveQuery(() => db.profile.toArray());
  const [activeChildId, setActiveChildIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  // Resolve the active child from profiles
  useEffect(() => {
    if (!profiles || profiles.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    const storedId = stored ? parseInt(stored, 10) : null;

    // Check if stored ID is valid
    const validProfile = storedId !== null && profiles.find(p => p.id === storedId);

    if (validProfile) {
      setActiveChildIdState(storedId);
    } else {
      // Default to first profile
      const firstId = profiles[0].id!;
      localStorage.setItem(STORAGE_KEY, String(firstId));
      setActiveChildIdState(firstId);
    }
  }, [profiles]);

  const setActiveChildId = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setActiveChildIdState(id);
  }, []);

  const cycleToNextChild = useCallback(() => {
    if (!profiles || profiles.length <= 1) return;
    const currentIndex = profiles.findIndex(p => p.id === activeChildId);
    const nextIndex = (currentIndex + 1) % profiles.length;
    const nextId = profiles[nextIndex].id!;
    setActiveChildId(nextId);
  }, [profiles, activeChildId, setActiveChildId]);

  const activeChild: ChildProfile | undefined = profiles?.find(p => p.id === activeChildId) || profiles?.[0];

  return {
    profiles: profiles || [],
    activeChild,
    activeChildId: activeChild?.id ?? null,
    setActiveChildId,
    cycleToNextChild,
  };
}
