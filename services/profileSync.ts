
import { firestore } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { ChildProfile } from '../types';
import { getStoredAppleUserId } from './appleAuth';

const COOKIE_KEY = 'tiny_closet_family_id';

// Generate a random family ID
function generateFamilyId(): string {
  return 'fam_' + crypto.randomUUID();
}

// Cookie helpers — cookies survive iOS storage purges better than localStorage/IndexedDB
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  // 10-year expiry, SameSite=Strict for security
  const maxAge = 10 * 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

// Extract family ID from URL hash (e.g., /#/?fid=fam_xxx or /#/closet?fid=fam_xxx)
function getFamilyIdFromUrl(): string | null {
  try {
    const hash = window.location.hash; // e.g., "#/?fid=fam_xxx"
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex));
    const fid = params.get('fid');
    return fid && (fid.startsWith('fam_') || fid.startsWith('apple_')) ? fid : null;
  } catch { return null; }
}

// Write family ID into the URL hash so it survives iOS storage wipes
export function embedFamilyIdInUrl(id: string) {
  try {
    const hash = window.location.hash || '#/';
    const qIndex = hash.indexOf('?');
    const basePath = qIndex === -1 ? hash : hash.slice(0, qIndex);
    const params = qIndex === -1 ? new URLSearchParams() : new URLSearchParams(hash.slice(qIndex));
    params.set('fid', id);
    window.history.replaceState(null, '', `${basePath}?${params.toString()}`);
  } catch {}
}

// Link an Apple user ID as the family identifier — migrates existing data if needed
export async function linkAppleUserId(appleUserId: string): Promise<void> {
  const oldId = getCookie(COOKIE_KEY) || localStorage.getItem(COOKIE_KEY) || getFamilyIdFromUrl();
  const newId = 'apple_' + appleUserId;

  // Store the new Apple-based family ID everywhere
  setCookie(COOKIE_KEY, newId);
  try { localStorage.setItem(COOKIE_KEY, newId); } catch {}
  embedFamilyIdInUrl(newId);

  // Migrate old family data to the new Apple-based ID
  if (oldId && oldId !== newId) {
    try {
      const oldSnap = await getDoc(doc(firestore, 'families', oldId));
      if (oldSnap.exists()) {
        await setDoc(doc(firestore, 'families', newId), oldSnap.data());
      }
    } catch (err) {
      console.warn('Family data migration failed (non-critical):', err);
    }
  }
}

// Get or create family ID, stored in cookie + localStorage + URL as backups
export function getFamilyId(): string {
  // Check for Apple user ID first (most reliable)
  const appleUserId = getStoredAppleUserId();
  if (appleUserId) {
    const appleId = 'apple_' + appleUserId;
    setCookie(COOKIE_KEY, appleId);
    try { localStorage.setItem(COOKIE_KEY, appleId); } catch {}
    embedFamilyIdInUrl(appleId);
    return appleId;
  }

  // Try cookie first (most persistent on iOS)
  let id = getCookie(COOKIE_KEY);
  if (id) {
    // Also update localStorage + URL as backup
    try { localStorage.setItem(COOKIE_KEY, id); } catch {}
    embedFamilyIdInUrl(id);
    return id;
  }

  // Try localStorage as fallback
  try {
    id = localStorage.getItem(COOKIE_KEY);
    if (id) {
      setCookie(COOKIE_KEY, id);
      embedFamilyIdInUrl(id);
      return id;
    }
  } catch {}

  // Try URL hash as last resort (survives complete iOS storage wipe)
  id = getFamilyIdFromUrl();
  if (id) {
    setCookie(COOKIE_KEY, id);
    try { localStorage.setItem(COOKIE_KEY, id); } catch {}
    return id;
  }

  // Generate new ID
  id = generateFamilyId();
  setCookie(COOKIE_KEY, id);
  try { localStorage.setItem(COOKIE_KEY, id); } catch {}
  embedFamilyIdInUrl(id);
  return id;
}

// Sync all profiles to Firestore
export async function syncProfilesToCloud(profiles: ChildProfile[]): Promise<void> {
  const familyId = getFamilyId();
  try {
    await setDoc(doc(firestore, 'families', familyId), {
      profiles: profiles.map(p => ({
        localId: p.id,
        name: p.name,
        birthDate: p.birthDate,
        avatar: p.avatar || null,
      })),
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Profile cloud sync failed (non-critical):', err);
  }
}

// Delete all cloud data and clear all local identifiers
export async function deleteAllAccountData(): Promise<void> {
  // 1. Delete cloud data
  const familyId = getCookie(COOKIE_KEY) || localStorage.getItem(COOKIE_KEY) || getFamilyIdFromUrl();
  if (familyId) {
    try {
      await deleteDoc(doc(firestore, 'families', familyId));
    } catch (err) {
      console.warn('Cloud data deletion failed:', err);
    }
  }

  // 2. Clear all cookies
  const cookiesToClear = [COOKIE_KEY, 'tiny_closet_onboarded', 'tiny_closet_apple_user'];
  for (const name of cookiesToClear) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }

  // 3. Clear localStorage
  localStorage.clear();

  // 4. Remove family ID from URL
  try {
    const hash = window.location.hash || '#/';
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const basePath = hash.slice(0, qIndex);
      window.history.replaceState(null, '', basePath);
    }
  } catch {}
}

// Restore profiles from Firestore — returns null if nothing found
export async function restoreProfilesFromCloud(): Promise<ChildProfile[] | null> {
  // Check if we have an existing family ID BEFORE calling getFamilyId (which would generate one)
  const existingId = getCookie(COOKIE_KEY) || localStorage.getItem(COOKIE_KEY) || getFamilyIdFromUrl();
  if (!existingId) {
    return null; // No prior family ID anywhere — truly new user
  }
  const familyId = getFamilyId(); // This will use the existing ID we just found

  try {
    const snap = await getDoc(doc(firestore, 'families', familyId));
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data?.profiles?.length) return null;

    return data.profiles.map((p: any) => ({
      name: p.name,
      birthDate: p.birthDate,
      avatar: p.avatar || undefined,
    }));
  } catch (err) {
    console.warn('Profile cloud restore failed (non-critical):', err);
    return null;
  }
}
