
import Dexie, { type Table } from 'dexie';
import { ClothingItem, ChildProfile, OutfitLike, WeeklyPlan, ShopAccount, ShopPost, OutfitMatch } from './types';

class ClosetDatabase extends Dexie {
  items!: Table<ClothingItem, number>;
  profile!: Table<ChildProfile, number>;
  outfitLikes!: Table<OutfitLike, number>;
  weeklyPlans!: Table<WeeklyPlan, number>;
  shopAccounts!: Table<ShopAccount, number>;
  shopPosts!: Table<ShopPost, number>;
  outfitMatches!: Table<OutfitMatch, number>;

  constructor() {
    super('KidsClosetDB');
    (this as any).version(2).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived',
      profile: '++id, name',
      outfitLikes: '++id, *itemIds, style, date'
    });

    // Migration to rename Sleepwear -> Pajamas
    (this as any).version(3).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived'
    }).upgrade((trans: any) => {
        return trans.table("items").toCollection().modify((item: any) => {
            if (item.category === 'Sleepwear') {
                item.category = 'Pajamas';
            }
        });
    });

    // Version 4: Add dateArchived index
    (this as any).version(4).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived, dateArchived'
    });

    // Version 5: Add profileId to items and outfitLikes for multi-child support
    (this as any).version(5).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived, dateArchived, profileId',
      outfitLikes: '++id, *itemIds, style, date, profileId'
    }).upgrade(async (trans: any) => {
        // Get the first profile to assign existing items to
        const profiles = await trans.table("profile").toArray();
        const firstProfileId = profiles.length > 0 ? profiles[0].id : undefined;
        if (firstProfileId !== undefined) {
            await trans.table("items").toCollection().modify((item: any) => {
                if (!item.profileId) {
                    item.profileId = firstProfileId;
                }
            });
            await trans.table("outfitLikes").toCollection().modify((like: any) => {
                if (!like.profileId) {
                    like.profileId = firstProfileId;
                }
            });
        }
    });

    // Version 6: Add wearCount index for wear frequency tracking
    (this as any).version(6).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived, dateArchived, profileId, wearCount'
    });

    // Version 7: Add weeklyPlans table for weekly outfit planning
    (this as any).version(7).stores({
      weeklyPlans: '++id, profileId, date, &[profileId+date]'
    });

    // Version 8: Add shop inspiration tables
    (this as any).version(8).stores({
      shopAccounts: '++id, handle, profileId',
      shopPosts: '++id, shopAccountId, postUrl, &[shopAccountId+postUrl], isProcessed',
      outfitMatches: '++id, shopPostId, profileId'
    });
  }
}

export const db = new ClosetDatabase();

// Seed profile if empty
(db as any).on('populate', () => {
  db.profile.add({
    name: 'My Kid',
    birthDate: new Date().toISOString().split('T')[0] // Default to today
  });
});
