import { useState } from 'react';
import { T } from '../config';
import { inr } from '../helpers';
import { Card, Btn, Modal, Inp } from './shared';

const LOAN_TYPES = ['Home Loan','Personal Loan','Car Loan','Education Loan','Other'];

function calcMonthlyRate(rate) { return rate / 100 / 12; }

function calcRemainingInterest(outstanding, rate, remainingMonths) {
  if (!rate || !remainingMonths) return 0;
  const r = calcMonthlyRate(rate);
  const emi = outstanding * r * Math.pow(1+r, remainingMonths) / (Math.pow(1+r, remainingMonths) - 1);
  return Math.max(0, emi * remainingMonths - outstanding);
}

function calcEMI(outstanding, rate, months) {
  if (!rate || !months) return 0;
  const r = calcMonthlyRate(rate);
  return outstanding * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1);
}

function typeColor(t) {
  return { 'Home Loan':T.blue, 'Personal Loan':T.orange, 'Car Loan':T.green, 'Education Loan':T.purple, 'Other':T.muted }[t] || T.muted;
}

function daysUntilDue(dueDay) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (thisMonth <= now) thisMonth.setMonth(thisMonth.getMonth() + 1);
  return Math.ceil((thisMonth - now) / 86400000);
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

const EMPTY_FORM = { name:'', type:'Personal Loan', outstanding:'', emi:'', rate:'', remainingMonths:'', dueDay:'5', note:'' };

