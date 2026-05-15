
import { useEffect, useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import {
  ShieldStar, Wrench, UsersThree, Globe, ScrollIcon,
  Plus, Trash, X as XIcon, Megaphone, ChatCircle, PaperPlaneTilt, ArrowLeft,
} from '@phosphor-icons/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  getMaintenance, setMaintenance,
  listUsers, getUserDetail, setRole, suspendUser, liftSuspension,
  listIpBans, banIp, unbanIp,
  listAudit,
  listAnnouncements, createAnnouncement, deactivateAnnouncement,
  type AppRole, type MaintenanceRow, type IpBanRow, type AuditRow,
  type AdminUserRow, type AdminUserDetail, type AnnouncementRow,
} from '../lib/admin';

type Tab = 'maintenance' | 'users' | 'bans' | 'announcements' | 'tickets' | 'audit';

export default function AdminView() {
  const { isStaff, role } = useAuthStore();
  const [tab, setTab] = useState<Tab>('maintenance');

  if (!isStaff) {
    return (
      <div style={{
        flex: 1, display: 'grid', placeItems: 'center',
        color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 14,
      }}>
        You don't have access to this page.
      </div>
    );
  }

  return (
    <PageShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: 'var(--grad-violet)',
          display: 'grid', placeItems: 'center',
          boxShadow: 'var(--shadow-accent)',
          flexShrink: 0,
        }}>
          <ShieldStar size={24} weight="fill" color="white" />
        </div>
        <div>
          <p style={{
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4,
          }}>
            Admin · {role}
          </p>
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 'clamp(34px, 4.5vw, 48px)', fontWeight: 400,
            letterSpacing: '-0.02em', margin: 0, lineHeight: 1.05, color: 'var(--text-primary)',
          }}>
            Control Panel
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, flexWrap: 'wrap' }}>
        {([
          { id: 'maintenance',   icon: <Wrench size={13} weight="bold"/>,     label: 'Maintenance' },
          { id: 'users',         icon: <UsersThree size={13} weight="bold"/>, label: 'Users' },
          { id: 'bans',          icon: <Globe size={13} weight="bold"/>,      label: 'IP bans' },
          { id: 'announcements', icon: <Megaphone size={13} weight="bold"/>,  label: 'Announce' },
          { id: 'tickets',       icon: <ChatCircle size={13} weight="bold"/>, label: 'Support' },
          { id: 'audit',         icon: <ScrollIcon size={13} weight="bold"/>, label: 'Audit log' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 8,
              background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: tab === t.id ? 'var(--accent)' : 'var(--border-subtle)',
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'maintenance' && <MaintenancePanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'bans' && <IpBansPanel />}
        {tab === 'announcements' && <AnnouncementsPanel />}
        {tab === 'tickets' && <SupportTicketsPanel />}
        {tab === 'audit' && <AuditPanel />}
      </div>
    </PageShell>
  );
}

// ── Announcements panel ────────────────────────────────────────────────
// Staff send a top-banner message visible to every authenticated user.

function AnnouncementsPanel() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState<AnnouncementRow['kind']>('info');
  const [hours, setHours] = useState<number>(24);
  const [posting, setPosting] = useState(false);

  const refresh = () => listAnnouncements().then(setRows).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const post = async () => {
    if (!msg.trim()) return;
    setPosting(true);
    try {
      const expires = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000) : null;
      await createAnnouncement(msg.trim(), kind, expires);
      setMsg('');
      refresh();
    } catch (e) { console.error(e); }
    finally { setPosting(false); }
  };

  const deactivate = async (id: string) => {
    try { await deactivateAnnouncement(id); refresh(); }
    catch (e) { console.error(e); }
  };

  if (loading) return <Skeleton/>;

  const active = rows.filter((r) => r.active);
  const past   = rows.filter((r) => !r.active);

  return (
    <div>
      <SectionHeader
        title="Broadcast announcements"
        sub="Top-of-app banner visible to every signed-in user. Use sparingly — info for general news, warning for outages, release for new features."
      />

      {/* Composer */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: 14, marginBottom: 18,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="What do you want everyone to see?"
          rows={2}
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: 8, padding: 10,
            color: 'var(--text-primary)',
            fontFamily: 'var(--sans)', fontSize: 13,
            outline: 'none', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as any)} style={selectStyle}>
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
            <option value="release">Release (violet)</option>
          </select>
          <select value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))} style={selectStyle}>
            <option value={1}>Expire in 1h</option>
            <option value={6}>Expire in 6h</option>
            <option value={24}>Expire in 24h</option>
            <option value={72}>Expire in 3 days</option>
            <option value={168}>Expire in 1 week</option>
            <option value={0}>Never expire</option>
          </select>
          <div style={{ flex: 1 }}/>
          <button
            onClick={post}
            disabled={!msg.trim() || posting}
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: 12, opacity: !msg.trim() || posting ? 0.5 : 1 }}
          >
            <Megaphone size={13} weight="bold"/> Post
          </button>
        </div>
      </div>

      {/* Active */}
      <h3 style={detailHeading}>Active ({active.length})</h3>
      <div style={listStyle}>
        {active.length === 0 && <p style={emptyStyle}>Nothing is being broadcast right now.</p>}
        {active.map((a, i) => (
          <AnnRow key={a.id} a={a} first={i === 0} onDeactivate={deactivate}/>
        ))}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <>
          <h3 style={{ ...detailHeading, marginTop: 24 }}>Past ({past.length})</h3>
          <div style={listStyle}>
            {past.slice(0, 20).map((a, i) => (
              <AnnRow key={a.id} a={a} first={i === 0} onDeactivate={null}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnnRow({
  a, first, onDeactivate,
}: { a: AnnouncementRow; first: boolean; onDeactivate: ((id: string) => void) | null }) {
  const c: Record<AnnouncementRow['kind'], string> = {
    info: 'oklch(0.55 0.16 250)', warning: 'oklch(0.55 0.18 50)',
    release: 'var(--accent)',
  };
  return (
    <div style={{
      padding: '10px 14px',
      borderTop: first ? 'none' : '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
        padding: '2px 7px', borderRadius: 4,
        background: c[a.kind], color: '#fff',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>{a.kind}</span>
      <span style={{
        flex: 1, fontFamily: 'var(--sans)', fontSize: 13,
        color: a.active ? 'var(--text-primary)' : 'var(--text-muted)',
        textDecoration: a.active ? 'none' : 'line-through',
      }}>
        {a.message}
      </span>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
      }}>
        {new Date(a.created_at).toLocaleDateString()}
      </span>
      {a.expires_at && a.active && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
        }}>
          → {new Date(a.expires_at).toLocaleDateString()}
        </span>
      )}
      {onDeactivate && (
        <button onClick={() => onDeactivate(a.id)} style={ghostBtn} title="Deactivate">
          End
        </button>
      )}
    </div>
  );
}

