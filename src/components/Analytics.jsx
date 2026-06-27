import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, own, fmtDate, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage({ data }) {
  const { usHoldings, usPrices, indiaHoldings, usdInr } = data;
  const usINR  = usHoldings.reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0)*usdInr;
  const mfV    = indiaHoldings.filter(h=>h.type==="MF").reduce((s,h)=>s+(h.currentValue||0),0);
  const ppfV   = indiaHoldings.filter(h=>h.type==="PPF").reduce((s,h)=>s+(h.currentValue||0),0);
  const npsV   = indiaHoldings.filter(h=>h.type==="NPS").reduce((s,h)=>s+(h.currentValue||0),0);
  const total  = usINR+mfV+ppfV+npsV;
  const equity = usINR+mfV;
  const debt   = ppfV+npsV;

  const ownerData = OWNERS.map(o=>{
    const uV=usHoldings.filter(h=>h.owner===o.id).reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0)*usdInr;
    const iV=indiaHoldings.filter(h=>h.owner===o.id).reduce((s,h)=>s+(h.currentValue||0),0);
    return {name:o.name,value:Math.round(uV+iV),color:o.color};
  }).filter(d=>d.value>0);

  const assetData = [
    {name:"US Equity",  value:Math.round(usINR), color:T.blue  },
    {name:"India MF",   value:Math.round(mfV),   color:T.green },
    {name:"PPF",        value:Math.round(ppfV),  color:T.gold  },
    {name:"NPS",        value:Math.round(npsV),  color:T.purple},
  ].filter(d=>d.value>0);

  const DonutChart = ({chartData,title}) => (
    <Card style={{padding:16}}>
      <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:10}}>{title}</div>
      {total===0?(
        <div style={{fontSize:12,color:T.dim,textAlign:"center",padding:"30px 0"}}>No data yet</div>
      ):(
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value">
                {chartData.map((d,i)=><Cell key={i} fill={d.color} stroke="transparent"/>)}
              </Pie>
              <Tooltip formatter={v=>[inr(v),"Value"]} contentStyle={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:4}}>
            {chartData.map(d=>(
              <div key={d.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:d.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:T.muted}}>{d.name}</span>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <span style={{fontSize:12,fontFamily:"monospace",color:T.text}}>{inr(d.value)}</span>
                  <span style={{fontSize:12,color:d.color,fontWeight:600,width:34,textAlign:"right"}}>{total>0?((d.value/total)*100).toFixed(0)+"%":"—"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
        <DonutChart chartData={assetData} title="Asset Allocation"/>
        <DonutChart chartData={ownerData} title="By Owner"/>
      </div>

      {/* Equity vs Debt */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <StatCard label="Total Equity" value={equity?inr(equity):"—"} sub={total>0?((equity/total)*100).toFixed(0)+"% of portfolio":""} color={T.green} accent={T.green}/>
        <StatCard label="Total Debt"   value={debt?inr(debt):"—"}     sub={total>0?((debt/total)*100).toFixed(0)+"% of portfolio":""}   color={T.gold}  accent={T.gold}/>
      </div>

      {/* Breakdown bars */}
      <Card style={{padding:18}}>
        <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:14}}>Investment Breakdown</div>
        {[
          {label:"US Equity (ETF + ESOP)", value:usINR,  color:T.blue   },
          {label:"India Mutual Funds",     value:mfV,    color:T.green  },
          {label:"PPF",                    value:ppfV,   color:T.gold   },
          {label:"NPS",                    value:npsV,   color:T.purple },
        ].map(r=>(
          <div key={r.label} style={{marginBottom:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:13,color:T.muted}}>{r.label}</span>
              <div style={{display:"flex",gap:14}}>
                <span style={{fontSize:13,fontFamily:"monospace",color:T.text}}>{r.value?inr(r.value):"—"}</span>
                <span style={{fontSize:13,color:r.color,fontWeight:600,width:38,textAlign:"right"}}>{total>0?((r.value/total)*100).toFixed(0)+"%":"—"}</span>
              </div>
            </div>
            <ProgressBar value={r.value} max={Math.max(total,1)} color={r.color} h={6}/>
          </div>
        ))}
      </Card>

      {/* Geography */}
      <Card style={{padding:18}}>
        <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:14}}>Geography</div>
        {[{label:"🇮🇳 India",value:mfV+ppfV+npsV,color:T.green},{label:"🇺🇸 US",value:usINR,color:T.blue}].map(r=>(
          <div key={r.label} style={{marginBottom:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:13,color:T.muted}}>{r.label}</span>
              <div style={{display:"flex",gap:14}}>
                <span style={{fontSize:13,fontFamily:"monospace",color:T.text}}>{r.value?inr(r.value):"—"}</span>
                <span style={{fontSize:13,color:r.color,fontWeight:600,width:38,textAlign:"right"}}>{total>0?((r.value/total)*100).toFixed(0)+"%":"—"}</span>
              </div>
            </div>
            <ProgressBar value={r.value} max={Math.max(total,1)} color={r.color} h={6}/>
          </div>
        ))}
      </Card>
    </div>
  );
}
