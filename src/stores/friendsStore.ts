import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Friend {
  user_id: string;
  display_name: string;
  added_at: string;
}

export interface IncomingRequest {
  id: string;
  from_user: string;
  display_name: string;
  created_at: string;
}

export interface PresenceTrack {
  title: string;
  artist: string;
  thumbnail_url: string | null;
  state: 'playing' | 'paused';
  position: number;
  duration: number;
}

export interface FriendActivity {
  user_id: string;
  display_name: string;
  track: PresenceTrack | null;
  online: boolean;
  lastSeen: number;
}

interface FriendsStore {
  friends: Friend[];
  incoming: IncomingRequest[];
  activity: Map<string, FriendActivity>;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  sendRequest: (toUserId: string) => Promise<void>;
  accept: (requestId: string) => Promise<void>;
  decline: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<{ id: string; display_name: string }[]>;

  upsertActivity: (a: FriendActivity) => void;
  clearActivity: (userId: string) => void;
}

export const useFriendsStore = create<FriendsStore>((set, get) => ({
  friends: [],
  incoming: [],
  activity: new Map(),
  loading: false,
  error: null,

  load: async () => {
    if (!isSupabaseConfigured) return;
    set({ loading: true, error: null });

    const { data: session } = await supabase.auth.getSession();
    const me = session.session?.user.id;
    if (!me) { set({ loading: false }); return; }

    try {
      const { data: rows, error: fErr } = await supabase
        .from('friendships')
        .select('friend_id, created_at, profile:user_profiles!friendships_friend_id_fkey(display_name)')
        .eq('user_id', me);
      if (fErr) throw fErr;
      const friends: Friend[] = (rows ?? []).map((r: any) => ({
        user_id: r.friend_id,
        display_name: r.profile?.display_name ?? 'Unknown',
        added_at: r.created_at,
      }));

      const { data: reqs, error: rErr } = await supabase
        .from('friend_requests')
        .select('id, from_user, created_at, profile:user_profiles!friend_requests_from_user_fkey(display_name)')
        .eq('to_user', me)
        .eq('status', 'pending');
      if (rErr) throw rErr;
      const incoming: IncomingRequest[] = (reqs ?? []).map((r: any) => ({
        id: r.id,
        from_user: r.from_user,
        display_name: r.profile?.display_name ?? 'Unknown',
        created_at: r.created_at,
      }));

      set({ friends, incoming, loading: false });
    } catch (e: any) {

      const msg = String(e?.message ?? e);
      const benign = msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache');
      set({
        loading: false,
        error: benign ? 'Friends backend not provisioned yet — apply 004_friends.sql in Supabase.' : msg,
      });
    }
  },

  sendRequest: async (toUserId) => {
    const { data: session } = await supabase.auth.getSession();
    const me = session.session?.user.id;
    if (!me || me === toUserId) throw new Error('Invalid request');
    const { error } = await supabase.from('friend_requests').insert({
      from_user: me,
      to_user: toUserId,
      status: 'pending',
    });
    if (error) throw error;
  },

  accept: async (requestId) => {
    const { error } = await supabase.rpc('accept_friend_request', { req_id: requestId });
    if (error) throw error;
    await get().load();
  },

  decline: async (requestId) => {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined' })
      .eq('id', requestId);
    if (error) throw error;
    await get().load();
  },

  removeFriend: async (friendId) => {
    const { data: session } = await supabase.auth.getSession();
    const me = session.session?.user.id;
    if (!me) return;

    await supabase.from('friendships').delete().eq('user_id', me).eq('friend_id', friendId);
    await supabase.from('friendships').delete().eq('user_id', friendId).eq('friend_id', me);
    await get().load();
  },

  searchUsers: async (query) => {
    const q = query.trim();
    if (!q) return [];
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name')
      .ilike('display_name', `%${q}%`)
      .limit(15);
    if (error) throw error;
    return (data ?? []) as { id: string; display_name: string }[];
  },

  upsertActivity: (a) => {
    set((s) => {
      const next = new Map(s.activity);
      next.set(a.user_id, a);
      return { activity: next };
    });
  },

  clearActivity: (userId) => {
    set((s) => {
      const next = new Map(s.activity);
      const cur = next.get(userId);
      if (cur) next.set(userId, { ...cur, online: false, track: null });
      return { activity: next };
    });
  },
}));

let presenceChannel: RealtimeChannel | null = null;
let lastBroadcast = 0;

export function startPresence(myId: string, myName: string) {
  if (!isSupabaseConfigured || presenceChannel) return;

  const channel = supabase.channel('interwave-presence', {
    config: { presence: { key: myId } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const store = useFriendsStore.getState();
    const friendIds = new Set(store.friends.map((f) => f.user_id));
    const seen = new Set<string>();
    for (const userId of Object.keys(state)) {
      if (!friendIds.has(userId)) continue;
      const presences = state[userId] as any[];
      const last = presences[presences.length - 1];
      if (!last) continue;
      seen.add(userId);
      store.upsertActivity({
        user_id: userId,
        display_name: last.display_name ?? 'Friend',
        track: last.track ?? null,
        online: true,
        lastSeen: Date.now(),
      });
    }

    for (const fid of friendIds) {
      if (!seen.has(fid)) store.clearActivity(fid);
    }
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ display_name: myName, track: null });
    }
  });

  presenceChannel = channel;
}

export function stopPresence() {
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
}

export async function broadcastNowPlaying(payload: {
  display_name: string;
  track: PresenceTrack | null;
}) {
  if (!presenceChannel) return;

  const now = Date.now();
  if (now - lastBroadcast < 800 && payload.track !== null) return;
  lastBroadcast = now;
  try {
    await presenceChannel.track(payload);
  } catch {}
}
