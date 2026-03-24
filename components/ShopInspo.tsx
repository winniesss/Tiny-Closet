
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ShopAccount, ShopPost, AnalyzedShopItem, ClothingItem, Category } from '../types';
import { analyzeShopPost, matchItemsToCloset } from '../services/geminiService';
import { useActiveChild } from '../hooks/useActiveChild';
import { Plus, Loader2, X, RefreshCw, Check, ShoppingBag, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

// --- Add Account Sheet ---
const AddAccountSheet: React.FC<{
  onClose: () => void;
  onAdd: (handle: string) => void;
  loading: boolean;
  error: string | null;
}> = ({ onClose, onAdd, loading, error }) => {
  const [handle, setHandle] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mt-auto bg-orange-50 rounded-t-[2rem] p-6 pb-10">
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-5" />
        <h2 className="font-serif font-bold text-lg text-slate-800 mb-1">Follow a Shop</h2>
        <p className="text-sm text-slate-400 font-bold mb-5">Enter an Instagram handle to follow their outfit posts.</p>

        <div className="flex gap-2 mb-3">
          <div className="flex-1 flex items-center bg-white rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-slate-400 font-bold mr-1">@</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[@\s]/g, ''))}
              placeholder="thefrontshop"
              className="flex-1 bg-transparent outline-none text-slate-800 font-bold placeholder:text-slate-300"
              autoFocus
            />
          </div>
          <button
            onClick={() => handle.trim() && onAdd(handle.trim())}
            disabled={!handle.trim() || loading}
            className={clsx(
              "px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
              loading ? "bg-slate-200 text-slate-400" : "bg-orange-400 text-white active:scale-95"
            )}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {loading ? 'Fetching...' : 'Follow'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 font-bold bg-red-50 rounded-xl px-4 py-2">{error}</p>
        )}
      </div>
    </div>
  );
};

