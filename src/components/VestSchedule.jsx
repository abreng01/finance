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
  { grant:'R0039363', date:'2026-09-15', shares:86,  vested:false },
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
  { grant:'R0041293', date:'2026-09-15', shares:20,  vested:false },
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
            2 grants · R0039363 + R0041293 · Quarterly vesting
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
          <span>{((totalVested/totalGranted)*100).toFixed(1)}% vested · fully vests Sep 2029</span>
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
          {['2026','2027','2028','2029'].map(yr => {
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

      <div style={{ fontSize:10, color:T.dim, marginTop:12, lineHeight:1.6 }}>
        💡 RSU vests are taxed as perquisite income in India at FMV on vest date.
        Values above are estimates at current NTNX price — actual vest value depends on price on vest date.
      </div>
    </Card>
  );
}
