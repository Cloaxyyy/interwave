
import { supabase, isSupabaseConfigured } from './supabase';

export type AppRole = 'founder' | 'developer' | 'moderator' | 'user';

export interface UserRoleRow {
  user_id: string;
  role: AppRole;
}

export interface SuspensionRow {
  id: string;
  user_id: string;
  reason: string;
  active: boolean;
  expires_at: string | null;
  suspended_by: string | null;
  created_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
}

export interface IpBanRow {
  ip: string;
  reason: string;
  banned_by: string | null;
  created_at: string;
}

export interface MaintenanceRow {
  page: string;
  enabled: boolean;
  message: string;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  actor_id: string;
  action: string;
  target: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function getMyRole(): Promise<AppRole> {
  if (!isSupabaseConfigured) return 'user';
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return 'user';
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.session.user.id)
    .maybeSingle();
  if (error || !data) return 'user';
  return (data.role as AppRole) ?? 'user';
}

export function isStaff(role: AppRole): boolean {
  return role === 'founder' || role === 'developer' || role === 'moderator';
}

export async function getMyActiveSuspension(): Promise<SuspensionRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return null;
  const { data } = await supabase
    .from('account_suspensions')
    .select('*')
    .eq('user_id', session.session.user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SuspensionRow) ?? null;
}

export async function suspendUser(userId: string, reason: string, expiresAt?: Date | null) {
  const { error } = await supabase.from('account_suspensions').insert({
    user_id: userId,
    reason,
    active: true,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
  });
  if (error) throw error;
  await audit('suspend_user', userId, { reason });
}

export async function liftSuspension(suspensionId: string) {
  const { error } = await supabase
    .from('account_suspensions')
    .update({ active: false, lifted_at: new Date().toISOString() })
    .eq('id', suspensionId);
  if (error) throw error;
  await audit('lift_suspension', suspensionId, {});
}

export async function listIpBans(): Promise<IpBanRow[]> {
  const { data } = await supabase.from('ip_bans').select('*').order('created_at', { ascending: false });
  return (data as IpBanRow[]) ?? [];
}

export async function banIp(ip: string, reason: string) {
  const { error } = await supabase.from('ip_bans').insert({ ip, reason });
  if (error) throw error;
  await audit('ban_ip', ip, { reason });
}

export async function unbanIp(ip: string) {
  const { error } = await supabase.from('ip_bans').delete().eq('ip', ip);
  if (error) throw error;
  await audit('unban_ip', ip, {});
}

export async function getMaintenance(): Promise<MaintenanceRow[]> {
  const { data } = await supabase.from('maintenance').select('*');
  return (data as MaintenanceRow[]) ?? [];
}

export async function setMaintenance(page: string, enabled: boolean, message: string) {
  const { error } = await supabase.from('maintenance').upsert({
    page,
    enabled,
    message,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await audit(enabled ? 'maintenance_on' : 'maintenance_off', page, { message });
}

export function subscribeAdminState(
  myUserId: string,
  cb: (state: { maintenance: MaintenanceRow[]; suspension: SuspensionRow | null }) => void,
): () => void {
  if (!isSupabaseConfigured) return () => {};

  let maintenanceCache: MaintenanceRow[] = [];
  let suspensionCache: SuspensionRow | null = null;

  const refresh = async () => {
    const [m, s] = await Promise.all([
      getMaintenance(),
      getMyActiveSuspension(),
    ]);
    maintenanceCache = m;
    suspensionCache = s;
    cb({ maintenance: maintenanceCache, suspension: suspensionCache });
  };

  refresh();

  const ch = supabase
    .channel(`admin-state-${myUserId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance' }, refresh)
    .on('postgres_changes', {
        event: '*', schema: 'public', table: 'account_suspensions',
        filter: `user_id=eq.${myUserId}`,
      }, refresh)
    .subscribe();

  return () => { supabase.removeChannel(ch); };
}

export interface AdminUserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
  last_sign_in_at: string | null;
  last_ip: string | null;
  login_count: number;
  is_suspended: boolean;
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: AppRole;
    created_at: string;
    last_sign_in_at: string | null;
  };
  recent_ips: Array<{ ip: string; user_agent: string | null; signed_in_at: string }>;
  suspensions: Array<{
    id: string; reason: string; active: boolean;
    created_at: string; expires_at: string | null; lifted_at: string | null;
  }>;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('staff_list_users');
  if (error) {

    console.warn('[admin] staff_list_users RPC failed; falling back:', error.message);
    const { data: roles } = await supabase
      .from('user_roles').select('user_id, role').order('granted_at', { ascending: false });
    return (roles ?? []).map((r: any): AdminUserRow => ({
      user_id: r.user_id, email: '(unknown — run migration 002)', display_name: null,
      role: r.role, created_at: '', last_sign_in_at: null,
      last_ip: null, login_count: 0, is_suspended: false,
    }));
  }
  return (data as AdminUserRow[]) ?? [];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { data, error } = await supabase.rpc('staff_user_detail', { target: userId });
  if (error) { console.error('[admin] user detail failed:', error); return null; }
  return data as AdminUserDetail;
}

export async function setRole(userId: string, role: AppRole) {
  const { error } = await supabase.from('user_roles').upsert({
    user_id: userId,
    role,
    granted_at: new Date().toISOString(),
  });
  if (error) throw error;
  await audit('set_role', userId, { role });
}

export async function logLogin() {
  if (!isSupabaseConfigured) return;
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    await supabase.rpc('log_login', { client_user_agent: ua });
  } catch (e) {
    console.warn('[admin] log_login failed:', e);
  }
}

export interface AnnouncementRow {
  id: string;
  message: string;
  kind: 'info' | 'warning' | 'release';
  active: boolean;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as AnnouncementRow[]) ?? [];
}

export async function activeAnnouncements(): Promise<AnnouncementRow[]> {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  const now = Date.now();
  return ((data as AnnouncementRow[]) ?? [])
    .filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > now);
}

export async function createAnnouncement(
  message: string,
  kind: AnnouncementRow['kind'] = 'info',
  expiresAt: Date | null = null,
) {
  const { error } = await supabase.from('announcements').insert({
    message, kind, active: true,
    expires_at: expiresAt?.toISOString() ?? null,
  });
  if (error) throw error;
  await audit('announcement_create', message.slice(0, 64), { kind });
}

export async function deactivateAnnouncement(id: string) {
  const { error } = await supabase
    .from('announcements').update({ active: false }).eq('id', id);
  if (error) throw error;
  await audit('announcement_deactivate', id, {});
}

export function subscribeAnnouncements(
  cb: (rows: AnnouncementRow[]) => void,
): () => void {
  if (!isSupabaseConfigured) return () => {};
  const refresh = () => activeAnnouncements().then(cb);
  refresh();
  const ch = supabase
    .channel('announcements-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refresh)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

async function audit(action: string, target: string, details: Record<string, unknown>) {
  if (!isSupabaseConfigured) return;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return;
  await supabase.from('admin_audit').insert({
    actor_id: session.session.user.id,
    action,
    target,
    details,
  });
}

export async function listAudit(limit = 50): Promise<AuditRow[]> {
  const { data } = await supabase
    .from('admin_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as AuditRow[]) ?? [];
}
