import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function HomePage({ data, setPage }) {
  const { usHoldings, usPrices, indiaHoldings, goals, usdInr } = data;

  // Value helper — MFs: units × currentNav only; others: currentValue
  const getVal = h => h.type==="MF"
    ? (h.units>0&&h.currentNav>0 ? h.units*h.currentNav : 0)
    : (h.currentValue||0);

  const usUSD   = usHoldings.reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0);
  const usINR   = usUSD * usdInr;

  // India: exclude NPS from liquid total (shown separately)
  const npsH    = indiaHoldings.find(h=>h.type==="NPS");
  const npsVal  = npsH ? (npsH.currentValue||0) : 0;
  const indiaV  = indiaHoldings.filter(h=>h.type!=="NPS").reduce((s,h)=>s+getVal(h),0);
  const total   = usINR + indiaV + npsVal;

  // G/L: only count holdings where current value is actually known (non-zero)
  // to avoid phantom losses from un-priced holdings
  const usGLH   = usHoldings.filter(h=>(usPrices[h.ticker]||0)>0);
  const usGLV   = usGLH.reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0)*usdInr;
  const usGLI   = usGLH.reduce((s,h)=>s+h.shares*h.avgCost,0)*usdInr;
  const indGLH  = indiaHoldings.filter(h=>h.type!=="NPS"&&getVal(h)>0);
  const indGLV  = indGLH.reduce((s,h)=>s+getVal(h),0);
  const indGLI  = indGLH.reduce((s,h)=>s+(h.invested||0),0);
  const glBase  = usGLI + indGLI;
  const totGain = (usGLV-usGLI) + (indGLV-indGLI);

  // For display: total invested (all holdings, for info)
  const usInv   = usHoldings.reduce((s,h)=>s+h.shares*h.avgCost,0) * usdInr;
  const indiaI  = indiaHoldings.filter(h=>h.type!=="NPS").reduce((s,h)=>s+(h.invested||0),0);
  const totInv  = usInv + indiaI;

  const ownerVals = OWNERS.map(o=>{
    const usV = usHoldings.filter(h=>h.owner===o.id).reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0)*usdInr;
    const inV = indiaHoldings.filter(h=>h.owner===o.id&&h.type!=="NPS").reduce((s,h)=>s+getVal(h),0);
    return { ...o, value:usV+inV };
  });

  const mfV   = indiaHoldings.filter(h=>h.type==="MF").reduce((s,h)=>s+getVal(h),0);
  const debtV = indiaHoldings.filter(h=>h.type==="PPF").reduce((s,h)=>s+(h.currentValue||0),0);

  // Allocation based on INVESTED amounts — always complete, no NAV gaps
  const usInvested   = usHoldings.reduce((s,h)=>s+h.shares*h.avgCost,0)*usdInr;
  const ntnxInvested = (usHoldings.find(h=>h.ticker==="NTNX")?.shares||0)
                       * (usHoldings.find(h=>h.ticker==="NTNX")?.avgCost||0) * usdInr;
  const etfInvested  = usInvested - ntnxInvested;
  const mfInvested   = indiaHoldings.filter(h=>h.type==="MF").reduce((s,h)=>s+(h.invested||0),0);
  const ppfVal       = indiaHoldings.filter(h=>h.type==="PPF").reduce((s,h)=>s+(h.currentValue||0),0);
  const allocTotal   = usInvested + mfInvested + ppfVal + npsVal;

  const alloc = [
    { name:"NTNX ESOP",       value:Math.round(ntnxInvested),         color:T.red },
    { name:"US ETFs",         value:Math.round(etfInvested),          color:T.blue   },
    { name:"India MF + PPF",  value:Math.round(mfInvested + ppfVal),  color:T.green  },
    { name:"NPS - Retirement Corpus", value:Math.round(npsVal),       color:T.purple },
  ].filter(d=>d.value>0);

  const geo = [
    { label:"🇮🇳 India", value:indiaV,  color:T.green },
    { label:"🇺🇸 US",    value:usINR,   color:T.blue  },
  ];

  const hasData = total > 0;

  return (
    <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>

      {/* Hero */}
      <Card accent={`linear-gradient(90deg,${T.blue},${T.green})`} style={{ padding:"22px 20px 18px" }}>
        <div style={{ fontSize:10, color:T.muted, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:8 }}>Total Wealth</div>
        <div style={{ fontSize:34, fontWeight:800, fontFamily:"monospace", letterSpacing:"-0.02em", color:T.text }}>
          {hasData ? inr(total) : <span style={{ color:T.dim }}>Add investments to begin</span>}
        </div>
        {hasData && (
          <div style={{ display:"flex", gap:20, marginTop:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:T.muted }}>Invested: <b style={{ color:T.text }}>{inr(totInv)}</b></span>
            {glBase>0 && (
              <span style={{ fontSize:13, color:gc(totGain) }}>
                {totGain>=0?"Unrealised Gain":"Unrealised Loss"}: <b>{inr(Math.abs(totGain))}</b>
                <span style={{ marginLeft:6, opacity:0.8 }}>({pct(totGain/glBase*100)})</span>
              </span>
            )}
            {glBase===0 && totInv>0 && (
              <span style={{ fontSize:12, color:T.muted }}>Set prices/NAVs to see gain/loss</span>
            )}
            <span style={{ fontSize:13, color:T.muted }}>1 USD = <b style={{ color:T.gold }}>₹{data.usdInr.toFixed(2)}</b></span>
          </div>
        )}
      </Card>

      {/* Owner cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {ownerVals.map(o=>(
          <Card key={o.id} accent={o.color} style={{ padding:"16px 14px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <OwnerBadge id={o.id}/>
              <span style={{ fontSize:13, fontWeight:600 }}>{o.name}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:o.color, fontFamily:"monospace" }}>
              {o.value>0 ? inr(o.value) : <span style={{ color:T.dim, fontSize:13 }}>No data</span>}
            </div>
            {total>0 && o.value>0 && (
              <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{((o.value/total)*100).toFixed(1)}% of total</div>
            )}
          </Card>
        ))}
      </div>

      {/* Allocation + Geography */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card style={{ padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em" }}>
              Asset Allocation
            </div>
            <div style={{ fontSize:9, color:T.dim }}>cost basis</div>
          </div>
          {alloc.length>0 ? alloc.map(d=>{
            const pct100 = allocTotal>0 ? (d.value/allocTotal*100) : 0;
            return (
              <div key={d.name} style={{ marginBottom:11 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4, alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ color:T.muted }}>{d.name}</span>

                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                    <span style={{ fontSize:10, color:T.dim }}>{inr(d.value)}</span>
                    <span style={{ color:d.color, fontWeight:700 }}>{pct100.toFixed(0)}%</span>
                  </div>
                </div>
                <ProgressBar value={d.value} max={Math.max(allocTotal,1)} color={d.color} h={6}/>
              </div>
            );
          }) : <div style={{ fontSize:12, color:T.dim, textAlign:"center", padding:"18px 0" }}>No data yet</div>}

        </Card>

        <Card style={{ padding:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:12 }}>Geography</div>
          {geo.map(d=>(
            <div key={d.label} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color:T.muted }}>{d.label}</span>
                <span style={{ color:d.color, fontWeight:600 }}>{total>0&&d.value>0?((d.value/total)*100).toFixed(0)+"%":"—"}</span>
              </div>
              <ProgressBar value={d.value} max={Math.max(total,1)} color={d.color} h={6}/>
            </div>
          ))}
          {usINR>0 && <div style={{ fontSize:11, color:T.dim, marginTop:6 }}>US in USD: <span style={{ color:T.blue }}>{usd(usUSD)}</span></div>}
        </Card>
      </div>

      {/* NPS Retirement Corpus */}
      {npsVal>0&&(
        <Card accent={T.purple} style={{padding:"16px 18px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:10,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>
                🔒 Retirement Corpus — NPS Tier I
              </div>
              <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:T.purple}}>{inr(npsVal)}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:3}}>
                Locked until retirement · ₹52,461/month auto · Market-linked
              </div>
            </div>
            <div style={{fontSize:11,color:T.dim,textAlign:"right"}}>
              Not included<br/>in liquid wealth
            </div>
          </div>
        </Card>
      )}

      {/* Goals snapshot */}
      {goals.length>0 && (
        <Card style={{ padding:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.12em" }}>🎯 Goals</div>
            <button onClick={()=>setPage("goals")}
              style={{ fontSize:11, color:T.blue, background:"none", border:"none", cursor:"pointer" }}>View all →</button>
          </div>
          {goals.map(g=>{
            const p = g.targetAmount>0 ? Math.min(100,(g.saved/g.targetAmount)*100) : 0;
            const sc = p>=100?T.green:T.blue;
            return (
              <div key={g.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{g.emoji} {g.name}</span>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:T.muted }}>{timeLeft(g.targetDate)} left</span>
                    <span style={{ fontSize:12, fontWeight:700, color:sc }}>{p.toFixed(0)}%</span>
                  </div>
                </div>
                <ProgressBar value={g.saved} max={g.targetAmount} color={sc} h={7}/>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.muted, marginTop:4 }}>
                  <span>{inr(g.saved)} of {inr(g.targetAmount)}</span>
                  <span>{fmtDate(g.targetDate)}</span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Quick actions */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        {[
          { icon:"🇺🇸", label:"US Portfolio",   page:"us",        val:usINR>0?`${usd(usUSD)} · ${inr(usINR)}`:null },
          { icon:"🇮🇳", label:"India Portfolio", page:"india",
            val:(indiaV+npsVal)>0?inr(indiaV+npsVal):null,
            sub:npsVal>0&&indiaV>0?`${inr(indiaV)} liquid + ${inr(npsVal)} NPS`:
                npsVal>0?`NPS ${inr(npsVal)} (retirement)`:
                indiaV>0?`${inr(indiaV)} liquid`:null },
          { icon:"🎯",  label:"Goals",           page:"goals",
            val:(()=>{
              const met=goals.filter(g=>g.targetAmount>0&&g.saved>=g.targetAmount).length;
              const active=goals.length-met;
              if(met>0&&active===0) return `🎉 All ${met} goal${met!==1?"s":""} met!`;
              if(met>0) return `${active} active · ${met} met 🎉`;
              return `${goals.length} goal${goals.length!==1?"s":""}`;
            })() },
          { icon:"📊",  label:"Analytics",       page:"analytics", val:hasData?"View insights":null },
        ].map(q=>(
          <Card key={q.page} onClick={()=>setPage(q.page)} style={{ padding:"14px 16px" }}
            accent={q.page==="us"?T.blue:q.page==="india"?T.green:q.page==="goals"?T.orange:T.purple}>
            <div style={{ fontSize:18, marginBottom:6 }}>{q.icon}</div>
            <div style={{ fontSize:13, fontWeight:600 }}>{q.label}</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:3 }}>{q.val||"No data yet"}</div>
            {q.sub&&<div style={{ fontSize:10, color:T.dim, marginTop:2 }}>{q.sub}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}
