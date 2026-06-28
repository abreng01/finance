import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// GOALS PAGE
// ══════════════════════════════════════════════════════════════════════════════
const GOAL_EMOJIS = ["🎯","🚗","🏠","🎓","🏖️","💍","✈️","💰","📱","🏋️","🌏","👶"];

// Binary search months to hit target with monthly SIP + returns
function monthsToHit(corpus, monthly, target, annualRate) {
  if(corpus >= target) return 0;
  if(monthly <= 0) return Infinity;
  if(annualRate === 0) return Math.ceil((target - corpus) / monthly);
  const r = annualRate / 100 / 12;
  let lo = 0, hi = 600;
  for(let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const fv  = corpus * Math.pow(1+r, mid) + monthly * (Math.pow(1+r, mid) - 1) / r * (1+r);
    if(fv >= target) hi = mid; else lo = mid;
  }
  return Math.ceil(hi);
}

function addMonths(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function GoalsPage({ data, setData }) {
  const { goals } = data;
  const [showEdit, setShowEdit] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({name:"",emoji:"🎯",targetAmount:"",targetDate:"",saved:"",note:""});
  const [delId,    setDelId]    = useState(null);

  // Corpus goal state
  const cg = data.corpusGoal || { target: 10000000, returnRate: 12, monthlyInv: 200000 };
  const [cgTarget,   setCgTarget]   = useState(cg.target);
  const [cgRate,     setCgRate]     = useState(cg.returnRate);
  const [cgMonthly,  setCgMonthly]  = useState(cg.monthlyInv);

  const upd = p => setData(d=>({...d,...p}));

  // Save corpus goal settings
  const saveCG = (t, r, m) => {
    upd({ corpusGoal: { target: t||cgTarget, returnRate: r??cgRate, monthlyInv: m||cgMonthly } });
  };

  const openAdd  = () => { setEditId(null); setForm({name:"",emoji:"🎯",targetAmount:"",targetDate:"",saved:"",note:""}); setShowEdit(true); };
  const openEdit = g  => { setEditId(g.id); setForm({name:g.name,emoji:g.emoji,targetAmount:String(g.targetAmount),targetDate:g.targetDate,saved:String(g.saved||0),note:g.note||""}); setShowEdit(true); };

  const submitForm = () => {
    if(!form.name.trim()||!form.targetDate) return;
    const entry={name:form.name,emoji:form.emoji||"🎯",targetAmount:parseFloat(form.targetAmount)||0,targetDate:form.targetDate,saved:parseFloat(form.saved)||0,note:form.note};
    upd({goals:editId?goals.map(g=>g.id===editId?{...g,...entry}:g):[...goals,{id:"g"+Date.now(),...entry}]});
    setShowEdit(false);
  };

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
      {/* ── Corpus Goal Tracker ─────────────────────────────────────────────── */}
      {(()=>{
        // Current corpus = MF values + PPF (excludes NPS)
        const mfV    = (data.indiaHoldings||[]).filter(h=>h.type==="MF")
          .reduce((s,h)=>s+(h.units>0&&h.currentNav>0?h.units*h.currentNav:0),0);
        const ppfV   = (data.indiaHoldings||[]).find(h=>h.type==="PPF")?.currentValue||0;
        const corpus = mfV + ppfV;
        const prog   = Math.min(100,(corpus/cgTarget)*100);
        const sc     = prog>=100?T.green:prog>=50?T.blue:T.orange;

        // Months with and without returns
        const mWithR  = monthsToHit(corpus, cgMonthly, cgTarget, cgRate);
        const mNoR    = monthsToHit(corpus, cgMonthly, cgTarget, 0);

        // This month invested toward MF corpus (pool topups + direct MF transactions)
        const now     = new Date();
        const monthKey= `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const poolThis= (data.poolTransactions||[])
          .filter(t=>t.type==="topup"&&(t.date||"").startsWith(monthKey))
          .reduce((s,t)=>s+(t.amount||0),0);
        const txThis  = (data.transactions||[])
          .filter(t=>(t.date||"").startsWith(monthKey)&&t.portfolio==="india"&&t.holdingId!=="pool")
          .reduce((s,t)=>s+(t.amountINR||0),0);
        const thisMonth = poolThis + txThis;
        const shortfall = cgMonthly - thisMonth;
        const onTrack   = thisMonth >= cgMonthly;

        // If this month is short, how many extra months does that add?
        const adjCorpus = corpus + thisMonth;
        const adjMonths = monthsToHit(adjCorpus, cgMonthly, cgTarget, cgRate);

        return (
          <Card accent={sc} style={{padding:"18px 18px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4}}>
                  📈 Corpus Goal Tracker
                </div>
                <div style={{display:"flex",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
                  {[10000000,30000000,50000000].map(t=>(
                    <button key={t} onClick={()=>{setCgTarget(t);saveCG(t,null,null);}}
                      style={{padding:"3px 12px",borderRadius:16,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
                        background:cgTarget===t?T.blue:"rgba(255,255,255,0.07)",
                        color:cgTarget===t?"#fff":T.muted}}>
                      {t===10000000?"₹1Cr":t===30000000?"₹3Cr":"₹5Cr"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:22,fontWeight:800,fontFamily:"monospace",color:sc}}>{inr(corpus)}</div>
                <div style={{fontSize:11,color:T.muted}}>of {inr(cgTarget)} target · {prog.toFixed(1)}%</div>
              </div>
            </div>

            {/* Progress bar */}
            <ProgressBar value={corpus} max={cgTarget} color={sc} h={10}/>

            {/* Projections */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
              <div style={{background:T.surf,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:T.muted,marginBottom:6}}>
                  🔄 With {cgRate}% returns
                </div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:T.green}}>
                  {mWithR===0?"Already there!":mWithR>600?"50+ years":addMonths(mWithR)}
                </div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                  {mWithR>0&&mWithR<=600?`${mWithR} months away`:""}
                </div>
              </div>
              <div style={{background:T.surf,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:T.muted,marginBottom:6}}>
                  💰 Principal only (no returns)
                </div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:T.blue}}>
                  {mNoR===0?"Already there!":mNoR>600?"50+ years":addMonths(mNoR)}
                </div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                  {mNoR>0&&mNoR<=600?`${mNoR} months away`:""}
                </div>
              </div>
            </div>

            {/* Return rate slider */}
            <div style={{marginTop:14,background:T.surf,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:T.muted}}>Expected return</span>
                <span style={{fontWeight:700,color:T.green,fontFamily:"monospace"}}>{cgRate}% p.a.</span>
              </div>
              <input type="range" min={0} max={20} step={0.5} value={cgRate}
                onChange={e=>{const v=parseFloat(e.target.value);setCgRate(v);saveCG(null,v,null);}}
                style={{width:"100%"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.dim,marginTop:2}}>
                <span>0% (no return)</span><span>10% (moderate)</span><span>20% (aggressive)</span>
              </div>
            </div>

            {/* Monthly investment control */}
            <div style={{marginTop:10,background:T.surf,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,color:T.muted}}>Monthly MF investment</span>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {[100000,150000,200000,250000].map(v=>(
                    <button key={v} onClick={()=>{setCgMonthly(v);saveCG(null,null,v);}}
                      style={{padding:"2px 8px",borderRadius:12,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                        background:cgMonthly===v?T.blue:"rgba(255,255,255,0.07)",
                        color:cgMonthly===v?"#fff":T.muted}}>
                      {inr(v)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{fontSize:11,color:T.muted}}>
                Need <b style={{color:T.text,fontFamily:"monospace"}}>{inr(cgMonthly)}/mo</b> to stay on track
              </div>
            </div>

            {/* This month on-track indicator */}
            <div style={{marginTop:10,padding:"12px 14px",borderRadius:10,
              background:onTrack?"rgba(27,175,122,0.08)":"rgba(255,94,107,0.08)",
              border:`1px solid ${onTrack?T.green:T.red}30`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:onTrack?T.green:T.red}}>
                    {onTrack?"✅ On track this month":"⚠️ Behind this month"}
                  </div>
                  <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                    Invested <b style={{fontFamily:"monospace",color:T.text}}>{inr(thisMonth)}</b> of <b style={{fontFamily:"monospace"}}>{inr(cgMonthly)}</b> needed
                    {!onTrack&&shortfall>0&&<span style={{color:T.red}}> · {inr(shortfall)} short</span>}
                  </div>
                </div>
                {!onTrack&&thisMonth>0&&(
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:T.muted}}>Adjusted target date</div>
                    <div style={{fontSize:13,fontWeight:700,color:T.orange,fontFamily:"monospace"}}>
                      {addMonths(adjMonths)}
                    </div>
                    <div style={{fontSize:10,color:T.dim}}>
                      vs {addMonths(mWithR)} on track
                    </div>
                  </div>
                )}
                {thisMonth===0&&(
                  <div style={{fontSize:11,color:T.dim}}>Log investments in Inflows to track</div>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,fontWeight:600}}>Financial Goals</div>
        <Btn onClick={openAdd} variant="primary">+ Add Goal</Btn>
      </div>

      {goals.length===0 && (
        <Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🎯</div>
          <div style={{fontWeight:600,color:T.text,marginBottom:6}}>No goals yet</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Define your financial goals and track progress</div>
          <Btn onClick={openAdd} variant="primary">+ Add First Goal</Btn>
        </Card>
      )}

      {goals.map(g=>{
        const p    = g.targetAmount>0 ? Math.min(100,(g.saved/g.targetAmount)*100) : 0;
        const rem  = Math.max(0,g.targetAmount-g.saved);
        const days = daysLeft(g.targetDate);
        const sc   = p>=100?T.green:p>50?T.blue:T.orange;
        const mthly= rem>0&&days>0 ? rem/(days/30) : 0;
        return (
          <Card key={g.id} accent={sc} style={{padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:28,lineHeight:1,marginBottom:6}}>{g.emoji}</div>
                <div style={{fontSize:16,fontWeight:700}}>{g.name}</div>
                {g.note && <div style={{fontSize:12,color:T.muted,marginTop:2}}>{g.note}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:26,fontWeight:800,color:sc,fontFamily:"monospace"}}>{p.toFixed(0)}%</div>
                <div style={{fontSize:11,color:T.muted}}>{p<100?`${timeLeft(g.targetDate)} left`:"✅ Achieved!"}</div>
                <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
                  <Btn onClick={()=>openEdit(g)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
                  <Btn onClick={()=>setDelId(g.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
                </div>
              </div>
            </div>

            <ProgressBar value={g.saved} max={g.targetAmount} color={sc} h={10}/>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:14}}>
              {[{l:"Saved",v:inr(g.saved),c:T.green},{l:"Target",v:inr(g.targetAmount),c:T.text},{l:"Remaining",v:inr(rem),c:T.orange}].map(s=>(
                <div key={s.l}>
                  <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{s.l}</div>
                  <div style={{fontSize:15,fontWeight:700,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`,fontSize:12,color:T.muted,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
              <span>🗓 Target: {fmtDate(g.targetDate)}</span>
              {mthly>0 && <span style={{color:T.dim}}>Save {inr(mthly)}/month to reach goal</span>}
            </div>
          </Card>
        );
      })}

      {showEdit && (
        <Modal onClose={()=>setShowEdit(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:18}}>{editId?"Edit":"Add"} Goal</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Icon</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {GOAL_EMOJIS.map(e=>(
                  <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))}
                    style={{width:38,height:38,borderRadius:9,cursor:"pointer",fontSize:20,
                      border:`1px solid ${form.emoji===e?T.green:T.border}`,background:form.emoji===e?"rgba(0,229,160,0.1)":"transparent"}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <Inp label="Goal Name *" value={form.name} placeholder="e.g. New Car" onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Inp label="Target Amount (₹)" value={form.targetAmount} placeholder="1500000" onChange={e=>setForm(p=>({...p,targetAmount:e.target.value}))} mono/>
              <Inp label="Already Saved (₹)" value={form.saved}        placeholder="0"       onChange={e=>setForm(p=>({...p,saved:e.target.value}))}        mono/>
            </div>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Target Date *</div>
              <input type="date" value={form.targetDate} onChange={e=>setForm(p=>({...p,targetDate:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
            </div>
            <Inp label="Note (optional)" value={form.note} placeholder="Short term goal" onChange={e=>setForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowEdit(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?"Save Changes":"Add Goal"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {delId && <DelConfirm label={goals.find(g=>g.id===delId)?.name} onConfirm={()=>{upd({goals:goals.filter(g=>g.id!==delId)});setDelId(null);}} onCancel={()=>setDelId(null)}/>}
    </div>
  );
}
