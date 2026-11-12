import { useState } from 'react';
import { T } from '../config';
import { inr, usd } from '../helpers';
import { Card, ProgressBar } from './shared';

const TODAY = new Date();

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - TODAY) / 86400000);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

const VEST_SCHEDULE = [
  // Grant 1 — R0039363
  { grant:'R0039363', date:'2026-03-15', shares:344, vested:true  },
  { grant:'R0039363', date:'2026-06-15', shares:86,  vested:true  },
  { grant:'R0039363', date:'2026-09-15', shares:86,  vested:true  },
  { grant:'R0039363', date:'2026-12-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2027-03-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2027-06-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2027-09-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2027-12-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2028-03-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2028-06-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2028-09-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2028-12-15', shares:86,  vested:false },
  { grant:'R0039363', date:'2029-03-15', shares:86,  vested:false },
  // Grant 2 — R0041293
  { grant:'R0041293', date:'2025-12-15', shares:20,  vested:true  },
  { grant:'R0041293', date:'2026-03-15', shares:20,  vested:true  },
  { grant:'R0041293', date:'2026-06-15', shares:21,  vested:true  },
  { grant:'R0041293', date:'2026-09-15', shares:20,  vested:true  },
  { grant:'R0041293', date:'2026-12-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2027-03-15', shares:21,  vested:false },
  { grant:'R0041293', date:'2027-06-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2027-09-15', shares:21,  vested:false },
  { grant:'R0041293', date:'2027-12-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2028-03-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2028-06-15', shares:21,  vested:false },
  { grant:'R0041293', date:'2028-09-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2028-12-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2029-03-15', shares:21,  vested:false },
  { grant:'R0041293', date:'2029-06-15', shares:20,  vested:false },
  { grant:'R0041293', date:'2029-09-15', shares:21,  vested:false },

  // Grant 3 — FY27 refresh, granted 2026-11-10 (732 RSUs). Per-date split is an ESTIMATE; update from E*TRADE grant detail
  { grant:'FY27-NOV26', date:'2026-12-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2027-03-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2027-06-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2027-09-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2027-12-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2028-03-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2028-06-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2028-09-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2028-12-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2029-03-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2029-06-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2029-09-15', shares:46,  vested:false },
  { grant:'FY27-NOV26', date:'2029-12-15', shares:45,  vested:false },
  { grant:'FY27-NOV26', date:'2030-03-15', shares:45,  vested:false },
  { grant:'FY27-NOV26', date:'2030-06-15', shares:45,  vested:false },
  { grant:'FY27-NOV26', date:'2030-09-15', shares:45,  vested:false },
];

// Merge vests on same date across grants
function mergedSchedule() {
  const map = {};
  VEST_SCHEDULE.forEach(v => {
    if (!map[v.date]) map[v.date] = { date:v.date, shares:0, vested:v.vested };
    map[v.date].shares += v.shares;
  });
  return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
}

