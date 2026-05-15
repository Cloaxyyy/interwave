import { useEffect, useState } from 'react';
import { Bug, Lightbulb, UserCircle, ChatCircle, PaperPlaneTilt, Check } from '@phosphor-icons/react';
import { PageShell, PageHeader } from '../components/layout/PageShell';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { getDiagnostics } from '../lib/crashReporter';

const APP_VERSION = '0.7.4';

type Category = 'bug' | 'feature' | 'account' | 'general';

interface Ticket {
  id: string;
  subject: string;
  body: string;
  category: Category;
  status: string;
  created_at: string;
}

export default function SupportView() {
  const session = useAuthStore((s) => s.session);
  const pushToast = useToastStore((s) => s.push);

  const [category, setCategory] = useState<Category>('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [includeDiag, setIncludeDiag] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!isSupabaseConfigured || !session?.user) return;
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, body, category, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data ?? []) as Ticket[]);
      setError(null);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const tableMissing = msg.includes('does not exist') || msg.includes('relation');
      setError(tableMissing
        ? 'Support backend not provisioned yet — apply supabase/migrations/005_support_tickets.sql in your Supabase Dashboard → SQL Editor.'
        : msg);
    }
  };

  useEffect(() => { loadTickets(); }, [session?.user?.id]);

  const handleSubmit = async () => {
    if (!session?.user) {
      pushToast({ kind: 'warning', title: 'Sign in to submit a ticket', duration: 3000 });
      return;
    }
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const fullBody = includeDiag
        ? `${body.trim()}\n\n---\n${getDiagnostics(APP_VERSION)}`
        : body.trim();
      const { error } = await supabase.from('support_tickets').insert({
        user_id: session.user.id,
        email: session.user.email,
        subject: subject.trim(),
        body: fullBody,
        category,
        app_version: APP_VERSION,
      });
      if (error) throw error;
      pushToast({ kind: 'success', title: 'Support ticket submitted', body: 'We\'ll get back to you by email.', duration: 4000 });
      setSubject('');
      setBody('');
      await loadTickets();
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'Could not submit', body: String(e?.message ?? e), duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  const categories: { id: Category; label: string; Icon: typeof Bug }[] = [
    { id: 'bug',     label: 'Bug report',  Icon: Bug },
    { id: 'feature', label: 'Feature idea', Icon: Lightbulb },
    { id: 'account', label: 'Account',      Icon: UserCircle },
    { id: 'general', label: 'General',      Icon: ChatCircle },
  ];

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Help"
        title="Support"
        subtitle="Found a bug, want to suggest a feature, or need help? Send a ticket."
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

      {!session?.user && (
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--sans)', fontSize: 12.5, lineHeight: 1.5,
          marginBottom: 22,
        }}>
          Sign in to submit a support ticket. We use your account email to reach back.
        </div>
      )}

      {}
      <div style={{ marginBottom: 14 }}>
        <Label>Category</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categories.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 999,
                background: category === id ? 'rgba(200,255,87,0.10)' : 'var(--bg-surface)',
                border: `1px solid ${category === id ? 'var(--accent)' : 'var(--border-default)'}`,
                color: category === id ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--sans)', fontSize: 12, fontWeight: category === id ? 600 : 500,
                cursor: 'pointer', transition: 'all 120ms',
              }}
            >
              <Icon size={13} weight={category === id ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Subject</Label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Quick summary"
          maxLength={120}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Label>Details</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder={
            category === 'bug'
              ? 'What happened? What did you expect? Steps to reproduce.'
              : 'Tell us more…'
          }
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)', minHeight: 120 }}
        />
      </div>

      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: includeDiag ? 'rgba(200,255,87,0.06)' : 'var(--bg-surface)',
        border: `1px solid ${includeDiag ? 'var(--accent)' : 'var(--border-default)'}`,
        cursor: 'pointer', marginBottom: 18,
        transition: 'all 120ms',
      }}>
        <input
          type="checkbox"
          checked={includeDiag}
          onChange={(e) => setIncludeDiag(e.target.checked)}
          style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
            Attach diagnostics
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            App version, browser info, and the last 50 captured errors. Helps us reproduce bugs.
          </div>
        </div>
      </label>

      <button
        onClick={handleSubmit}
        disabled={submitting || !session?.user || !subject.trim() || !body.trim()}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: submitting || !session?.user || !subject.trim() || !body.trim()
            ? 'var(--bg-elevated)' : 'var(--accent)',
          color: submitting || !session?.user || !subject.trim() || !body.trim()
            ? 'var(--text-muted)' : '#000',
          fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700,
          cursor: submitting || !session?.user || !subject.trim() || !body.trim()
            ? 'not-allowed' : 'pointer',
          transition: 'transform 120ms',
        }}
      >
        <PaperPlaneTilt size={13} weight="fill" />
        {submitting ? 'Sending…' : 'Send ticket'}
      </button>

      {tickets.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)',
            letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12,
          }}>
            Your tickets ({tickets.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const statusColors: Record<string, string> = {
    open: 'var(--accent)',
    in_progress: '#ffb84d',
    resolved: 'var(--success)',
    closed: 'var(--text-muted)',
  };
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {ticket.subject}
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--mono)', fontSize: 9.5,
          color: statusColors[ticket.status] ?? 'var(--text-muted)',
          letterSpacing: '0.05em', textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {ticket.status === 'resolved' && <Check size={9} weight="bold" />}
          {ticket.status.replace('_', ' ')}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--sans)', fontSize: 11.5, color: 'var(--text-muted)',
        display: 'flex', gap: 10,
      }}>
        <span style={{ textTransform: 'capitalize' }}>{ticket.category}</span>
        <span>·</span>
        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)',
      letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  outline: 'none',
};
