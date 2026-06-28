import { useState } from 'react';
import { T } from '../config';
import { inr } from '../helpers';
import { Card } from './shared';

const TODAY      = new Date();
const LTCG_LIMIT = 125000;
const LTCG_RATE  = 0.125;
const STCG_RATE  = 0.20;

function daysHeld(dateStr) {
  return Math.floor((TODAY - new Date(dateStr)) / 86400000);
}
function isLTCG(dateStr) { return daysHeld(dateStr) >= 365; }
function daysToLTCG(dateStr) { return Math.max(0, 365 - daysHeld(dateStr)); }
function ltcgDate(dateStr) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

// FIFO sell — returns { lots sold, stcg, ltcg, tax, netGain }
function simulateSell(lots, unitsTosell, currentNav) {
  let remaining = unitsTosell;
  let stcgGain = 0, ltcgGain = 0;
  const sorted = [...lots].sort((a,b) => new Date(a.date) - new Date(b.date));
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const sell = Math.min(remaining, lot.units);
    const gain = (currentNav - lot.nav) * sell;
    if (isLTCG(lot.date)) ltcgGain += gain;
    else stcgGain += gain;
    remaining -= sell;
  }
  const stcgTax  = Math.max(0, stcgGain) * STCG_RATE;
  const ltcgTax  = Math.max(0, ltcgGain - LTCG_LIMIT) * LTCG_RATE;
  const tax      = stcgTax + ltcgTax;
  const grossGain = stcgGain + ltcgGain;
  return { stcgGain, ltcgGain, stcgTax, ltcgTax, tax, grossGain, netGain: grossGain - tax };
}

