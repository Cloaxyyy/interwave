import { useEffect, useState } from 'react';
import { MagnifyingGlass, UserPlus, Check, X, Play, Pause } from '@phosphor-icons/react';
import { PageShell, PageHeader } from '../components/layout/PageShell';
import { useFriendsStore } from '../stores/friendsStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';

export default function FriendsView() {
  const { friends, incoming, activity, error, load, accept, decline, removeFriend, sendRequest, searchUsers } = useFriendsStore();
  const session = useAuthStore((s) => s.session);
  const pushToast = useToastStore((s) => s.push);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; display_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchUsers(q);
        if (!cancelled) setResults(r.filter((u) => u.id !== session?.user.id));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, searchUsers, session?.user.id]);

  const handleAdd = async (id: string, name: string) => {
    try {
      await sendRequest(id);
      pushToast({ kind: 'success', title: `Friend request sent to ${name}`, duration: 2400 });
      setQuery('');
      setResults([]);
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'Could not send request', body: String(e?.message ?? e), duration: 4000 });
    }
  };

  const friendIds = new Set(friends.map((f) => f.user_id));
  const pendingOutIds = new Set<string>();

  return (
    <PageShell>
      <PageHeader
        eyebrow="People"
        title="Friends"
        subtitle="See what friends are listening to in real time."
      />

      {error && (
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'rgba(255,180,80,0.08)',
          border: '1px solid rgba(255,180,80,0.30)',
          color: '#ffb84d',
          fontFamily: 'var(--sans)', fontSize: 12.5, lineHeight: 1.5,
          marginBottom: 22,
        }}>
          {error}
        </div>
      )}

      {}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          maxWidth: 460,
        }}>
          <MagnifyingGlass size={16} weight="bold" color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a friend by display name…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 13,
            }}
          />
          {searching && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>…</span>
          )}
        </div>
        {results.length > 0 && (
          <div style={{
            marginTop: 10,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            overflow: 'hidden',
            maxWidth: 460,
          }}>
            {results.map((u) => {
              const already = friendIds.has(u.id);
              const pending = pendingOutIds.has(u.id);
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <Avatar name={u.display_name} />
                  <div style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-primary)' }}>
                    {u.display_name}
                  </div>
                  {already ? (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>FRIEND</span>
                  ) : pending ? (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>SENT</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(u.id, u.display_name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--accent)', color: '#000',
                        border: 'none', padding: '5px 10px', borderRadius: 6,
                        fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <UserPlus size={12} weight="bold" /> Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {}
      {incoming.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Pending requests
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {incoming.map((r) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
              }}>
                <Avatar name={r.display_name} />
                <div style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 13.5, color: 'var(--text-primary)' }}>
                  <strong>{r.display_name}</strong> wants to be friends
                </div>
                <button
                  onClick={() => accept(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'var(--accent)', color: '#000',
                    border: 'none', padding: '6px 12px', borderRadius: 6,
                    fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Check size={12} weight="bold" /> Accept
                </button>
                <button
                  onClick={() => decline(r.id)}
                  title="Decline"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-default)', padding: '6px 10px', borderRadius: 6,
                    fontFamily: 'var(--sans)', fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {}
      <section>
        <h2 style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
          letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          {friends.length === 0 ? 'No friends yet' : `Activity (${friends.length})`}
        </h2>
        {friends.length === 0 && !error && (
          <p style={{
            fontFamily: 'var(--sans)', fontSize: 13,
            color: 'var(--text-secondary)', lineHeight: 1.6,
            maxWidth: 480,
          }}>
            Search for someone above by their display name and send a request.
            Once they accept, you'll see their now-playing here in real time.
          </p>
        )}
        {friends.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {friends.map((f) => {
              const a = activity.get(f.user_id);
              return (
                <FriendCard
                  key={f.user_id}
                  friend={f}
                  activity={a}
                  onRemove={() => removeFriend(f.user_id)}
                />
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function FriendCard({
  friend, activity, onRemove,
}: {
  friend: { user_id: string; display_name: string };
  activity?: { online: boolean; track: any | null };
  onRemove: () => void;
}) {
  const online = activity?.online ?? false;
  const track = activity?.track ?? null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 12,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar name={friend.display_name} />
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 12, height: 12, borderRadius: '50%',
          background: online ? 'var(--success)' : 'var(--text-muted)',
          border: '2px solid var(--bg-surface)',
        }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {friend.display_name}
        </div>
        {track ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 4,
            fontFamily: 'var(--sans)', fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {track.state === 'playing'
              ? <Play size={10} weight="fill" color="var(--accent)" />
              : <Pause size={10} weight="fill" color="var(--text-muted)" />
            }
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{track.title}</strong>
              {' — '}
              {track.artist}
            </span>
          </div>
        ) : (
          <div style={{
            marginTop: 4,
            fontFamily: 'var(--sans)', fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            {online ? 'Online — not playing anything' : 'Offline'}
          </div>
        )}
      </div>
      {track?.thumbnail_url && (
        <img
          src={track.thumbnail_url}
          alt=""
          draggable={false}
          style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <button
        onClick={onRemove}
        title="Remove friend"
        style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          padding: 6, display: 'flex', borderRadius: 4,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--destructive)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%',
      display: 'grid', placeItems: 'center',
      background: `linear-gradient(135deg, oklch(0.45 0.12 ${h}), oklch(0.30 0.10 ${(h + 40) % 360}))`,
      color: '#fff',
      fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