// --- Post Detail Modal ---
const PostDetailModal: React.FC<{
  post: ShopPost;
  closetItems: ClothingItem[];
  onClose: () => void;
}> = ({ post, closetItems, onClose }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedItems, setAnalyzedItems] = useState<AnalyzedShopItem[]>(post.analyzedItems || []);
  const [matches, setMatches] = useState<ReturnType<typeof matchItemsToCloset>>([]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const items = await analyzeShopPost(post.image);
      setAnalyzedItems(items);
      // Save to DB
      if (post.id) {
        await db.shopPosts.update(post.id, { analyzedItems: items, isProcessed: true });
      }
      // Run matching
      const matchResults = matchItemsToCloset(items, closetItems);
      setMatches(matchResults);
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-match if already analyzed
  React.useEffect(() => {
    if (analyzedItems.length > 0 && matches.length === 0) {
      const matchResults = matchItemsToCloset(analyzedItems, closetItems);
      setMatches(matchResults);
    }
  }, [analyzedItems, closetItems]);

  const totalItems = analyzedItems.length;
  const matchedCount = matches.filter(m => m.matchedClosetItemIds.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mt-auto bg-orange-50 rounded-t-[2rem] max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-orange-50 rounded-t-[2rem] px-6 pt-5 pb-3 z-10">
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-lg text-slate-800">Outfit Details</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-white shadow-sm text-slate-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-8">
          {/* Post Image */}
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-5">
            <img src={post.image} alt="Shop post" className="w-full h-auto" />
          </div>

          {/* Analyze Button or Results */}
          {analyzedItems.length === 0 ? (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-400 to-blue-500 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {analyzing ? (
                <><Loader2 size={18} className="animate-spin" /> Analyzing outfit...</>
              ) : (
                <><Sparkles size={18} /> Analyze & Match to My Closet</>
              )}
            </button>
          ) : (
            <>
              {/* Match Summary */}
              <div className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif font-bold text-slate-800">Detected Items</h3>
                  <span className="text-xs font-bold text-slate-400">{totalItems} pieces</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analyzedItems.map((item, i) => (
                    <span key={i} className="px-3 py-1.5 bg-orange-50 rounded-full text-xs font-bold text-slate-600">
                      {item.color} {item.category}
                    </span>
                  ))}
                </div>
              </div>

              {/* Match Results */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-bold text-slate-800">Closet Match</h3>
                  <span className={clsx(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    matchedCount === totalItems ? "bg-green-100 text-green-600" :
                    matchedCount > 0 ? "bg-orange-100 text-orange-600" : "bg-red-100 text-red-500"
                  )}>
                    {matchedCount}/{totalItems} matched
                  </span>
                </div>

                <div className="space-y-3">
                  {matches.map((match, i) => {
                    const hasMatch = match.matchedClosetItemIds.length > 0;
                    const matchedItems = match.matchedClosetItemIds
                      .slice(0, 3)
                      .map(id => closetItems.find(c => c.id === id))
                      .filter(Boolean) as ClothingItem[];

                    return (
                      <div key={i} className={clsx(
                        "rounded-xl p-3 border",
                        hasMatch ? "bg-green-50/50 border-green-100" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          {hasMatch ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <ShoppingBag size={14} className="text-slate-400" />
                          )}
                          <span className="text-sm font-bold text-slate-700">
                            {match.shopItemDescription}
                          </span>
                        </div>
                        {hasMatch ? (
                          <div className="flex gap-2">
                            {matchedItems.map(item => (
                              <div key={item.id} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100">
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            <span className="text-[10px] font-bold text-green-600 self-center ml-1">
                              {match.matchReason}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-bold">Not in your closet yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main ShopInspo Component ---
export const ShopInspo: React.FC = () => {
  const { activeChildId } = useActiveChild();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<ShopPost | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const accounts = useLiveQuery(() => db.shopAccounts.toArray());
  const posts = useLiveQuery(
    () => selectedAccountId
      ? db.shopPosts.where('shopAccountId').equals(selectedAccountId).reverse().toArray()
      : Promise.resolve([] as ShopPost[]),
    [selectedAccountId]
  );

  const allItemsRaw = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  const closetItems = useMemo(() => {
    if (!allItemsRaw) return [];
    return allItemsRaw.filter(item => {
      if (!activeChildId) return true;
      return !item.profileId || item.profileId === activeChildId;
    });
  }, [allItemsRaw, activeChildId]);

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const fetchPosts = async (handle: string, accountId: number) => {
    const res = await fetch(`/api/scrape-instagram?handle=${encodeURIComponent(handle)}&limit=9`);
    const data = await res.json();
    if (data.error && (!data.posts || data.posts.length === 0)) {
      throw new Error(data.error);
    }
    // Save posts, skip duplicates
    for (const post of data.posts || []) {
      const existing = await db.shopPosts
        .where('[shopAccountId+postUrl]')
        .equals([accountId, post.postUrl])
        .first();
      if (!existing) {
        await db.shopPosts.add({
          shopAccountId: accountId,
          postUrl: post.postUrl,
          image: post.imageUrl,
          dateFetched: Date.now(),
          isProcessed: false,
        });
      }
    }
    // Update lastFetched
    await db.shopAccounts.update(accountId, { lastFetched: Date.now() });
  };

  const handleAddAccount = async (handle: string) => {
    setAddLoading(true);
    setAddError(null);
    try {
      // Check if already followed
      const existing = await db.shopAccounts.where('handle').equals(handle.toLowerCase()).first();
      if (existing) {
        setSelectedAccountId(existing.id!);
        setShowAddSheet(false);
        setAddLoading(false);
        return;
      }
      // Add account
      const id = await db.shopAccounts.add({
        handle: handle.toLowerCase(),
        displayName: handle,
        profileId: activeChildId ?? undefined,
      });
      // Fetch posts
      await fetchPosts(handle.toLowerCase(), id as number);
      setSelectedAccountId(id as number);
      setShowAddSheet(false);
    } catch (e: any) {
      setAddError(e.message || 'Failed to fetch posts. The account may be private.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedAccount || refreshing) return;
    setRefreshing(true);
    try {
      await fetchPosts(selectedAccount.handle, selectedAccount.id!);
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveAccount = async (accountId: number) => {
    await db.shopPosts.where('shopAccountId').equals(accountId).delete();
    await db.shopAccounts.delete(accountId);
    if (selectedAccountId === accountId) setSelectedAccountId(null);
  };

  // --- Account Detail View ---
  if (selectedAccount && posts) {
    return (
      <div className="space-y-4">
        {/* Account header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedAccountId(null)}
            className="flex items-center gap-2 text-slate-500 font-bold text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 text-sm font-bold text-orange-500 active:scale-95 transition-transform"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg font-serif">
            {selectedAccount.handle[0].toUpperCase()}
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-slate-800">@{selectedAccount.handle}</h2>
            <p className="text-xs font-bold text-slate-400">{posts.length} posts saved</p>
          </div>
        </div>

        {/* Posts grid */}
        {posts.length === 0 ? (
          <div className="text-center py-12 opacity-50">
            <ShoppingBag size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-500">No posts fetched yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map(post => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-slate-100 active:scale-95 transition-transform"
              >
                <img src={post.image} alt="" className="w-full h-full object-cover" />
                {post.isProcessed && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Post detail modal */}
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            closetItems={closetItems}
            onClose={() => setSelectedPost(null)}
          />
        )}
      </div>
    );
  }

  // --- Accounts List View ---
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h1 className="text-3xl text-slate-800 font-serif">Shop Inspo</h1>
        <button
          onClick={() => { setAddError(null); setShowAddSheet(true); }}
          className="flex items-center gap-1 text-sm font-bold text-orange-500 active:scale-95 transition-transform"
        >
          <Plus size={16} /> Follow Shop
        </button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShoppingBag size={32} className="text-orange-400" />
          </div>
          <h3 className="font-serif font-bold text-lg text-slate-800 mb-2">Follow Your Favorite Shops</h3>
          <p className="text-sm text-slate-400 font-bold max-w-[240px] mx-auto mb-6">
            Add Instagram shops to get outfit inspiration and see what matches your closet.
          </p>
          <button
            onClick={() => { setAddError(null); setShowAddSheet(true); }}
            className="px-6 py-3 bg-orange-400 text-white font-bold rounded-full shadow-md active:scale-95 transition-transform"
          >
            Add First Shop
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => setSelectedAccountId(account.id!)}
              className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-base font-serif shrink-0">
                {account.handle[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">@{account.handle}</p>
                <p className="text-xs text-slate-400 font-bold">
                  {account.lastFetched
                    ? `Updated ${new Date(account.lastFetched).toLocaleDateString()}`
                    : 'Not fetched yet'}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {showAddSheet && (
        <AddAccountSheet
          onClose={() => setShowAddSheet(false)}
          onAdd={handleAddAccount}
          loading={addLoading}
          error={addError}
        />
      )}
    </div>
  );
};