const detailHeading: React.CSSProperties = {
  fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 8, marginTop: 0,
};
const listStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 12, overflow: 'hidden',
};
const emptyStyle: React.CSSProperties = {
  padding: 16, color: 'var(--text-muted)', fontSize: 12,
  fontFamily: 'var(--sans)', textAlign: 'center',
};

// ── Maintenance ──────────────────────────────────────────────────────────────

function MaintenancePanel() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMaintenance().then((r) => setRows(r)).finally(() => setLoading(false));
  }, []);

  const ensurePages = ['global', 'home', 'search', 'library', 'import'];
  const merged = ensurePages.map((page) =>
    rows.find((r) => r.page === page) ??
    { page, enabled: false, message: defaultMsgFor(page), updated_at: '' }
  );

  const toggle = async (page: string, enabled: boolean, message: string) => {
    await setMaintenance(page, enabled, message);
    setRows(await getMaintenance());
  };

  if (loading) return <Skeleton/>;

  return (
    <div>
      <SectionHeader
        title="Maintenance mode"
        sub="Block parts of the app for everyone with a custom message. Founder-only signal that an outage is acknowledged."
      />
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {merged.map((row, i) => (
          <MaintenanceRowItem key={row.page} row={row} first={i === 0} onToggle={toggle}/>
        ))}
      </div>
    </div>
  );
}

