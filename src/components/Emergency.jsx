import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCY FUND PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function EmergencyPage({ data, setData }) {
  const { emergencyFunds=[], monthlyExpenses=0, emergencyTargetMonths=6 } = data;
  const [showEdit,    setShowEdit]    = useState(false);
  const [showSettings,setShowSettings]= useState(false);
  const [editId,      setEditId]      = useState(null);
  const [delId,       setDelId]       = useState(null);
  const [form,        setForm]        = useState({ name:"", type:"Savings Account", owner:"abilash", balance:"", interestRate:"", note:"" });
  const [settings,    setSettings]    = useState({ monthlyExpenses:String(monthlyExpenses||""), targetMonths:String(emergencyTargetMonths||6) });

  const upd = p => setData(d=>({...d,...p}));

  const totalFund    = emergencyFunds.reduce((s,f)=>s+(f.balance||0),0);
  const coverage     = monthlyExpenses>0 ? totalFund/monthlyExpenses : 0;
  const targetAmount = monthlyExpenses * emergencyTargetMonths;
  const progress     = targetAmount>0 ? Math.min(100,(totalFund/targetAmount)*100) : 0;

  // Coverage status
  const coverageColor = coverage >= emergencyTargetMonths ? T.green : coverage >= emergencyTargetMonths*0.6 ? T.orange : T.red;
  const coverageLabel = coverage >= emergencyTargetMonths ? "Well covered ✅" : coverage >= emergencyTargetMonths*0.6 ? "Partially covered ⚠️" : "Needs attention 🔴";

  const FUND_TYPES = ["Savings Account","FD","Liquid Fund","Arbitrage MF","Cash","RD","Other"];

  const openAdd  = () => { setEditId(null); setForm({name:"",type:"Savings Account",owner:"abilash",balance:"",interestRate:"",note:""}); setShowEdit(true); };
  const openEdit = f  => { setEditId(f.id); setForm({name:f.name,type:f.type,owner:f.owner,balance:String(f.balance||""),interestRate:String(f.interestRate||""),note:f.note||""}); setShowEdit(true); };

  const submitForm = () => {
    if(!form.name.trim()) return;
    const bal = parseFloat(form.balance)||0;
    const entry = { id:editId||"ef"+Date.now(), name:form.name.trim(), type:form.type, owner:form.owner,
      balance:bal, interestRate:parseFloat(form.interestRate)||0, note:form.note };
    upd({emergencyFunds: editId ? emergencyFunds.map(f=>f.id===editId?entry:f) : [...emergencyFunds,entry]});
    setShowEdit(false);
  };

  const saveSettings = () => {
    const me = parseFloat(settings.monthlyExpenses)||0;
    const tm = parseInt(settings.targetMonths)||6;
    upd({ monthlyExpenses:me, emergencyTargetMonths:tm });
    setShowSettings(false);
  };

  // Type badge color
  const typeCfg = {
    "Savings Account":{ bg:"rgba(91,141,239,0.12)",  color:T.blue   },
    "FD":             { bg:"rgba(240,180,41,0.12)",  color:T.gold   },
    "Liquid Fund":    { bg:"rgba(0,229,160,0.12)",   color:T.green  },
    "Cash":           { bg:"rgba(251,146,60,0.12)",  color:T.orange },
    "RD":             { bg:"rgba(167,139,250,0.12)", color:T.purple },
    "Other":          { bg:"rgba(80,120,180,0.1)",   color:T.muted  },
  };

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>

      {/* Coverage Hero */}
      <Card accent={coverageColor} style={{padding:"22px 22px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:18}}>
          <div>
            <div style={{fontSize:10,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:6}}>Emergency Coverage</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:38,fontWeight:800,fontFamily:"monospace",color:coverageColor,lineHeight:1}}>
                {coverage>0?coverage.toFixed(1):"—"}
              </span>
              {coverage>0&&<span style={{fontSize:16,color:T.muted,fontWeight:600}}>months</span>}
            </div>
            <div style={{fontSize:13,color:coverageColor,marginTop:4,fontWeight:600}}>{monthlyExpenses>0?coverageLabel:"Set monthly expenses to see coverage"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Target</div>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"monospace",color:T.text}}>{emergencyTargetMonths} months</div>
            <div style={{fontSize:12,color:T.muted,marginTop:2}}>{targetAmount>0?inr(targetAmount):"—"}</div>
          </div>
        </div>

        <ProgressBar value={totalFund} max={Math.max(targetAmount,1)} color={coverageColor} h={10}/>

        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:8,flexWrap:"wrap",gap:8}}>
          <span style={{color:T.muted}}>Fund: <b style={{color:T.text,fontFamily:"monospace"}}>{totalFund?inr(totalFund):"—"}</b></span>
          {targetAmount>0&&<span style={{color:T.muted}}>Target: <b style={{color:T.text,fontFamily:"monospace"}}>{inr(targetAmount)}</b></span>}
          {totalFund<targetAmount&&totalFund>0&&<span style={{color:T.orange}}>Gap: <b style={{fontFamily:"monospace"}}>{inr(targetAmount-totalFund)}</b></span>}
        </div>
      </Card>

      )}


