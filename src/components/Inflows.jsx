import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// INFLOWS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function InflowsPage({ data, setData }) {
  const { transactions=[], indiaHoldings, usHoldings, usdInr, monthlyInflowTarget=252000, poolTransactions=[] } = data;
  const [showDeployInflows, setShowDeployInflows] = useState(false);
  const [deployInflowForm, setDeployInflowForm]   = useState({owner:"abilash",amount:"",fundId:"",date:new Date().toISOString().slice(0,10),note:""});

  // Pool balance helpers (mirrored from India page)
  const poolBal = (owner) => poolTransactions
    .filter(t=>t.owner===owner)
    .reduce((s,t)=>t.type==="topup"?s+t.amount:s-t.amount,0);
  const totalPool = OWNERS.reduce((s,o)=>s+Math.max(0,poolBal(o.id)),0);

  const submitDeployInflows = () => {
    const amt = parseFloat(deployInflowForm.amount)||0;
    if(!amt||!deployInflowForm.fundId) return;
    const pt = {id:"pt"+Date.now(),type:"deploy",owner:deployInflowForm.owner,
      amount:amt,date:deployInflowForm.date,fundId:deployInflowForm.fundId,note:deployInflowForm.note};
    const holding = indiaHoldings.find(h=>h.id===deployInflowForm.fundId);
    const addUnits = holding&&holding.currentNav>0 ? amt/holding.currentNav : 0;
    const newHoldings = indiaHoldings.map(h=>h.id===deployInflowForm.fundId
      ?{...h,units:+(h.units+addUnits).toFixed(4),invested:+(h.invested+amt).toFixed(2)}:h);
    setData(d=>({...d,poolTransactions:[...poolTransactions,pt],indiaHoldings:newHoldings}));
    setShowDeployInflows(false);
    setDeployInflowForm({owner:"abilash",amount:"",fundId:"",date:new Date().toISOString().slice(0,10),note:""});
  };
  const [showAdd, setShowAdd] = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [form,    setForm]    = useState({ date:new Date().toISOString().slice(0,10), portfolio:"india", holdingId:"", amount:"", note:"" });
  const upd = p => setData(d=>({...d,...p}));

  const submitForm = () => {
    if(!form.holdingId||!form.amount) return;
    const amt   = parseFloat(form.amount); if(!(amt>0)) return;
    const isUS  = form.portfolio==="us";
    const hold  = (isUS?usHoldings:indiaHoldings).find(h=>h.id===form.holdingId);
    const amtINR= isUS ? amt*usdInr : amt;
    const entry = { id:editId||"t"+Date.now(), date:form.date, portfolio:form.portfolio,
      holdingId:form.holdingId, holdingName:isUS?`${hold?.ticker} — ${hold?.name}`:hold?.name||"",
      owner:hold?.owner||"abilash", amount:amt, currency:isUS?"USD":"INR", amountINR:amtINR, note:form.note };
    upd({transactions: editId ? transactions.map(t=>t.id===editId?entry:t) : [...transactions,entry]});
    setShowAdd(false); setEditId(null);
  };

  const openAdd  = () => { setEditId(null); setForm({date:new Date().toISOString().slice(0,10),portfolio:"india",holdingId:"",amount:"",note:""}); setShowAdd(true); };
  const openEdit = t  => { setEditId(t.id); setForm({date:t.date,portfolio:t.portfolio,holdingId:t.holdingId,amount:String(t.amount),note:t.note||""}); setShowAdd(true); };

  // Derived
  const now          = new Date();
  const thisMonthKey = now.toISOString().slice(0,7);
  const ytdKey       = String(now.getFullYear());
  const thisMonth    = transactions.filter(t=>t.date.startsWith(thisMonthKey));
  // Pool top-ups count toward monthly target but are tracked separately
  const poolThisMonth = poolTransactions.filter(t=>t.type==="topup"&&t.date.startsWith(thisMonthKey));
  const poolYTD       = poolTransactions.filter(t=>t.type==="topup"&&t.date.startsWith(ytdKey));
  const thisMonthINR  = thisMonth.reduce((s,t)=>s+t.amountINR,0)
                      + poolThisMonth.reduce((s,t)=>s+t.amount,0);
  const ytdINR        = transactions.filter(t=>t.date.startsWith(ytdKey)).reduce((s,t)=>s+t.amountINR,0)
                      + poolYTD.reduce((s,t)=>s+t.amount,0);

  // Group by month descending
  // Combine regular transactions + pool top-ups for the log display
  const poolTopUps = poolTransactions.filter(t=>t.type==="topup").map(t=>({
    id:t.id, date:t.date, holdingName:`💧 Pool Top-Up (${own(t.owner).name})`,
    portfolio:"india", amountINR:t.amount, amount:t.amount,
    owner:t.owner, currency:"INR", note:t.note, isPool:true,
  }));
  const allEntries = [...transactions, ...poolTopUps];
  const grouped = {};
  [...allEntries].sort((a,b)=>b.date.localeCompare(a.date)).forEach(t=>{
    const k=t.date.slice(0,7); if(!grouped[k]) grouped[k]=[]; grouped[k].push(t);
  });
  const months = Object.keys(grouped).sort().reverse();

  // Bar chart — last 12 months
  const barData = Array.from({length:12},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
    const k = d.toISOString().slice(0,7);
    const label = d.toLocaleDateString("en-IN",{month:"short"});
    return { label, total:Math.round((grouped[k]||[]).reduce((s,t)=>s+t.amountINR,0)), isCurrent:k===thisMonthKey };
  });

  const fmtMonth = k => new Date(k+"-01").toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const fmtDay   = d => new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"});

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>

      {/* Monthly target progress hero */}
      {(() => {
        const target  = data.monthlyInflowTarget||0;
        const pctDone = target>0 ? Math.min(100,(thisMonthINR/target)*100) : 0;
        const remaining = Math.max(0, target-thisMonthINR);
        const statusColor = pctDone>=100 ? T.green : pctDone>=60 ? T.blue : T.orange;
        return (
          <Card accent={statusColor} style={{padding:"20px 20px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <div style={{fontSize:10,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>
                  This Month — {new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}
                </div>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                  <span style={{fontSize:30,fontWeight:800,fontFamily:"monospace",color:statusColor,letterSpacing:"-0.02em"}}>
                    {thisMonthINR?inr(thisMonthINR):"₹0"}
                  </span>
                  <span style={{fontSize:14,color:T.muted}}>of {inr(target)} target</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:28,fontWeight:800,color:statusColor,fontFamily:"monospace"}}>{pctDone.toFixed(0)}%</div>
                {pctDone<100
                  ? <div style={{fontSize:12,color:T.muted,marginTop:2}}>{inr(remaining)} remaining</div>
                  : <div style={{fontSize:12,color:T.green,fontWeight:600,marginTop:2}}>Target met 🎉</div>
                }
              </div>
            </div>
            <ProgressBar value={thisMonthINR} max={Math.max(target,1)} color={statusColor} h={10}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginTop:8,flexWrap:"wrap",gap:6}}>
              <span>{thisMonth.length} entr{thisMonth.length===1?"y":"ies"} this month</span>
              <span>{ytdKey} YTD: <b style={{color:T.text,fontFamily:"monospace"}}>{ytdINR?inr(ytdINR):"₹0"}</b></span>
              <button onClick={()=>{
                const t=prompt("Monthly inflow target (₹):",String(data.monthlyInflowTarget||252000));
                const v=parseFloat(t); if(v>0) setData(d=>({...d,monthlyInflowTarget:v}));
              }} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:11,fontWeight:600,padding:0}}>
                ✏️ Edit target
              </button>
            </div>
          </Card>
        );
      })()}

      )}


      {/* Deployment Pool strip */}
      {totalPool>0&&(
        <Card style={{padding:"14px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontSize:10,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:5}}>
                💧 Deployment Pool
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:T.gold}}>{inr(totalPool)}</span>
                {OWNERS.map(o=>{
                  const b=poolBal(o.id);
                  return b>0?(
                    <span key={o.id} style={{fontSize:12,color:o.color,fontWeight:600}}>
                      <OwnerBadge id={o.id}/>{" "}{inr(b)}
                    </span>
                  ):null;
                })}
              </div>
            </div>
            <Btn onClick={()=>{
              const firstOwner=OWNERS.find(o=>poolBal(o.id)>0);
              const def=firstOwner?firstOwner.id:"abilash";
              setDeployInflowForm({owner:def,amount:String(poolBal(def)||""),fundId:"",
                date:new Date().toISOString().slice(0,10),note:""});
              setShowDeployInflows(true);
            }} variant="primary">→ Deploy to MF</Btn>
          </div>
        </Card>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
        <StatCard label="This Month"     value={thisMonthINR?inr(thisMonthINR):"—"} color={T.green} accent={T.green}/>
        <StatCard label={`${ytdKey} YTD`}value={ytdINR?inr(ytdINR):"—"}             color={T.blue}  accent={T.blue}/>
        <StatCard label="Total Entries"  value={String(transactions.length)}         color={T.muted}
          sub={`${months.length} month${months.length!==1?"s":""}`}/>
      </div>

      {/* Action */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,fontWeight:600}}>Investment Log</div>
        <Btn onClick={openAdd} variant="primary">+ Log Investment</Btn>
      </div>

      {/* Bar chart */}
      {transactions.length>0 && (
        <Card style={{padding:16}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:12}}>Monthly Inflows — Last 12 Months</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData} barSize={16} margin={{top:4,right:4,left:4,bottom:0}}>
              <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Tooltip formatter={v=>[inr(v),"Invested"]} contentStyle={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}
                labelStyle={{color:T.muted}} cursor={{fill:"rgba(255,255,255,0.04)"}}/>
              <Bar dataKey="total" radius={[4,4,0,0]}>
                {barData.map((d,i)=><Cell key={i} fill={d.isCurrent?T.green:T.blue} fillOpacity={d.isCurrent?1:0.45}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Monthly groups */}
      {months.length===0 ? (
        <Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>💰</div>
          <div style={{fontWeight:600,color:T.text,marginBottom:6}}>No investments logged yet</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Log your monthly investments to track inflows over time</div>
          <Btn onClick={openAdd} variant="primary">+ Log First Investment</Btn>
        </Card>
      ) : months.map(month=>{
        const entries  = grouped[month];
        const monthINR = entries.reduce((s,t)=>s+t.amountINR,0);
        const indiaINR = entries.filter(t=>t.portfolio==="india").reduce((s,t)=>s+t.amountINR,0);
        const usINR    = entries.filter(t=>t.portfolio==="us").reduce((s,t)=>s+t.amountINR,0);
        return (
          <Card key={month} style={{overflow:"hidden"}}>
            {/* Month header */}
            <div style={{padding:"12px 16px",background:T.surf,borderBottom:`1px solid ${T.border}`,
              display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{fontWeight:700,fontSize:13}}>{fmtMonth(month)}</div>
              <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
                {indiaINR>0&&<span style={{fontSize:11,color:T.green}}>🇮🇳 {inr(indiaINR)}</span>}
                {usINR>0&&<span style={{fontSize:11,color:T.blue}}>🇺🇸 {inr(usINR)}</span>}
                <span style={{fontSize:14,fontWeight:800,fontFamily:"monospace",color:T.text}}>{inr(monthINR)}</span>
              </div>
            </div>
            {/* Entries */}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <tbody>
                {entries.map((t,idx)=>(
                  <tr key={t.id} style={{borderBottom:idx<entries.length-1?`1px solid ${T.border}`:"none"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(91,141,239,0.04)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"11px 16px",width:28}}><OwnerBadge id={t.owner}/></td>
                    <td style={{padding:"11px 12px"}}>
                      <div style={{fontWeight:600}}>{t.holdingName}</div>
                      {t.note&&<div style={{fontSize:11,color:T.muted,marginTop:1}}>{t.note}</div>}
                    </td>
                    <td style={{padding:"11px 12px",textAlign:"center"}}>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,fontWeight:600,
                        background:t.portfolio==="india"?"rgba(0,229,160,0.1)":"rgba(91,141,239,0.1)",
                        color:t.portfolio==="india"?T.green:T.blue,
                        border:`1px solid ${t.portfolio==="india"?"rgba(0,229,160,0.25)":"rgba(91,141,239,0.25)"}`}}>
                        {t.portfolio==="india"?"🇮🇳 India":"🇺🇸 US"}
                      </span>
                    </td>
                    <td style={{padding:"11px 12px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>
                      {t.currency==="USD"?usd(t.amount):inr(t.amount)}
                      {t.currency==="USD"&&<div style={{fontSize:10,color:T.muted,fontWeight:400}}>{inr(t.amountINR)}</div>}
                    </td>
                    <td style={{padding:"11px 12px",textAlign:"right",color:T.muted,fontSize:11,whiteSpace:"nowrap"}}>{fmtDay(t.date)}</td>
                    <td style={{padding:"11px 12px"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                        <Btn onClick={()=>openEdit(t)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
                        <Btn onClick={()=>setDelId(t.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}

      {/* Add/Edit modal */}
      {showAdd&&(
        <Modal onClose={()=>{setShowAdd(false);setEditId(null);}}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:20}}>{editId?"Edit":"Log"} Investment</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Date */}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Date</div>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
            </div>

            {/* Portfolio */}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Portfolio</div>
              <div style={{display:"flex",gap:8}}>
                {[["india","🇮🇳 India",T.green],["us","🇺🇸 US",T.blue]].map(([id,label,color])=>(
                  <button key={id} onClick={()=>setForm(p=>({...p,portfolio:id,holdingId:""}))}
                    style={{flex:1,padding:"10px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:form.portfolio===id?700:400,
                      border:`1px solid ${form.portfolio===id?color:T.border}`,
                      background:form.portfolio===id?`${color}20`:"transparent",color:form.portfolio===id?color:T.muted}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument */}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Instrument</div>
              <select value={form.holdingId} onChange={e=>setForm(p=>({...p,holdingId:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",
                  color:form.holdingId?T.text:T.muted,fontSize:13,outline:"none",boxSizing:"border-box",colorScheme:"dark"}}>
                <option value="">Select instrument…</option>
                {(form.portfolio==="india"?indiaHoldings:usHoldings).map(h=>(
                  <option key={h.id} value={h.id} style={{background:T.surf,color:T.text}}>
                    {form.portfolio==="us"?`${h.ticker} — ${h.name}`:h.name} ({own(h.owner).name})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                Amount ({form.portfolio==="us"?"USD $":"INR ₹"})
              </div>
              <input type="text" inputMode="decimal" value={form.amount}
                placeholder={form.portfolio==="us"?"e.g. 250.00":"e.g. 5000"}
                onChange={e=>setForm(p=>({...p,amount:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",
                  color:T.text,fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
              {form.portfolio==="us"&&parseFloat(form.amount)>0&&(
                <div style={{fontSize:11,color:T.muted,marginTop:4}}>
                  ≈ {inr(parseFloat(form.amount)*usdInr)} at ₹{usdInr.toFixed(2)}/USD
                </div>
              )}
              {/* PPF annual limit tracker */}
              {form.portfolio==="india"&&form.holdingId&&(()=>{
                const holding = indiaHoldings.find(h=>h.id===form.holdingId);
                if(holding?.type!=="PPF") return null;
                const fy      = getIndianFY();
                const already = (transactions||[]).filter(t=>{
                  const hld=indiaHoldings.find(x=>x.id===t.holdingId);
                  return t.date>=fy.start && t.date<=fy.end && hld?.type==="PPF" && t.id!==(editId||"");
                }).reduce((s,t)=>s+t.amountINR,0);
                const thisAmt  = parseFloat(form.amount)||0;
                const total    = already+thisAmt;
                const over     = total>PPF_ANNUAL_LIMIT;
                const sc       = over ? T.red : total/PPF_ANNUAL_LIMIT>=0.8 ? T.orange : T.green;
                return (
                  <div style={{marginTop:8,background:over?"rgba(255,94,107,0.08)":"rgba(0,229,160,0.06)",
                    border:`1px solid ${over?"rgba(255,94,107,0.3)":"rgba(0,229,160,0.2)"}`,
                    borderRadius:8,padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                      <span style={{color:T.muted}}>{fy.label} PPF limit</span>
                      <span style={{color:sc,fontWeight:700}}>{inr(total)} / ₹1.5L</span>
                    </div>
                    <ProgressBar value={total} max={PPF_ANNUAL_LIMIT} color={sc} h={5}/>
                    {over
                      ? <div style={{fontSize:11,color:T.red,marginTop:4,fontWeight:600}}>⚠️ Exceeds ₹1.5L annual limit by {inr(total-PPF_ANNUAL_LIMIT)}</div>
                      : <div style={{fontSize:11,color:T.muted,marginTop:4}}>{inr(PPF_ANNUAL_LIMIT-total)} remaining in {fy.label}</div>
                    }
                  </div>
                );
              })()}
            </div>

            <Inp label="Note (optional)" value={form.note} placeholder="e.g. Monthly SIP, Top-up" onChange={e=>setForm(p=>({...p,note:e.target.value}))}/>

            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{setShowAdd(false);setEditId(null);}} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?"Save Changes":"Log Investment"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {delId&&<DelConfirm label="this entry" onConfirm={()=>{upd({transactions:transactions.filter(t=>t.id!==delId)});setDelId(null);}} onCancel={()=>setDelId(null)}/>}
{/* Deploy from pool modal */}
      {showDeployInflows&&(
        <Modal onClose={()=>setShowDeployInflows(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>→ Deploy to MF</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>Move funds from deployment pool into a mutual fund.</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>From Owner's Pool</div>
              <OwnerBtns value={deployInflowForm.owner} onChange={v=>{
                const b=poolBal(v);
                setDeployInflowForm(p=>({...p,owner:v,amount:b>0?String(b):""}));
              }}/>
              <div style={{fontSize:11,marginTop:6}}>
                Available: <b style={{color:poolBal(deployInflowForm.owner)>0?T.gold:T.red,fontFamily:"monospace"}}>
                  {inr(Math.max(0,poolBal(deployInflowForm.owner)))}
                </b>
              </div>
            </div>
            <Inp label="Amount (₹) *" value={deployInflowForm.amount} placeholder="Full balance"
              onChange={e=>setDeployInflowForm(p=>({...p,amount:e.target.value}))} mono/>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Into Fund *</div>
              <select value={deployInflowForm.fundId} onChange={e=>setDeployInflowForm(p=>({...p,fundId:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"10px 13px",color:deployInflowForm.fundId?T.text:T.muted,fontSize:13,outline:"none"}}>
                <option value="">Select a mutual fund…</option>
                {indiaHoldings.filter(h=>h.type==="MF").map(h=>{
                  const o=own(h.owner);
                  return <option key={h.id} value={h.id}>{o.name} — {h.name}</option>;
                })}
              </select>
              {deployInflowForm.fundId&&(()=>{
                const h=indiaHoldings.find(x=>x.id===deployInflowForm.fundId);
                const amt=parseFloat(deployInflowForm.amount)||0;
                return h&&h.currentNav>0&&amt>0?(
                  <div style={{fontSize:11,color:T.muted,marginTop:5}}>
                    ≈ <b style={{color:T.green,fontFamily:"monospace"}}>{(amt/h.currentNav).toFixed(3)} units</b> at NAV ₹{h.currentNav}
                  </div>
                ):null;
              })()}
            </div>
            <Inp label="Date" value={deployInflowForm.date} type="date"
              onChange={e=>setDeployInflowForm(p=>({...p,date:e.target.value}))}/>
            <Inp label="Note (optional)" value={deployInflowForm.note} placeholder="e.g. Dip buy — Nifty down 2%"
              onChange={e=>setDeployInflowForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowDeployInflows(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitDeployInflows} variant="primary" style={{flex:2}}
                disabled={!deployInflowForm.fundId||!deployInflowForm.amount}>
                Deploy ✓
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
