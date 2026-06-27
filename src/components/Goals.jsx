import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// GOALS PAGE
// ══════════════════════════════════════════════════════════════════════════════
const GOAL_EMOJIS = ["🎯","🚗","🏠","🎓","🏖️","💍","✈️","💰","📱","🏋️","🌏","👶"];

export default function GoalsPage({ data, setData }) {
  const { goals } = data;
  const [showEdit, setShowEdit] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({name:"",emoji:"🎯",targetAmount:"",targetDate:"",saved:"",note:""});
  const [delId,    setDelId]    = useState(null);
  const upd = p => setData(d=>({...d,...p}));

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