{/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
        <StatCard label="Total Fund"       value={totalFund?inr(totalFund):"—"}          color={T.green} accent={T.green}/>
        <StatCard label="Monthly Expenses" value={monthlyExpenses?inr(monthlyExpenses):"Not set"} color={T.muted}/>
        <StatCard label="Accounts"         value={String(emergencyFunds.length)}          color={T.blue}  accent={T.blue}
          sub={`Target: ${emergencyTargetMonths} months`}/>
      </div>

      {/* Actions */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,fontWeight:600}}>Fund Accounts</div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={()=>{setSettings({monthlyExpenses:String(monthlyExpenses||""),targetMonths:String(emergencyTargetMonths)});setShowSettings(true);}}>
            ⚙️ Settings
          </Btn>
          <Btn onClick={openAdd} variant="primary">+ Add Account</Btn>
        </div>
      </div>

      {/* Fund list */}
      {emergencyFunds.length===0 ? (
        <Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🛡️</div>
          <div style={{fontWeight:600,color:T.text,marginBottom:6}}>No emergency fund accounts yet</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Add your savings accounts, FDs, or liquid funds earmarked for emergencies</div>
          <Btn onClick={openAdd} variant="primary">+ Add First Account</Btn>
        </Card>
      ) : (
        <Card style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:T.surf}}>
                {[["","left"],["Account","left"],["Type","left"],["Owner","left"],["Balance","right"],["Rate","right"],["","right"]].map(([h,a],i)=>(
                  <th key={i} style={{padding:"10px 14px",textAlign:a,color:T.muted,fontWeight:600,fontSize:10,
                    letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emergencyFunds.map((f,idx)=>{
                const tc = typeCfg[f.type]||typeCfg["Other"];
                const share = totalFund>0 ? (f.balance/totalFund)*100 : 0;
                return (
                  <tr key={f.id} style={{borderBottom:idx<emergencyFunds.length-1?`1px solid ${T.border}`:"none"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(91,141,239,0.04)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 14px",width:28}}><OwnerBadge id={f.owner}/></td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{fontWeight:600}}>{f.name}</div>
                      {f.note&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{f.note}</div>}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,
                        background:tc.bg,color:tc.color,border:`1px solid ${tc.color}40`}}>{f.type}</span>
                    </td>
                    <td style={{padding:"12px 14px",color:T.muted,fontSize:12}}>{own(f.owner).name}</td>
                    <td style={{padding:"12px 14px",textAlign:"right"}}>
                      <div style={{fontFamily:"monospace",fontWeight:700,color:T.text}}>{inr(f.balance)}</div>
                      <div style={{fontSize:10,color:T.muted,marginTop:1}}>{share.toFixed(0)}% of fund</div>
                    </td>
                    <td style={{padding:"12px 14px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>
                      {f.interestRate>0?`${f.interestRate}%`:"—"}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                        <Btn onClick={()=>openEdit(f)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
                        <Btn onClick={()=>setDelId(f.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:T.surf,borderTop:`2px solid ${T.border}`}}>
                <td colSpan={4} style={{padding:"11px 14px",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Total</td>
                <td style={{padding:"11px 14px",textAlign:"right",fontFamily:"monospace",fontWeight:800,fontSize:14,color:T.green}}>{inr(totalFund)}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Rule of thumb tip */}
      {monthlyExpenses>0&&(
        <div style={{background:"rgba(91,141,239,0.06)",border:`1px solid rgba(91,141,239,0.2)`,borderRadius:10,padding:"12px 16px",fontSize:12,color:T.muted,lineHeight:1.6}}>
          💡 <b style={{color:T.text}}>Rule of thumb:</b> Emergency fund should cover {emergencyTargetMonths} months of expenses
          ({inr(targetAmount)}). {coverage>=emergencyTargetMonths
            ? `You're covered — great position to be in.`
            : `You need ${inr(Math.max(0,targetAmount-totalFund))} more to reach your target.`}
        </div>
      )}

      {/* Add/Edit modal */}
      {showEdit&&(
        <Modal onClose={()=>{setShowEdit(false);setEditId(null);}}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:20}}>{editId?"Edit":"Add"} Emergency Fund Account</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Inp label="Account Name *" value={form.name} placeholder="e.g. HDFC Savings, SBI FD" onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Type</div>
              <TypeBtn options={FUND_TYPES} value={form.type} onChange={v=>setForm(p=>({...p,type:v}))}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Inp label="Balance (₹) *" value={form.balance} placeholder="150000" onChange={e=>setForm(p=>({...p,balance:e.target.value}))} mono/>
              <Inp label="Interest Rate % (optional)" value={form.interestRate} placeholder="e.g. 7.1" onChange={e=>setForm(p=>({...p,interestRate:e.target.value}))} mono/>
            </div>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Owner</div>
              <OwnerBtns value={form.owner} onChange={v=>setForm(p=>({...p,owner:v}))}/>
            </div>
            <Inp label="Note (optional)" value={form.note} placeholder="e.g. Joint account, earmarked for emergency" onChange={e=>setForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{setShowEdit(false);setEditId(null);}} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?"Save Changes":"Add Account"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Settings modal */}
      {showSettings&&(
        <Modal onClose={()=>setShowSettings(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>⚙️ Emergency Fund Settings</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:20}}>Used to calculate how many months your fund covers.</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <Inp label="Monthly Household Expenses (₹)" value={settings.monthlyExpenses} placeholder="e.g. 80000"
                onChange={e=>setSettings(p=>({...p,monthlyExpenses:e.target.value}))} mono/>
              <div style={{fontSize:11,color:T.muted,marginTop:4}}>Include all regular expenses — rent/EMI, groceries, utilities, school fees, etc.</div>
            </div>
            <div>
              <Inp label="Target Coverage (months)" value={settings.targetMonths} placeholder="6"
                onChange={e=>setSettings(p=>({...p,targetMonths:e.target.value}))} mono/>
              <div style={{fontSize:11,color:T.muted,marginTop:4}}>Standard recommendation is 6 months. Go up to 12 if income is variable.</div>
            </div>
            {settings.monthlyExpenses&&settings.targetMonths&&(
              <div style={{background:"rgba(0,229,160,0.08)",border:`1px solid rgba(0,229,160,0.2)`,borderRadius:8,padding:"10px 14px",fontSize:13}}>
                Target fund size: <b style={{color:T.green,fontFamily:"monospace"}}>{inr((parseFloat(settings.monthlyExpenses)||0)*(parseInt(settings.targetMonths)||6))}</b>
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowSettings(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={saveSettings} variant="primary" style={{flex:2}}>Save Settings</Btn>
            </div>
          </div>
        </Modal>
      )}

      {delId&&<DelConfirm label={emergencyFunds.find(f=>f.id===delId)?.name} onConfirm={()=>{upd({emergencyFunds:emergencyFunds.filter(f=>f.id!==delId)});setDelId(null);}} onCancel={()=>setDelId(null)}/>}
    </div>
  );
}
