
import { firestore } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ChildProfile } from '../types';

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

// Get or create family ID, stored in both cookie and localStorage as backup
export function getFamilyId(): string {
  // Try cookie first (most persistent on iOS)
  let id = getCookie(COOKIE_KEY);
  if (id) {
    // Also update localStorage as backup
    try { localStorage.setItem(COOKIE_KEY, id); } catch {}
    return id;
  }

  // Try localStorage as fallback
  try {
    id = localStorage.getItem(COOKIE_KEY);
    if (id) {
      setCookie(COOKIE_KEY, id);
      return id;
    }
  } catch {}

  // Generate new ID
  id = generateFamilyId();
  setCookie(COOKIE_KEY, id);
  try { localStorage.setItem(COOKIE_KEY, id); } catch {}
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

// Restore profiles from Firestore — returns null if nothing found
export async function restoreProfilesFromCloud(): Promise<ChildProfile[] | null> {
  const familyId = getFamilyId();
  // If the family ID was just generated (no prior data), skip the fetch
  if (!getCookie(COOKIE_KEY) && !localStorage.getItem(COOKIE_KEY)) {
    return null;
  }

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
