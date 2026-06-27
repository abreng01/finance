import { useState } from 'react';
import { T } from '../config';
import { inr } from '../helpers';
import { Card } from './shared';

// ── Completely self-contained — adds nothing to IndiaPage scope ───────────────
export default function NPSProjection({ npsValue, npsHoldingId, transactions, currentAge }) {
  const [open, setOpen] = useState(false);

  // ── Constants ───────────────────────────────────────────────────────────────
  const MONTHLY    = 52461;
  const RETIRE_AGE = 60;
  const RATE_BASE  = 10;
  const age        = currentAge || 38;
  const years      = RETIRE_AGE - age;

  // ── Adhoc NPS contributions logged in Inflows ────────────────────────────
  const adhoc = (transactions || [])
    .filter(t => t.holdingId === (npsHoldingId || 'i9') && (t.amountINR || 0) > 0)
    .reduce((s, t) => s + (t.amountINR || 0), 0);

  const base = (npsValue || 0) + adhoc;

  // ── FV helper ────────────────────────────────────────────────────────────
  function fv(corpus, monthly, yrs, rate) {
    const mr = rate / 100 / 12;
    const n  = yrs * 12;
    const cf = corpus  * Math.pow(1 + rate / 100, yrs);
    const sf = monthly * (Math.pow(1 + mr, n) - 1) / mr * (1 + mr);
    return cf + sf;
  }

  // ── Pre-compute scenarios ─────────────────────────────────────────────────
  const scenarios = [
    { rate: 8,  label: 'Conservative' },
    { rate: 10, label: 'Base'         },
    { rate: 12, label: 'Optimistic'   },
  ].map(s => {
    const proj    = fv(base, MONTHLY, years, s.rate);
    const lump    = proj * 0.60;
    const pension = proj * 0.40 * 0.06 / 12;
    return { ...s, proj, lump, pension };
  });

  const baseScenario = scenarios[1]; // 10% base

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginTop: 0 }}>
      {/* Toggle strip */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'none',
          border: `1px dashed ${T.purple}40`, borderRadius: 8,
          padding: '8px 14px', cursor: 'pointer', color: T.purple,
          fontSize: 12, fontWeight: 600, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>📈 NPS Projection at age {RETIRE_AGE}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {/* Expanded panel */}
      {open && (
        <Card accent={T.purple} style={{ padding: '18px 18px 16px', marginTop: 8 }}>

          {/* Header numbers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
            gap: 10, marginBottom: 16,
          }}>
            {[
              { label: 'Base corpus today', value: inr(base),
                sub: adhoc > 0 ? `incl. ${inr(adhoc)} adhoc` : `age ${age} today`, color: T.purple },
              { label: 'Monthly (auto)',    value: '₹52,461',   sub: 'salary deduction',  color: T.text },
              { label: 'Years to retire',  value: `${years} yrs`, sub: `age ${age} → ${RETIRE_AGE}`, color: T.text },
            ].map(item => (
              <div key={item.label} style={{
                background: T.surf, borderRadius: 10, padding: '10px 13px',
              }}>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: item.color }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Projected corpus hero */}
          <div style={{
            background: 'rgba(149,117,205,0.08)',
            border: `1px solid rgba(149,117,205,0.25)`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>
              Projected corpus at age {RETIRE_AGE} · {RATE_BASE}% base return
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: T.purple }}>
              {inr(baseScenario.proj)}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 12, marginTop: 14,
            }}>
              <div>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>
                  60% lump sum (tax-free)
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: T.green, fontSize: 15 }}>
                  {inr(baseScenario.lump)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>
                  40% annuity → monthly pension
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: T.blue, fontSize: 15 }}>
                  {inr(baseScenario.pension)}/mo
                </div>
                <div style={{ fontSize: 10, color: T.dim }}>at ~6% annuity rate</div>
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <div style={{
            fontSize: 10, color: T.muted, textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 8,
          }}>
            Scenarios
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {scenarios.map(s => (
              <div key={s.rate} style={{
                background: T.surf, borderRadius: 8, padding: '10px 12px',
                border: s.rate === RATE_BASE ? `1px solid ${T.purple}` : `1px solid transparent`,
              }}>
                <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>
                  {s.label} ({s.rate}%)
                </div>
                <div style={{
                  fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                  color: s.rate === RATE_BASE ? T.purple : T.text,
                }}>
                  {inr(s.proj)}
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>
                  ~{inr(s.pension)}/mo pension
                </div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: 11, color: T.dim, lineHeight: 1.6,
            borderTop: `1px solid ${T.border}`, paddingTop: 10,
          }}>
            💡 Log extra NPS contributions in Inflows to update this projection automatically.
            Update NPS balance quarterly from your CRA statement.
          </div>
        </Card>
      )}
    </div>
  );
}