export default function VestSchedule({ ntnxPrice, usdInr }) {
  const [showAll, setShowAll] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planPrice, setPlanPrice] = useState(String(Math.round(ntnxPrice || 60)));
  const [planFx,    setPlanFx]    = useState(String(Math.round((usdInr || 95) * 100) / 100));
  const [planTax,   setPlanTax]   = useState('34.3');
  const [planFee,   setPlanFee]   = useState('30');

  const price   = ntnxPrice || 0;
  const fxRate  = usdInr    || 83.5;
  const merged  = mergedSchedule();
  const totalGranted  = VEST_SCHEDULE.reduce((s,v) => s+v.shares, 0);
  const totalVested   = VEST_SCHEDULE.filter(v=>v.vested).reduce((s,v) => s+v.shares, 0);
  const totalUnvested = totalGranted - totalVested;
  const upcoming      = merged.filter(v => !v.vested);
  const nextVest      = upcoming[0];
  const nextDays      = nextVest ? daysUntil(nextVest.date) : null;

  // Unvested value in INR
  const unvestedValueUSD = totalUnvested * price;
  const unvestedValueINR = unvestedValueUSD * fxRate;

  // Running cumulative shares for chart
  let cumVested = totalVested;

  // ── Take-home planner (what-if) ───────────────────────────────────────────
  const pp  = parseFloat(planPrice) || 0;
  const pfx = parseFloat(planFx)    || 0;
  const ptx = (parseFloat(planTax)  || 0) / 100;
  const pfe = parseFloat(planFee)   || 0;
  const planRows = upcoming.map(v => {
    const grossINR = v.shares * pp * pfx;
    const tax      = grossINR * ptx;
    const fees     = pfe * pfx;
    return { ...v, grossINR, tax, fees, net: grossINR - tax - fees };
  });
  const planYears = {};
  planRows.forEach(r => {
    const y = r.date.slice(0,4);
    if (!planYears[y]) planYears[y] = { shares:0, gross:0, tax:0, fees:0, net:0 };
    const a = planYears[y];
    a.shares += r.shares; a.gross += r.grossINR; a.tax += r.tax; a.fees += r.fees; a.net += r.net;
  });
  const planTotal = planRows.reduce((a,r) => ({
    shares:a.shares+r.shares, gross:a.gross+r.grossINR, tax:a.tax+r.tax, fees:a.fees+r.fees, net:a.net+r.net
  }), { shares:0, gross:0, tax:0, fees:0, net:0 });
  const planInp = { width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:6,
    padding:'6px 8px', color:T.text, fontFamily:'monospace', fontSize:13, boxSizing:'border-box' };

  const displayedUpcoming = showAll ? upcoming : upcoming.slice(0, 6);

  return (
    <Card style={{ padding: '18px 18px 16px', marginTop: 16 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:16 }}>
        <div>
          <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:5 }}>
            🔒 NTNX RSU Vest Schedule
          </div>
          <div style={{ fontSize:11, color:T.dim }}>
            3 grants · R0039363 + R0041293 + FY27-NOV26 · Quarterly vesting
          </div>
        </div>
        {nextVest && (
          <div style={{ textAlign:'right', background:`rgba(91,141,239,0.08)`, borderRadius:10, padding:'8px 14px', border:`1px solid rgba(91,141,239,0.2)` }}>
            <div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>Next vest in</div>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:'monospace', color:T.blue }}>
              {nextDays}d
            </div>
            <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>
              {fmtDate(nextVest.date)} · {nextVest.shares} shares
            </div>
            {price > 0 && (
              <div style={{ fontSize:11, color:T.green, marginTop:2, fontFamily:'monospace' }}>
                ≈ {inr(nextVest.shares * price * fxRate)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Granted',  value:String(totalGranted),           color:T.text    },
          { label:'Already Vested', value:String(totalVested),            color:T.green   },
          { label:'Unvested',       value:String(totalUnvested),          color:T.orange  },
          { label:'Unvested Value', value:price>0?inr(unvestedValueINR):'—', color:T.blue },
        ].map(c => (
          <div key={c.label} style={{ background:T.surf, borderRadius:10, padding:'10px 13px' }}>
            <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Vesting progress */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.muted, marginBottom:5 }}>
          <span>Vesting progress</span>
          <span>{((totalVested/totalGranted)*100).toFixed(1)}% vested · fully vests Sep 2030</span>
        </div>
        <ProgressBar value={totalVested} max={totalGranted} color={T.green} h={8}/>
      </div>

      {/* Upcoming vests table */}
      <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
        Upcoming vests
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {displayedUpcoming.map((v, i) => {
          const days     = daysUntil(v.date);
          const valueUSD = v.shares * price;
          const valueINR = valueUSD * fxRate;
          const isNext   = i === 0;
          return (
            <div key={v.date} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'10px 12px', borderRadius:8, flexWrap:'wrap', gap:8,
              background: isNext ? `rgba(91,141,239,0.06)` : T.surf,
              border: isNext ? `1px solid rgba(91,141,239,0.2)` : `1px solid transparent`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {isNext && <span style={{ fontSize:10, background:T.blue, color:'#fff', borderRadius:10, padding:'2px 8px', fontWeight:700 }}>NEXT</span>}
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{fmtDate(v.date)}</div>
                  <div style={{ fontSize:11, color:T.dim, marginTop:1 }}>
                    {days > 0 ? `in ${days} days` : 'Today'}
                    {days <= 30 && days > 0 && <span style={{ color:T.orange, marginLeft:6 }}>⚡ soon</span>}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'monospace', fontWeight:700, color:T.text }}>{v.shares} shares</div>
                  {price > 0 && (
                    <div style={{ fontSize:11, color:T.green, fontFamily:'monospace' }}>
                      ≈ {inr(valueINR)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {upcoming.length > 6 && (
        <button
          onClick={() => setShowAll(s => !s)}
          style={{ width:'100%', marginTop:10, background:'none', border:`1px dashed ${T.border}`,
            borderRadius:8, padding:'8px', color:T.muted, cursor:'pointer', fontSize:12 }}>
          {showAll ? '▲ Show less' : `▼ Show all ${upcoming.length} upcoming vests`}
        </button>
      )}

      {/* Vesting schedule year summary */}
      <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
          Shares vesting by year
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {['2026','2027','2028','2029','2030'].map(yr => {
            const yearShares = upcoming.filter(v=>v.date.startsWith(yr)).reduce((s,v)=>s+v.shares,0);
            const yearValueINR = yearShares * price * fxRate;
            if (!yearShares) return null;
            return (
              <div key={yr} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                <span style={{ color:T.muted, width:40 }}>{yr}</span>
                <div style={{ flex:1, margin:'0 12px' }}>
                  <div style={{ background:T.card, borderRadius:4, height:6, overflow:'hidden' }}>
                    <div style={{ width:`${(yearShares/totalUnvested)*100}%`, height:'100%', background:T.blue, borderRadius:4 }}/>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontFamily:'monospace', fontWeight:600 }}>{yearShares} shares</span>
                  {price > 0 && <span style={{ color:T.green, marginLeft:8, fontFamily:'monospace', fontSize:11 }}>≈{inr(yearValueINR)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Take-home planner */}
      <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
        <button onClick={() => setPlanOpen(o => !o)}
          style={{ width:'100%', background:'none', border:'none', padding:0, cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center', color:T.muted }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            🧮 Take-home planner (what-if)
          </span>
          <span style={{ fontSize:12 }}>{planOpen ? '▲' : '▼'}</span>
        </button>

        {planOpen && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:10, marginBottom:10 }}>
              {[
                { l:'NTNX price at vest ($)', v:planPrice, s:setPlanPrice },
                { l:'USD/INR',                v:planFx,    s:setPlanFx    },
                { l:'Tax rate (%)',           v:planTax,   s:setPlanTax   },
                { l:'Fees per sale ($)',      v:planFee,   s:setPlanFee   },
              ].map(f => (
                <div key={f.l}>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{f.l}</div>
                  <input type="number" value={f.v} onChange={e => f.s(e.target.value)} style={planInp}/>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
              {[50,60,70,80,100].map(n => (
                <button key={n} onClick={() => setPlanPrice(String(n))}
                  style={{ background: pp===n ? T.blue : T.surf, color: pp===n ? '#fff' : T.muted,
                    border:`1px solid ${T.border}`, borderRadius:14, padding:'3px 10px', fontSize:11, cursor:'pointer' }}>
                  ${n}
                </button>
              ))}
              {price > 0 && (
                <button onClick={() => setPlanPrice(String(Math.round(price*100)/100))}
                  style={{ background:T.surf, color:T.muted, border:`1px solid ${T.border}`, borderRadius:14,
                    padding:'3px 10px', fontSize:11, cursor:'pointer' }}>
                  Today ${price.toFixed(2)}
                </button>
              )}
              {[31.2,34.3,35.9].map(n => (
                <button key={n} onClick={() => setPlanTax(String(n))}
                  style={{ background: parseFloat(planTax)===n ? T.blue : T.surf,
                    color: parseFloat(planTax)===n ? '#fff' : T.muted,
                    border:`1px solid ${T.border}`, borderRadius:14, padding:'3px 10px', fontSize:11, cursor:'pointer' }}>
                  {n}% tax
                </button>
              ))}
            </div>

            {/* Totals */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:14 }}>
              {[
                { label:'Gross',      value:inr(planTotal.gross), color:T.text   },
                { label:'Tax',        value:inr(planTotal.tax),   color:T.red    },
                { label:'Fees',       value:inr(planTotal.fees),  color:T.orange },
                { label:'Take-home',  value:inr(planTotal.net),   color:T.green  },
              ].map(c => (
                <div key={c.label} style={{ background:T.surf, borderRadius:10, padding:'10px 13px' }}>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{c.label}</div>
                  <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:14, color:c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* By year */}
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>
              Take-home by year
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {Object.keys(planYears).sort().map(y => {
                const a = planYears[y];
                return (
                  <div key={y} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    background:T.surf, borderRadius:8, padding:'8px 12px', fontSize:12, flexWrap:'wrap', gap:6 }}>
                    <span style={{ fontWeight:600, width:44 }}>{y}</span>
                    <span style={{ color:T.muted, fontFamily:'monospace' }}>{a.shares} sh</span>
                    <span style={{ color:T.muted, fontFamily:'monospace' }}>gross {inr(a.gross)}</span>
                    <span style={{ color:T.green, fontFamily:'monospace', fontWeight:700 }}>net {inr(a.net)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize:10, color:T.dim, marginTop:10, lineHeight:1.6 }}>
              What-if only: assumes every batch is sold on vest day at the price above, taxed at a flat rate,
              with no US withholding. Real tax depends on your total income each year (surcharge slabs).
              Splits for the Nov-2026 grant are estimated.
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize:10, color:T.dim, marginTop:12, lineHeight:1.6 }}>
        💡 RSU vests are taxed as perquisite income in India at FMV on vest date.
        Values above are estimates at current NTNX price — actual vest value depends on price on vest date.
      </div>
    </Card>
  );
}