export default function LiabilitiesPage({ data, setData }) {
  const liabilities = data.liabilities || [];
  const [showForm,    setShowForm]   = useState(false);
  const [editId,      setEditId]     = useState(null);
  const [delId,       setDelId]      = useState(null);
  const [form,        setForm]       = useState(EMPTY_FORM);
  const [payLoanId,   setPayLoanId]  = useState(null);
  const [payForm,     setPayForm]    = useState({ date: new Date().toISOString().slice(0,10), amount:'', type:'EMI', note:'' });
  const [closeId,     setCloseId]    = useState(null);
  const [closeAmt,    setCloseAmt]   = useState('');
  const [calMonth,    setCalMonth]   = useState(new Date().getMonth());
  const [calYear,     setCalYear]    = useState(new Date().getFullYear());
  const [histLoanId,  setHistLoanId] = useState(null);

  const upd = p => setData(d => ({ ...d, ...p }));

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = l => {
    setEditId(l.id);
    setForm({ name:l.name, type:l.type, outstanding:String(l.outstanding), emi:String(l.emi||''),
      rate:String(l.rate||''), remainingMonths:String(l.remainingMonths||''), dueDay:String(l.dueDay||5), note:l.note||'' });
    setShowForm(true);
  };

  const submitForm = () => {
    const out  = parseFloat(form.outstanding)||0;
    const rate = parseFloat(form.rate)||0;
    const rem  = parseInt(form.remainingMonths)||0;
    const dueDay = parseInt(form.dueDay)||5;
    if (!form.name || !out) return;
    const emiVal = form.emi ? parseFloat(form.emi) : Math.round(calcEMI(out, rate, rem));
    const entry = { id:editId||'l'+Date.now(), name:form.name, type:form.type, outstanding:out,
      emi:emiVal, rate, remainingMonths:rem, dueDay, note:form.note, status:'active',
      payments: editId ? (liabilities.find(l=>l.id===editId)?.payments||[]) : [] };
    upd({ liabilities: editId ? liabilities.map(l=>l.id===editId?entry:l) : [...liabilities,entry] });
    setShowForm(false); setEditId(null);
  };

  // Log payment — reduces outstanding using amortization
  const submitPayment = () => {
    const amt = parseFloat(payForm.amount)||0;
    if (!amt) return;
    const loan = liabilities.find(l=>l.id===payLoanId);
    if (!loan) return;
    let newOutstanding = loan.outstanding;
    let newRemaining   = loan.remainingMonths;
    if (loan.rate > 0) {
      const interest   = loan.outstanding * calcMonthlyRate(loan.rate);
      const principal  = Math.max(0, amt - interest);
      newOutstanding   = Math.max(0, loan.outstanding - principal);
    } else {
      // No rate — proportional reduction
      const principal  = amt;
      newOutstanding   = Math.max(0, loan.outstanding - principal);
    }
    if (payForm.type === 'EMI') newRemaining = Math.max(0, newRemaining - 1);
    const payment = { id:'p'+Date.now(), date:payForm.date, amount:amt, type:payForm.type, note:payForm.note };
    upd({ liabilities: liabilities.map(l=>l.id===payLoanId
      ? {...l, outstanding:Math.round(newOutstanding), remainingMonths:newRemaining,
               payments:[...(l.payments||[]), payment]}
      : l) });
    setPayLoanId(null);
    setPayForm({ date:new Date().toISOString().slice(0,10), amount:'', type:'EMI', note:'' });
  };

  // Foreclose
  const submitForeclose = () => {
    upd({ liabilities: liabilities.map(l=>l.id===closeId
      ? {...l, outstanding:0, remainingMonths:0, status:'closed',
               closedAt:new Date().toISOString().slice(0,10),
               payments:[...(l.payments||[]), { id:'p'+Date.now(), date:new Date().toISOString().slice(0,10),
                 amount:parseFloat(closeAmt)||0, type:'Foreclosure', note:'Loan foreclosed' }]}
      : l) });
    setCloseId(null); setCloseAmt('');
  };

  const deleteL = id => { upd({ liabilities: liabilities.filter(l=>l.id!==id) }); setDelId(null); };

  const active = liabilities.filter(l=>l.status!=='closed');
  const closed = liabilities.filter(l=>l.status==='closed');

  const totalOutstanding   = active.reduce((s,l)=>s+l.outstanding,0);
  const totalEMI           = active.reduce((s,l)=>s+l.emi,0);
  const totalInterestLeft  = active.reduce((s,l)=>s+calcRemainingInterest(l.outstanding,l.rate,l.remainingMonths),0);

  // Calendar
  const calDays = new Date(calYear, calMonth+1, 0).getDate();
  const calFirst = new Date(calYear, calMonth, 1).getDay();
  const calEMIs = {};
  active.forEach(loan => {
    const day = Math.min(loan.dueDay||5, lastDayOfMonth(calYear, calMonth));
    if (!calEMIs[day]) calEMIs[day] = [];
    calEMIs[day].push(loan);
  });

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:14,fontWeight:600}}>Liabilities</div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={()=>upd({showLiabilitiesOnHome:data.showLiabilitiesOnHome===false})} style={{fontSize:11}}>
            {data.showLiabilitiesOnHome!==false?'👁 Visible on Home':'🙈 Hidden on Home'}
          </Btn>
          <Btn onClick={openAdd} variant="primary">+ Add Loan</Btn>
        </div>
      </div>

      {/* Summary strip */}
      {active.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
          {[
            {label:'Total Outstanding', value:inr(totalOutstanding),               color:T.red},
            {label:'Monthly EMI',       value:inr(totalEMI),                       color:T.orange},
            {label:'Interest Left',     value:inr(totalInterestLeft),              color:T.muted},
            {label:'Total Outgo',       value:inr(totalOutstanding+totalInterestLeft), color:T.text},
            {label:'Active Loans',      value:String(active.length),               color:T.blue},
          ].map(c=>(
            <Card key={c.label} style={{padding:'12px 14px'}}>
              <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>{c.label}</div>
              <div style={{fontFamily:'monospace',fontWeight:700,fontSize:15,color:c.color}}>{c.value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* EMI Calendar */}
      {active.length>0&&(
        <Card style={{padding:'16px 18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em'}}>
              📅 EMI Calendar
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}}
                style={{background:'none',border:`1px solid ${T.border}`,borderRadius:6,color:T.muted,cursor:'pointer',padding:'3px 8px',fontSize:12}}>‹</button>
              <span style={{fontSize:13,fontWeight:600,minWidth:100,textAlign:'center'}}>{FULL_MONTHS[calMonth]} {calYear}</span>
              <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}}
                style={{background:'none',border:`1px solid ${T.border}`,borderRadius:6,color:T.muted,cursor:'pointer',padding:'3px 8px',fontSize:12}}>›</button>
            </div>
          </div>

          {/* Month total */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            background:T.surf,borderRadius:8,padding:'8px 12px',marginBottom:12}}>
            <span style={{fontSize:12,color:T.muted}}>Total EMIs due this month</span>
            <span style={{fontFamily:'monospace',fontWeight:700,color:T.orange,fontSize:14}}>{inr(totalEMI)}</span>
          </div>

          {/* Calendar grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:8}}>
            {['S','M','T','W','T','F','S'].map((d,i)=>(
              <div key={i} style={{textAlign:'center',fontSize:9,color:T.dim,padding:'2px 0',fontWeight:700}}>{d}</div>
            ))}
            {Array.from({length:calFirst}).map((_,i)=><div key={'e'+i}/>)}
            {Array.from({length:calDays}).map((_,i)=>{
              const day   = i+1;
              const today = new Date();
              const isToday = day===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear();
              const loans   = calEMIs[day]||[];
              const isPast  = loans.length > 0
                ? loans.every(l => (l.payments||[]).some(p => {
                    const d = new Date(p.date);
                    return d.getFullYear()===calYear && d.getMonth()===calMonth;
                  }))
                : new Date(calYear,calMonth,day) < today;
              return (
                <div key={day} style={{
                  borderRadius:6,padding:'4px 2px',textAlign:'center',minHeight:44,
                  background: loans.length>0 ? `rgba(255,152,0,0.1)` : 'transparent',
                  border: isToday ? `1px solid ${T.blue}` : loans.length>0 ? `1px solid rgba(255,152,0,0.25)` : '1px solid transparent',
                }}>
                  <div style={{fontSize:10,fontWeight:isToday?700:400,color:isToday?T.blue:T.muted,marginBottom:2}}>{day}</div>
                  {loans.map(l=>(
                    <div key={l.id} style={{fontSize:7,color:isPast?T.green:T.orange,lineHeight:1.3,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 1px'}}>
                      {l.name.split(' ')[0]}
                    </div>
                  ))}
                  {loans.length>0&&(
                    <div style={{fontSize:7,color:isPast?T.green:T.orange,fontWeight:600}}>
                      {inr(loans.reduce((s,l)=>s+l.emi,0))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Due dates list */}
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {Object.entries(calEMIs).sort((a,b)=>+a[0]-+b[0]).map(([day,loans])=>{
              const dueDate = new Date(calYear, calMonth, Math.min(+day, lastDayOfMonth(calYear,calMonth)));
              const isPast  = loans.every(l => (l.payments||[]).some(p => {
                const d = new Date(p.date);
                return d.getFullYear()===calYear && d.getMonth()===calMonth;
              })) || dueDate < new Date();
              const total   = loans.reduce((s,l)=>s+l.emi,0);
              return (
                <div key={day} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'6px 10px',background:T.surf,borderRadius:7,fontSize:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:10,color:isPast?T.green:T.orange,fontWeight:700,minWidth:20}}>{isPast?'✅':'🔔'}</span>
                    <span style={{color:T.muted}}>{day}{['th','st','nd','rd'][+day<=3?+day:0]} · {loans.map(l=>l.name).join(', ')}</span>
                  </div>
                  <span style={{fontFamily:'monospace',fontWeight:700,color:isPast?T.green:T.orange}}>{inr(total)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Compact loan list */}
      {active.length===0?(
        <Card style={{padding:'40px 20px',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:12}}>🏦</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>No loans added yet</div>
          <Btn onClick={openAdd} variant="primary">+ Add First Loan</Btn>
        </Card>
      ):(
        <>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em'}}>
            Personal Loans ({active.length})
          </div>
          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:T.surf}}>
                  {['Loan','Outstanding','EMI','Rate','Remaining','Due',''].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:h===''||h==='Loan'?'left':'right',
                      fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((loan,idx)=>{
                  const daysLeft = daysUntilDue(loan.dueDay||5);
                  const remInt   = calcRemainingInterest(loan.outstanding,loan.rate,loan.remainingMonths);
                  return (
                    <>
                      <tr key={loan.id} style={{borderTop:`1px solid ${T.border}`,
                        background:'transparent'}}>
                        <td style={{padding:'10px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:typeColor(loan.type),flexShrink:0}}/>
                            <span style={{fontWeight:600}}>{loan.name}</span>
                          </div>
                          {loan.note&&<div style={{fontSize:9,color:T.dim,marginTop:1,paddingLeft:12}}>{loan.note}</div>}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:700,color:T.red}}>
                          {inr(loan.outstanding)}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:T.orange}}>
                          {inr(loan.emi)}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right',color:T.muted}}>
                          {loan.rate?`${loan.rate}%`:'—'}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right',color:T.muted}}>
                          {loan.remainingMonths?`${loan.remainingMonths}m`:'—'}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right'}}>
                          <span style={{fontSize:10,color:daysLeft<=5?T.red:daysLeft<=10?T.orange:T.muted}}>
                            {loan.dueDay||5}th · {daysLeft}d
                          </span>
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'right'}}>
                          <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                            <button onClick={()=>{
                              setPayLoanId(loan.id);
                              setPayForm({date:new Date().toISOString().slice(0,10),amount:String(loan.emi),type:'EMI',note:''});
                            }} title="Log Payment"
                              style={{background:'none',border:`1px solid ${T.green}40`,borderRadius:6,
                                color:T.green,cursor:'pointer',fontSize:10,padding:'3px 7px'}}>💰</button>
                            {(loan.payments||[]).length>0&&(
                              <button onClick={()=>setHistLoanId(loan.id)} title="Payment History"
                                style={{background:'none',border:`1px solid ${T.blue}40`,borderRadius:6,
                                  color:T.blue,cursor:'pointer',fontSize:10,padding:'3px 7px'}}>
                                📋{loan.payments.length}
                              </button>
                            )}
                            <button onClick={()=>openEdit(loan)} title="Edit"
                              style={{background:'none',border:`1px solid ${T.border}`,borderRadius:6,
                                color:T.muted,cursor:'pointer',fontSize:10,padding:'3px 7px'}}>✏️</button>
                            <button onClick={()=>{setCloseId(loan.id);setCloseAmt(String(loan.outstanding));}} title="Foreclose"
                              style={{background:'none',border:`1px solid ${T.purple}40`,borderRadius:6,
                                color:T.purple,cursor:'pointer',fontSize:10,padding:'3px 7px'}}>🔐</button>
                            <button onClick={()=>setDelId(loan.id)} title="Delete"
                              style={{background:'none',border:`1px solid ${T.red}40`,borderRadius:6,
                                color:T.red,cursor:'pointer',fontSize:10,padding:'3px 7px'}}>🗑</button>
                          </div>
                        </td>
                      </tr>
                      {/* Payment history row */}

                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:`2px solid ${T.border}`,background:T.surf}}>
                  <td style={{padding:'10px 12px',fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase'}}>Total</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:800,color:T.red}}>{inr(totalOutstanding)}</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:700,color:T.orange}}>{inr(totalEMI)}</td>
                  <td colSpan={4}/>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}

      {/* Closed loans */}
      {closed.length>0&&(
        <>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em'}}>
            ✅ Closed Loans ({closed.length})
          </div>
          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <tbody>
                {closed.map(loan=>(
                  <tr key={loan.id} style={{borderTop:`1px solid ${T.border}`}}>
                    <td style={{padding:'8px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:T.green,flexShrink:0}}/>
                        <span style={{fontWeight:600,color:T.muted}}>{loan.name}</span>
                        <span style={{fontSize:9,color:T.green,background:'rgba(27,175,122,0.1)',padding:'1px 6px',borderRadius:8}}>CLOSED</span>
                      </div>
                    </td>
                    <td style={{padding:'8px 12px',textAlign:'right',color:T.dim,fontSize:11}}>{loan.closedAt}</td>
                    <td style={{padding:'8px 12px',textAlign:'right'}}>
                      <button onClick={()=>setDelId(loan.id)}
                        style={{background:'none',border:`1px solid ${T.border}`,borderRadius:6,
                          color:T.muted,cursor:'pointer',fontSize:10,padding:'2px 6px'}}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm&&(
        <Modal onClose={()=>{setShowForm(false);setEditId(null);}}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:16}}>{editId?'Edit Loan':'Add Loan'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Inp label="Loan name *" value={form.name} placeholder="e.g. HDFC Home Loan"
              onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>Type</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {LOAN_TYPES.map(t=>(
                  <button key={t} onClick={()=>setForm(p=>({...p,type:t}))}
                    style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
                      background:form.type===t?typeColor(t):T.surf, color:form.type===t?'#fff':T.muted}}>{t}</button>
                ))}
              </div>
            </div>
            <Inp label="Outstanding (₹) *" value={form.outstanding} placeholder="e.g. 500000" mono
              onChange={e=>setForm(p=>({...p,outstanding:e.target.value}))}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Inp label="Interest rate (% p.a.)" value={form.rate} placeholder="e.g. 10.5" mono
                onChange={e=>setForm(p=>({...p,rate:e.target.value}))}/>
              <Inp label="Remaining months" value={form.remainingMonths} placeholder="e.g. 24" mono
                onChange={e=>setForm(p=>({...p,remainingMonths:e.target.value}))}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <Inp label="Monthly EMI (₹)" value={form.emi} placeholder="Auto-calculated" mono
                  onChange={e=>setForm(p=>({...p,emi:e.target.value}))}/>
                {!form.emi&&form.outstanding&&form.rate&&form.remainingMonths&&(
                  <div style={{fontSize:10,color:T.green,marginTop:3}}>
                    = {inr(calcEMI(parseFloat(form.outstanding),parseFloat(form.rate),parseInt(form.remainingMonths)))}
                  </div>
                )}
              </div>
              <Inp label="EMI due date (day)" value={form.dueDay} placeholder="e.g. 5" mono
                onChange={e=>setForm(p=>({...p,dueDay:e.target.value}))}/>
            </div>
            <Inp label="Note (optional)" value={form.note} placeholder="e.g. Axis Bank, started Jan 2022"
              onChange={e=>setForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:'flex',gap:10}}>
              <Btn onClick={()=>{setShowForm(false);setEditId(null);}} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?'Save Changes':'Add Loan'} ✓</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {payLoanId&&(()=>{
        const loan = liabilities.find(l=>l.id===payLoanId);
        return (
          <Modal onClose={()=>setPayLoanId(null)}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>💰 Log Payment</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:16}}>{loan?.name} · Outstanding: {inr(loan?.outstanding||0)}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <Inp label="Date" value={payForm.date} type="date"
                onChange={e=>setPayForm(p=>({...p,date:e.target.value}))}/>
              <Inp label="Amount (₹)" value={payForm.amount} placeholder={`EMI: ${inr(loan?.emi||0)}`} mono
                onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))}/>
              <div>
                <div style={{fontSize:11,color:T.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>Type</div>
                <div style={{display:'flex',gap:6}}>
                  {['EMI','Prepayment','Part Payment'].map(t=>(
                    <button key={t} onClick={()=>setPayForm(p=>({...p,type:t}))}
                      style={{padding:'4px 10px',borderRadius:14,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
                        background:payForm.type===t?T.green:T.surf, color:payForm.type===t?'#fff':T.muted}}>{t}</button>
                  ))}
                </div>
              </div>
              {payForm.amount&&loan?.rate>0&&(()=>{
                const interest  = (loan.outstanding*calcMonthlyRate(loan.rate));
                const principal = Math.max(0,parseFloat(payForm.amount)-interest);
                return (
                  <div style={{background:T.surf,borderRadius:8,padding:'8px 12px',fontSize:11}}>
                    <div style={{display:'flex',justifyContent:'space-between',color:T.muted,marginBottom:2}}>
                      <span>Interest portion</span><span style={{fontFamily:'monospace'}}>{inr(Math.min(interest,parseFloat(payForm.amount)))}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',color:T.green}}>
                      <span>Principal reduction</span><span style={{fontFamily:'monospace',fontWeight:700}}>{inr(principal)}</span>
                    </div>
                  </div>
                );
              })()}
              <Inp label="Note (optional)" value={payForm.note} placeholder="e.g. Prepaid for Sept"
                onChange={e=>setPayForm(p=>({...p,note:e.target.value}))}/>
              <div style={{display:'flex',gap:10}}>
                <Btn onClick={()=>setPayLoanId(null)} style={{flex:1}}>Cancel</Btn>
                <Btn onClick={submitPayment} variant="primary" style={{flex:2}}>Log Payment ✓</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Foreclose Modal */}
      {closeId&&(
        <Modal onClose={()=>setCloseId(null)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>🔐 Foreclose Loan</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:16}}>
            {liabilities.find(l=>l.id===closeId)?.name} · This will mark the loan as fully closed.
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Inp label="Settlement amount (₹)" value={closeAmt} mono
              onChange={e=>setCloseAmt(e.target.value)}/>
            <div style={{fontSize:11,color:T.orange,background:'rgba(255,152,0,0.08)',
              borderRadius:8,padding:'8px 12px'}}>
              ⚠️ Foreclosure charges may apply. Check with lender for exact settlement amount.
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn onClick={()=>setCloseId(null)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForeclose} variant="danger" style={{flex:2}}>Confirm Foreclose</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment History Modal */}
      {histLoanId&&(()=>{
        const loan = liabilities.find(l=>l.id===histLoanId);
        return (
          <Modal onClose={()=>setHistLoanId(null)}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>📋 Payment History</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:16}}>{loan?.name} · {(loan?.payments||[]).length} payments</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:400,overflowY:'auto'}}>
              {[...(loan?.payments||[])].reverse().map(p=>(
                <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'8px 12px',background:T.surf,borderRadius:8,fontSize:12}}>
                  <div>
                    <div style={{fontWeight:600}}>{p.date}</div>
                    <div style={{fontSize:10,color:p.type==='Foreclosure'?T.purple:p.type==='Prepayment'?T.blue:T.green,marginTop:2}}>{p.type}</div>
                    {p.note&&<div style={{fontSize:10,color:T.dim,marginTop:1}}>{p.note}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontFamily:'monospace',fontWeight:700,color:T.green,fontSize:14}}>{inr(p.amount)}</div>
                    <button
                      onClick={()=>{
                        if(!window.confirm(`Delete this ${p.type} of ${inr(p.amount)} on ${p.date}?`)) return;
                        // Reverse the payment effect on outstanding
                        const interest   = loan.rate>0 ? loan.outstanding*calcMonthlyRate(loan.rate) : 0;
                        const principal  = Math.max(0, p.amount - interest);
                        const restoredOut= loan.outstanding + principal;
                        const restoredRem= p.type==='EMI' ? loan.remainingMonths+1 : loan.remainingMonths;
                        upd({ liabilities: liabilities.map(l=>l.id===histLoanId
                          ?{...l, outstanding:Math.round(restoredOut), remainingMonths:restoredRem,
                                  payments:(l.payments||[]).filter(x=>x.id!==p.id)}
                          :l) });
                      }}
                      style={{background:'none',border:`1px solid ${T.red}40`,borderRadius:6,
                        color:T.red,cursor:'pointer',fontSize:10,padding:'2px 7px'}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12}}>
              <Btn onClick={()=>setHistLoanId(null)} style={{width:'100%'}}>Close</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Delete confirm */}
      {delId&&(
        <Modal onClose={()=>setDelId(null)}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Delete loan?</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>This will permanently remove this loan and all its payment history.</div>
          <div style={{display:'flex',gap:10}}>
            <Btn onClick={()=>setDelId(null)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={()=>deleteL(delId)} style={{flex:1,background:T.red,color:'#fff',border:'none'}}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