function MaintenanceRowItem({
  row, first, onToggle,
}: { row: MaintenanceRow; first: boolean; onToggle: (page: string, enabled: boolean, message: string) => Promise<void> }) {
  const [msg, setMsg] = useState(row.message);
  const [working, setWorking] = useState(false);

  const flip = async () => {
    setWorking(true);
    try { await onToggle(row.page, !row.enabled, msg); }
    finally { setWorking(false); }
  };

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: first ? 'none' : '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <code style={{
          fontFamily: 'var(--mono)', fontSize: 12,
          padding: '3px 8px', borderRadius: 4,
          background: 'var(--bg-overlay)', color: 'var(--text-primary)',
        }}>{row.page}</code>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--text-muted)',
        }}>
          {row.enabled ? 'Showing maintenance screen' : 'Available'}
        </span>
        <button
          onClick={flip}
          disabled={working}
          style={{
            marginLeft: 'auto',
            padding: '6px 16px',
            borderRadius: 999,
            background: row.enabled ? 'var(--destructive)' : 'var(--accent)',
            color: row.enabled ? 'white' : 'var(--accent-ink)',
            border: 'none',
            fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600,
            cursor: working ? 'wait' : 'pointer',
            opacity: working ? 0.6 : 1,
          }}
        >
          {row.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onBlur={() => msg !== row.message && onToggle(row.page, row.enabled, msg)}
        placeholder="Message shown to users…"
        style={{
          width: '100%', padding: '7px 10px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: 6, color: 'var(--text-primary)',
          fontFamily: 'var(--sans)', fontSize: 12, outline: 'none',
        }}
      />
    </div>
  );
}