function FundCard({ f }) {
  const [open,     setOpen]     = useState(false);
  const [sellMode, setSellMode] = useState('full');   // 'full'|'partial'
  const [sellBy,   setSellBy]   = useState('units');  // 'units'|'amount'
  const [sellVal,  setSellVal]  = useState('');

  const totalUnits = f.lots.reduce((s,l) => s+l.units, 0);
  const nav        = f.currentNav;

  // Units to sell
  const unitsToSell = sellMode === 'full'
    ? totalUnits
    : sellBy === 'units'
      ? parseFloat(sellVal) || 0
      : nav > 0 ? (parseFloat(sellVal)||0) / nav : 0;

  const sim     = simulateSell(f.lots, Math.min(unitsToSell, totalUnits), nav);
  const simFull = simulateSell(f.lots, totalUnits, nav);

  // Wait scenario — what if all lots become LTCG?
  const waitGain  = f.lots.reduce((s,l) => s + (nav - l.nav)*l.units, 0);
  const waitTax   = Math.max(0, waitGain - LTCG_LIMIT) * LTCG_RATE;
  const waitNet   = waitGain - waitTax;
  const taxSaving = Math.max(0, simFull.tax - waitTax);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div onClick={() => setOpen(o=>!o)} style={{
        padding:'14px 16px', cursor:'pointer',
        display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8,
      }}>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>{f.name}</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
            {f.lots.length} lot{f.lots.length!==1?'s':''} ·
            <span style={{ color:T.green }}> {f.lots.filter(l=>isLTCG(l.date)).length} LTCG</span>
            <span style={{ color:T.orange }}> {f.lots.filter(l=>!isLTCG(l.date)).length} STCG</span>
            · earliest LTCG: {fmtDate(ltcgDate(f.lots.slice().sort((a,b)=>new Date(a.date)-new Date(b.date))[0]?.date))}
          </div>
        </div>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          {simFull.stcgGain>0 && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, color:T.muted }}>STCG now</div>
              <div style={{ fontFamily:'monospace', fontWeight:700, color:T.orange, fontSize:13 }}>{inr(simFull.stcgGain)}</div>
            </div>
          )}
          {simFull.ltcgGain>0 && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, color:T.muted }}>LTCG now</div>
              <div style={{ fontFamily:'monospace', fontWeight:700, color:T.green, fontSize:13 }}>{inr(simFull.ltcgGain)}</div>
            </div>
          )}
          <div style={{ fontSize:12, color:T.muted }}>{open?'▲':'▼'}</div>
        </div>
      </div>

      {open && (
        <div style={{ borderTop:`1px solid ${T.border}` }}>

          {/* Lot table */}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:T.surf }}>
                {['Date','Days','Units','Buy NAV','Gross Gain','Net After Tax','Status'].map(h=>(
                  <th key={h} style={{
                    padding:'8px 12px', textAlign: h==='Date'||h==='Status'?'left':'right',
                    fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.lots.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map((lot,i)=>{
                const ltcg    = isLTCG(lot.date);
                const gross   = nav>0 ? (nav-lot.nav)*lot.units : 0;
                const tax     = ltcg
                  ? Math.max(0, gross-LTCG_LIMIT)*LTCG_RATE
                  : Math.max(0, gross)*STCG_RATE;
                const net     = gross - tax;
                return (
                  <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                    <td style={{ padding:'10px 12px' }}>{lot.date}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:T.muted }}>{daysHeld(lot.date)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'monospace' }}>{lot.units.toFixed(3)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'monospace', color:T.muted }}>₹{lot.nav.toFixed(2)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'monospace', color:gross>=0?T.green:T.red }}>
                      {gross>=0?'+':''}{inr(gross)}
                    </td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily:'monospace', color:net>=0?T.green:T.red }}>
                      {net>=0?'+':''}{inr(net)}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {ltcg
                        ? <span style={{ background:'rgba(27,175,122,0.15)', color:T.green, borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700 }}>LTCG</span>
                        : <span style={{ background:'rgba(255,152,0,0.15)', color:T.orange, borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700 }}>STCG · {daysToLTCG(lot.date)}d</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Today vs Wait comparison */}
          <div style={{ padding:'14px 16px', borderTop:`1px solid ${T.border}`, background:T.surf }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
              Sell all units — Today vs Wait for LTCG
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { label:'Sell Today', gain:simFull.grossGain, tax:simFull.tax, net:simFull.netGain, color:T.orange },
                { label:'Wait for LTCG', gain:waitGain, tax:waitTax, net:waitNet, color:T.green },
              ].map(s=>(
                <div key={s.label} style={{ background:T.card, borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:s.color, marginBottom:8 }}>{s.label}</div>
                  {[
                    { l:'Gross gain', v:s.gain },
                    { l:'Tax', v:-s.tax },
                    { l:'Net in hand', v:s.net, bold:true },
                  ].map(r=>(
                    <div key={r.l} style={{
                      display:'flex', justifyContent:'space-between', fontSize:12,
                      padding:'3px 0', borderTop: r.bold?`1px solid ${T.border}`:'none',
                      marginTop: r.bold?4:0, paddingTop: r.bold?6:3,
                    }}>
                      <span style={{ color:T.muted }}>{r.l}</span>
                      <span style={{ fontFamily:'monospace', fontWeight:r.bold?700:400,
                        color:r.v>=0?T.green:T.red }}>
                        {r.v>=0?'+':''}{inr(Math.abs(r.v))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {taxSaving>0&&(
              <div style={{ marginTop:10, fontSize:12, color:T.green, fontWeight:600, textAlign:'center' }}>
                💰 Tax saving by waiting: {inr(taxSaving)}
              </div>
            )}
          </div>

          {/* Sell Simulator */}
          <div style={{ padding:'14px 16px', borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>
              🧮 Sell Simulator
            </div>

            {/* Full / Partial toggle */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {['full','partial'].map(m=>(
                <button key={m} onClick={()=>{ setSellMode(m); setSellVal(''); }}
                  style={{
                    padding:'6px 16px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: sellMode===m ? T.blue : T.surf, color: sellMode===m ? '#fff' : T.muted,
                  }}>
                  {m==='full'?'Full holding':'Partial'}
                </button>
              ))}
            </div>

            {sellMode==='partial'&&(
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  {['units','amount'].map(b=>(
                    <button key={b} onClick={()=>{ setSellBy(b); setSellVal(''); }}
                      style={{
                        padding:'4px 12px', borderRadius:16, border:`1px solid ${T.border}`,
                        cursor:'pointer', fontSize:11, fontWeight:600,
                        background: sellBy===b ? T.surf : 'none', color: sellBy===b ? T.text : T.muted,
                      }}>
                      By {b==='units'?'Units':'Amount (₹)'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={sellVal}
                  onChange={e=>setSellVal(e.target.value)}
                  placeholder={sellBy==='units'?`Units (max ${totalUnits.toFixed(3)})`:`Amount in ₹`}
                  style={{
                    width:'100%', background:T.surf, border:`1px solid ${T.border}`,
                    borderRadius:8, padding:'10px 13px', color:T.text, fontSize:13, outline:'none',
                  }}
                />
                {sellBy==='amount'&&parseFloat(sellVal)>0&&nav>0&&(
                  <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
                    ≈ {(parseFloat(sellVal)/nav).toFixed(3)} units at NAV ₹{nav}
                  </div>
                )}
              </div>
            )}

            {/* Sim results */}
            {unitsToSell>0&&(
              <div style={{ background:T.surf, borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>
                  Selling {Math.min(unitsToSell,totalUnits).toFixed(3)} units · FIFO order
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
                  {[
                    { l:'Gross Gain', v:sim.grossGain, c:sim.grossGain>=0?T.green:T.red },
                    { l:'STCG Tax (20%)', v:-sim.stcgTax, c:T.red },
                    { l:'LTCG Tax (12.5%)', v:-sim.ltcgTax, c:T.red },
                    { l:'Net in hand', v:sim.netGain, c:sim.netGain>=0?T.green:T.red, bold:true },
                  ].map(item=>(
                    <div key={item.l} style={{ background:T.card, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{item.l}</div>
                      <div style={{ fontFamily:'monospace', fontWeight:item.bold?800:600, fontSize:14, color:item.c }}>
                        {item.v>=0?'+':''}{inr(Math.abs(item.v))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function TaxPage({ data }) {
  const mfLots   = data.mfLots || {};
  const holdings = (data.indiaHoldings||[]).filter(h=>h.type==='MF');

  const funds = holdings.map(h=>({
    ...h,
    lots: (mfLots[h.id]||[]),
  })).filter(f=>f.lots.length>0);

  // Portfolio totals
  const allLots   = funds.flatMap(f=>f.lots.map(l=>({ ...l, currentNav:f.currentNav })));
  const totalLTCG = allLots.filter(l=>isLTCG(l.date)).reduce((s,l)=>s+Math.max(0,(l.currentNav-l.nav)*l.units),0);
  const totalSTCG = allLots.filter(l=>!isLTCG(l.date)).reduce((s,l)=>s+Math.max(0,(l.currentNav-l.nav)*l.units),0);
  const ltcgTax   = Math.max(0,totalLTCG-LTCG_LIMIT)*LTCG_RATE;
  const stcgTax   = totalSTCG*STCG_RATE;
  const exemptUsed= Math.min(totalLTCG,LTCG_LIMIT);
  const exemptLeft= Math.max(0,LTCG_LIMIT-totalLTCG);

  // FY Tax calendar — when each lot crosses LTCG
  const calendar = funds.flatMap(f=>
    f.lots
      .filter(l=>!isLTCG(l.date))
      .map(l=>{
        const ltcgOn = ltcgDate(l.date);
        const estGain = f.currentNav>0 ? (f.currentNav-l.nav)*l.units : 0;
        return { date:ltcgOn, fundName:f.name, units:l.units, estGain, buyDate:l.date };
      })
  ).sort((a,b)=>a.date-b.date);

  const calByMonth = {};
  calendar.forEach(e=>{
    const key = e.date.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    if(!calByMonth[key]) calByMonth[key]=[];
    calByMonth[key].push(e);
  });

  return (
    <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
        {[
          { label:'LTCG Gains (≥1yr)', value:totalLTCG>0?inr(totalLTCG):'₹0', sub:'Tax @ 12.5% above ₹1.25L', color:totalLTCG>0?T.green:T.dim },
          { label:'STCG Gains (<1yr)',  value:totalSTCG>0?inr(totalSTCG):'₹0', sub:'Tax @ 20% on full amount', color:totalSTCG>0?T.orange:T.dim },
          { label:'₹1.25L Exemption',  value:inr(exemptLeft)+' left',           sub:`Used ${inr(exemptUsed)} this FY`, color:T.blue },
          { label:'Tax if sold today',  value:ltcgTax+stcgTax>0?inr(ltcgTax+stcgTax):'₹0', sub:'STCG + LTCG combined', color:ltcgTax+stcgTax>0?T.red:T.green },
        ].map(card=>(
          <Card key={card.label} accent={card.color} style={{ padding:'16px 16px 14px' }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>{card.label}</div>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:'monospace', color:card.color }}>{card.value}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{card.sub}</div>
          </Card>
        ))}
      </div>

      {/* FY Tax Calendar */}
      {Object.keys(calByMonth).length>0&&(
        <Card style={{ padding:'16px 18px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:14 }}>
            📅 LTCG Calendar — When lots become long-term
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.entries(calByMonth).map(([month,entries])=>(
              <div key={month}>
                <div style={{ fontSize:11, fontWeight:700, color:T.blue, marginBottom:6 }}>{month}</div>
                {entries.map((e,i)=>(
                  <div key={i} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'8px 12px', background:T.surf, borderRadius:8, marginBottom:4,
                    flexWrap:'wrap', gap:6,
                  }}>
                    <div>
                      <span style={{ fontSize:12, fontWeight:600 }}>{e.fundName}</span>
                      <span style={{ fontSize:11, color:T.muted, marginLeft:8 }}>{e.units.toFixed(3)} units · bought {e.buyDate}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontSize:12, color:T.green, fontFamily:'monospace', fontWeight:600 }}>
                        Est. gain: {inr(e.estGain)}
                      </span>
                      <span style={{ fontSize:10, color:T.muted, marginLeft:8 }}>→ LTCG on {fmtDate(e.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:T.dim, marginTop:10, lineHeight:1.6 }}>
            All gains above become LTCG on these dates. First ₹1.25L of LTCG per FY is tax-free.
          </div>
        </Card>
      )}

      {/* Per-fund cards */}
      <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em' }}>
        Fund-wise Breakdown & Sell Simulator
      </div>

      {funds.map(f=><FundCard key={f.id} f={f}/>)}

      <div style={{ fontSize:11, color:T.dim, lineHeight:1.7, padding:'4px 2px' }}>
        ⚠️ Estimates based on current NAVs. FIFO order applied for partial sells.
        ₹1.25L LTCG exemption applies per FY (Apr–Mar). Consult a tax advisor for filing.
      </div>
    </div>
  );
}
