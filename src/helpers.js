import { OWNERS } from './config';

// ── Number formatters ─────────────────────────────────────────────────────────
const CR = 10000000, L = 100000;

export const inr = (n) => {
  if (n >= CR)   return `₹${(n / CR).toFixed(2)} Cr`;
  if (n >= L)    return `₹${(n / L).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

export const usd = (n, sign = false) =>
  (sign ? (n >= 0 ? '+' : '-') : n < 0 ? '-' : '') +
  '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct  = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
export const gc   = (n, T) => n >= 0 ? T.green : T.red;
export const own  = (id) => OWNERS.find(o => o.id === id) || OWNERS[0];

export const fmtDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : 'Never';

export const daysLeft  = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000));
export const timeLeft  = (d) => {
  const days = daysLeft(d);
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  return y > 0 ? `${y}y ${m}m` : `${m}m`;
};

// ── Indian Financial Year (Apr 1 – Mar 31) ────────────────────────────────────
export const getIndianFY = () => {
  const now = new Date();
  const yr  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: `${yr}-04-01`,
    end:   `${yr + 1}-03-31`,
    label: `FY ${yr}-${String(yr + 1).slice(2)}`,
  };
};