function defaultMsgFor(page: string): string {
  if (page === 'global') return 'Interwave is currently down for maintenance.';
  return `The ${page} section is temporarily unavailable.`;
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersPanel() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listUsers().then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.email.toLowerCase().includes(q)
      || (r.display_name?.toLowerCase().includes(q) ?? false)
      || r.user_id.toLowerCase().includes(q);
  });

  if (loading) return <Skeleton/>;

  return (
    <div>
      <SectionHeader
        title={`Users (${rows.length})`}
        sub="Click any user to open their support profile — see IPs, suspensions, and act."
      />

      {/* Search */}
      <div style={{
        marginBottom: 14, display: 'flex', gap: 8,
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, or UID…"
          style={inputStyle}
        />
        <button onClick={refresh} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
          ↻ Refresh
        </button>
      </div>

      {/* User table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {filtered.length === 0 && (
          <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            {rows.length === 0
              ? 'No users yet — once people sign in they\'ll show up here.'
              : 'No matches.'}
          </p>
        )}
        {filtered.map((r, i) => (
          <UserRow
            key={r.user_id}
            row={r}
            first={i === 0}
            onClick={() => setSelectedId(r.user_id)}
          />
        ))}
      </div>

      {}
      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onMutate={refresh}
        />
      )}
    </div>
  );
}

function UserRow({ row, first, onClick }: { row: AdminUserRow; first: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderTop: first ? 'none' : '1px solid var(--border-subtle)',
        background: hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
    >
      <Avatar text={row.display_name ?? row.email}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.display_name ?? row.email.split('@')[0]}
          </span>
          {row.is_suspended && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              background: 'oklch(0.45 0.20 25)', color: 'white',
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              SUSPENDED
            </span>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 11,
          color: 'var(--text-muted)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.email}
          {row.last_ip && <span style={{ marginLeft: 10, fontFamily: 'var(--mono)' }}>· {row.last_ip}</span>}
          {row.login_count > 0 && <span style={{ marginLeft: 10 }}>· {row.login_count} sign-ins</span>}
        </div>
      </div>
      <RoleBadge role={row.role}/>
      <span style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>›</span>
    </div>
  );
}

function Avatar({ text }: { text: string }) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h) + text.charCodeAt(i);
  const hue = Math.abs(h % 360);
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, oklch(0.62 0.16 ${hue}), oklch(0.36 0.18 ${(hue + 40) % 360}))`,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14,
      color: 'white',
    }}>
      {text[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function UserDetailModal({
  userId, onClose, onMutate,
}: { userId: string; onClose: () => void; onMutate: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>('user');

  const refresh = () => {
    setLoading(true);
    getUserDetail(userId).then((d) => {
      setDetail(d);
      if (d) setNewRole(d.user.role);
    }).finally(() => setLoading(false));
  };
  useEffect(refresh, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSuspend = async () => {
    if (!suspendReason.trim()) return;
    setSuspending(true);
    try { await suspendUser(userId, suspendReason.trim()); setSuspendReason(''); refresh(); onMutate(); }
    catch (e) { console.error(e); }
    finally { setSuspending(false); }
  };
  const handleLift = async (id: string) => {
    try { await liftSuspension(id); refresh(); onMutate(); }
    catch (e) { console.error(e); }
  };
  const handleRoleChange = async () => {
    try { await setRole(userId, newRole); refresh(); onMutate(); }
    catch (e) { console.error(e); }
  };
  const handleBanIp = async (ip: string) => {
    const reason = prompt(`Ban ${ip}? Enter a reason:`);
    if (!reason) return;
    try { await banIp(ip, reason); }
    catch (e: any) { alert('Failed: ' + (e?.message ?? e)); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 11500,
        background: 'rgba(8,5,16,0.78)',
        backdropFilter: 'blur(20px)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '8vh', padding: '8vh 24px 24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)', maxHeight: '80vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {loading || !detail ? (
          <Skeleton/>
        ) : (
          <>
            {}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <Avatar text={detail.user.display_name ?? detail.user.email}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 22,
                  color: 'var(--text-primary)', lineHeight: 1.1,
                  letterSpacing: '-0.01em',
                }}>
                  {detail.user.display_name ?? detail.user.email.split('@')[0]}
                </div>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 12,
                  color: 'var(--text-muted)', marginTop: 2,
                }}>
                  {detail.user.email} · joined {new Date(detail.user.created_at).toLocaleDateString()}
                </div>
              </div>
              <RoleBadge role={detail.user.role}/>
              <button onClick={onClose} title="Close (Esc)" style={ghostBtn}>
                <XIcon size={14} weight="bold"/>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {}
              <DetailSection title="Role">
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)} style={selectStyle}>
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="developer">developer</option>
                    <option value="founder">founder</option>
                  </select>
                  <button
                    onClick={handleRoleChange}
                    disabled={newRole === detail.user.role}
                    className="btn-primary" style={{ padding: '8px 14px', fontSize: 12, opacity: newRole === detail.user.role ? 0.5 : 1 }}
                  >Update</button>
                </div>
              </DetailSection>

              {}
              <DetailSection title="Suspensions">
                {detail.suspensions.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No suspension history.</p>
                )}
                {detail.suspensions.map((s) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                      background: s.active ? 'oklch(0.45 0.20 25)' : 'var(--bg-overlay)',
                      color: s.active ? 'white' : 'var(--text-muted)',
                      textTransform: 'uppercase',
                    }}>
                      {s.active ? 'ACTIVE' : 'LIFTED'}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{s.reason}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    {s.active && (
                      <button onClick={() => handleLift(s.id)} style={ghostBtn} title="Lift">Lift</button>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  <input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for new suspension…"
                    style={inputStyle}
                  />
                  <button
                    onClick={handleSuspend}
                    disabled={!suspendReason.trim() || suspending}
                    style={{
                      ...confirmBtn, padding: '7px 14px',
                      background: 'oklch(0.55 0.22 25)', color: 'white',
                      opacity: !suspendReason.trim() || suspending ? 0.5 : 1,
                    }}
                  >Suspend</button>
                </div>
              </DetailSection>

              {}
              <DetailSection title={`Recent IPs (${detail.recent_ips.length})`}>
                {detail.recent_ips.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    No IP recorded yet — they need to sign in once with this build for the desktop to log it.
                  </p>
                )}
                {detail.recent_ips.map((ip) => (
                  <div key={ip.ip + ip.signed_in_at} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 0', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <code style={{
                      fontFamily: 'var(--mono)', fontSize: 12,
                      padding: '2px 8px', background: 'var(--bg-overlay)',
                      borderRadius: 4, color: 'var(--text-primary)',
                    }}>{ip.ip}</code>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)',
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ip.user_agent ?? '—'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                      {new Date(ip.signed_in_at).toLocaleString()}
                    </span>
                    <button onClick={() => handleBanIp(ip.ip)} style={ghostBtn} title="Ban this IP">
                      Ban IP
                    </button>
                  </div>
                ))}
              </DetailSection>

              {}
              <DetailSection title="Identity">
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                  UID: {detail.user.id}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--sans)', marginTop: 6 }}>
                  Last sign-in: {detail.user.last_sign_in_at
                    ? new Date(detail.user.last_sign_in_at).toLocaleString()
                    : 'never'}
                </p>
              </DetailSection>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{
        fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function IpBansPanel() {
  const [bans, setBans] = useState<IpBanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');

  const refresh = () => listIpBans().then(setBans).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  if (loading) return <Skeleton/>;

  return (
    <div>
      <SectionHeader
        title="IP bans"
        sub="Block specific IPv4/IPv6 addresses. Note: trivially bypassed with a VPN — useful as friction, not as a wall."
      />
      <div style={{
        display: 'flex', gap: 8, marginBottom: 18,
        padding: 14, background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)', borderRadius: 10,
      }}>
        <input
          value={newIp}
          onChange={(e) => setNewIp(e.target.value)}
          placeholder="IP address"
          style={{ ...inputStyle, maxWidth: 200 }}
        />
        <input
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="Reason"
          style={inputStyle}
        />
        <button
          onClick={async () => {
            if (!newIp.trim()) return;
            try { await banIp(newIp.trim(), newReason.trim() || 'No reason given'); setNewIp(''); setNewReason(''); refresh(); }
            catch (e) { console.error(e); }
          }}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: 12 }}
        >
          <Plus size={13} weight="bold"/> Ban
        </button>
      </div>

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {bans.length === 0 && (
          <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            No IPs banned.
          </p>
        )}
        {bans.map((b, i) => (
          <div key={b.ip} style={{
            padding: '12px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <code style={{
              fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-primary)',
              padding: '3px 8px', background: 'var(--bg-overlay)', borderRadius: 4,
            }}>{b.ip}</code>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
              {b.reason}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {new Date(b.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={async () => {
                try { await unbanIp(b.ip); refresh(); }
                catch (e) { console.error(e); }
              }}
              style={ghostBtn}
              title="Unban"
            >
              <Trash size={12} weight="bold"/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listAudit(100).then(setRows).finally(() => setLoading(false)); }, []);

  if (loading) return <Skeleton/>;

  return (
    <div>
      <SectionHeader
        title="Recent staff actions"
        sub="Every suspension, ban, role change, and maintenance toggle is logged forever."
      />
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {rows.length === 0 && (
          <p style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            No actions yet.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={r.id} style={{
            padding: '10px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--sans)', fontSize: 12,
          }}>
            <code style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)',
              padding: '2px 6px', background: 'var(--accent-dim)', borderRadius: 4,
            }}>{r.action}</code>
            <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>by</span>{' '}
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{r.actor_id.slice(0, 8)}…</code>
              {' → '}
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                {r.target.length > 36 ? r.target.slice(0, 8) + '…' : r.target}
              </code>
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 10 }}>
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400,
        letterSpacing: '-0.01em', margin: '0 0 4px',
      }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--sans)' }}>
        {sub}
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const palette: Record<AppRole, { bg: string; fg: string }> = {
    founder:   { bg: 'oklch(0.30 0.18 295)', fg: 'oklch(0.92 0.10 295)' },
    developer: { bg: 'oklch(0.28 0.16 250)', fg: 'oklch(0.90 0.10 250)' },
    moderator: { bg: 'oklch(0.28 0.14 165)', fg: 'oklch(0.90 0.10 165)' },
    user:      { bg: 'var(--bg-overlay)',    fg: 'var(--text-secondary)' },
  };
  const c = palette[role];
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 4,
      background: c.bg, color: c.fg,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {role}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{
      padding: 40, color: 'var(--text-muted)', fontSize: 13,
      fontFamily: 'var(--sans)', textAlign: 'center',
    }}>
      Loading…
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 6, color: 'var(--text-primary)',
  fontFamily: 'var(--sans)', fontSize: 12,
  padding: '7px 10px', outline: 'none',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 6, color: 'var(--text-primary)',
  fontFamily: 'var(--sans)', fontSize: 12,
  padding: '7px 10px', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', borderRadius: 6,
  padding: '5px 10px', fontFamily: 'var(--sans)', fontSize: 11,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const confirmBtn: React.CSSProperties = {
  background: 'var(--accent)', border: 'none',
  color: 'var(--accent-ink)', borderRadius: 6,
  padding: '5px 10px', fontFamily: 'var(--sans)', fontSize: 11,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

interface AdminTicket {
  id: string;
  user_id: string;
  email: string | null;
  subject: string;
  body: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  app_version: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminReply {
  id: string;
  ticket_id: string;
  author_id: string | null;
  is_staff: boolean;
  body: string;
  created_at: string;
}

const TICKET_STATUSES: AdminTicket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_COLOR: Record<string, string> = {
  open: 'var(--accent)',
  in_progress: '#ffb84d',
  resolved: 'var(--success)',
  closed: 'var(--text-muted)',
};

function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AdminTicket['status'] | 'all'>('open');
  const [activeTicket, setActiveTicket] = useState<AdminTicket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from('support_tickets')
        .select('id, user_id, email, subject, body, category, status, app_version, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (e) throw e;
      setTickets((data ?? []) as AdminTicket[]);
      setError(null);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const tableMissing = msg.includes('does not exist') || msg.includes('relation');
      setError(tableMissing
        ? 'Support backend not provisioned — re-run supabase/migrations/005_support_tickets.sql to pick up the new admin policies.'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  if (activeTicket) {
    return (
      <TicketThread
        ticket={activeTicket}
        onBack={() => { setActiveTicket(null); load(); }}
        onUpdate={(updated) => setActiveTicket(updated)}
      />
    );
  }

  return (
    <div>
      <SectionHeader
        title="Support tickets"
        sub="Every ticket users submit lands here. Reply inside a ticket to start a conversation, change the status to track progress."
      />

      {error && (
        <div style={{
          padding: 12, borderRadius: 10, marginBottom: 16,
          background: 'rgba(255,180,80,0.10)', border: '1px solid rgba(255,180,80,0.30)',
          color: '#ffb84d', fontFamily: 'var(--sans)', fontSize: 12, lineHeight: 1.5,
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', ...TICKET_STATUSES] as const).map((s) => {
          const active = filter === s;
          const count = s === 'all' ? tickets.length : tickets.filter((t) => t.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999,
                background: active ? 'rgba(200,255,87,0.10)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: active ? 600 : 500,
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {s.replace('_', ' ')} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--sans)', fontSize: 13 }}>
          No tickets in this filter.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTicket(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 120ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600,
                  color: 'var(--text-primary)', marginBottom: 4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t.subject}</div>
                <div style={{
                  fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--text-muted)',
                  display: 'flex', gap: 8,
                }}>
                  <span style={{ textTransform: 'capitalize' }}>{t.category}</span>
                  <span>·</span>
                  <span>{t.email ?? t.user_id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700,
                color: STATUS_COLOR[t.status] ?? 'var(--text-muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                flexShrink: 0,
              }}>{t.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketThread({ ticket, onBack, onUpdate }: { ticket: AdminTicket; onBack: () => void; onUpdate: (t: AdminTicket) => void }) {
  const me = useAuthStore((s) => s.user);
  const [replies, setReplies] = useState<AdminReply[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(ticket.status);

  const loadReplies = async () => {
    const { data } = await supabase
      .from('support_ticket_replies')
      .select('id, ticket_id, author_id, is_staff, body, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setReplies((data ?? []) as AdminReply[]);
  };

  useEffect(() => { loadReplies(); }, [ticket.id]);

  const handleSend = async () => {
    if (!reply.trim() || sending || !me) return;
    setSending(true);
    try {
      await supabase.from('support_ticket_replies').insert({
        ticket_id: ticket.id,
        author_id: me.id,
        is_staff: true,
        body: reply.trim(),
      });
      setReply('');
      await loadReplies();
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (next: AdminTicket['status']) => {
    setStatus(next);
    await supabase.from('support_tickets').update({ status: next }).eq('id', ticket.id);
    onUpdate({ ...ticket, status: next });
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--sans)', fontSize: 12, padding: '6px 0',
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={12} weight="bold" /> All tickets
      </button>

      <div style={{ marginBottom: 18 }}>
        <h2 style={{
          fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400,
          color: 'var(--text-primary)', margin: 0, marginBottom: 6,
        }}>{ticket.subject}</h2>
        <div style={{
          fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--text-muted)',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ textTransform: 'capitalize' }}>{ticket.category}</span>
          <span>·</span>
          <span>{ticket.email ?? ticket.user_id.slice(0, 8)}</span>
          <span>·</span>
          <span>v{ticket.app_version ?? '?'}</span>
          <span>·</span>
          <span>{new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 6, marginBottom: 18,
      }}>
        {TICKET_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            style={{
              padding: '5px 10px', borderRadius: 999,
              background: status === s ? `color-mix(in oklch, ${STATUS_COLOR[s]} 18%, transparent)` : 'transparent',
              border: `1px solid ${status === s ? STATUS_COLOR[s] : 'var(--border-default)'}`,
              color: status === s ? STATUS_COLOR[s] : 'var(--text-secondary)',
              fontFamily: 'var(--sans)', fontSize: 11, fontWeight: status === s ? 600 : 500,
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Original ticket body */}
      <div style={{
        padding: '14px 16px', borderRadius: 12, marginBottom: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-muted)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
        }}>Original report</div>
        <pre style={{
          fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--text-primary)',
          margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          lineHeight: 1.6,
        }}>{ticket.body}</pre>
      </div>

      {/* Reply thread */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {replies.map((r) => (
          <div
            key={r.id}
            style={{
              alignSelf: r.is_staff ? 'flex-end' : 'flex-start',
              maxWidth: '78%',
              padding: '10px 14px', borderRadius: 14,
              background: r.is_staff
                ? 'color-mix(in oklch, var(--accent-live) 14%, var(--bg-overlay))'
                : 'var(--bg-overlay)',
              border: `1px solid ${r.is_staff ? 'var(--accent)' : 'var(--border-default)'}`,
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9.5,
              color: r.is_staff ? 'var(--accent)' : 'var(--text-muted)',
              letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              {r.is_staff ? 'Staff' : 'User'} · {new Date(r.created_at).toLocaleString()}
            </div>
            <div style={{
              fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55,
            }}>{r.body}</div>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        padding: 10, borderRadius: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply as staff…"
          rows={2}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'var(--sans)', fontSize: 13,
            resize: 'vertical', minHeight: 40,
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: sending || !reply.trim() ? 'var(--bg-elevated)' : 'var(--accent)',
            color: sending || !reply.trim() ? 'var(--text-muted)' : '#000',
            cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700,
          }}
        >
          <PaperPlaneTilt size={12} weight="fill" /> Send
        </button>
      </div>
    </div>
  );
}
