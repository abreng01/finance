import { useState } from 'react';
import { T } from '../config';
import { inr } from '../helpers';
import { Card, Btn, Modal, Inp, StatCard, ProgressBar } from './shared';

const LOAN_TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Education Loan', 'Other'];

function monthlyEMI(principal, rateAnnual, tenureMonths) {
  if (!principal || !rateAnnual || !tenureMonths) return 0;
  const r = rateAnnual / 100 / 12;
  return principal * r * Math.pow(1+r, tenureMonths) / (Math.pow(1+r, tenureMonths) - 1);
}

function totalInterest(emi, tenureMonths, principal) {
  return (emi * tenureMonths) - principal;
}

function remainingInterest(outstanding, rateAnnual, remainingMonths) {
  const emi = monthlyEMI(outstanding, rateAnnual, remainingMonths);
  return (emi * remainingMonths) - outstanding;
}

const EMPTY_FORM = {
  name: '', type: 'Home Loan', outstanding: '',
  emi: '', rate: '', remainingMonths: '', note: ''
};

export default function LiabilitiesPage({ data, setData }) {
  const liabilities = data.liabilities || [];
  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState(null);
  const [delId,    setDelId]      = useState(null);
  const [form,     setForm]       = useState(EMPTY_FORM);

  const upd = p => setData(d => ({ ...d, ...p }));

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = l => {
    setEditId(l.id);
    setForm({
      name: l.name, type: l.type, outstanding: String(l.outstanding),
      emi: String(l.emi), rate: String(l.rate),
      remainingMonths: String(l.remainingMonths), note: l.note || ''
    });
    setShowForm(true);
  };

  const submitForm = () => {
    const out  = parseFloat(form.outstanding) || 0;
    const rate = parseFloat(form.rate)        || 0;
    const rem  = parseInt(form.remainingMonths) || 0;
    if (!form.name || !out) return;
    const calcEMI = form.emi ? parseFloat(form.emi) : monthlyEMI(out, rate, rem);
    const entry = {
      id: editId || 'l' + Date.now(),
      name: form.name, type: form.type,
      outstanding: out, emi: parseFloat(calcEMI.toFixed(0)),
      rate, remainingMonths: rem, note: form.note,
    };
    upd({
      liabilities: editId
        ? liabilities.map(l => l.id === editId ? entry : l)
        : [...liabilities, entry]
    });
    setShowForm(false); setEditId(null);
  };

  const deleteL = id => {
    upd({ liabilities: liabilities.filter(l => l.id !== id) });
    setDelId(null);
  };

  // Totals
  const totalOutstanding = liabilities.reduce((s, l) => s + l.outstanding, 0);
  const totalEMI         = liabilities.reduce((s, l) => s + l.emi, 0);
  const totalInterestLeft= liabilities.reduce((s, l) => s + remainingInterest(l.outstanding, l.rate, l.remainingMonths), 0);
  const homeLoan         = liabilities.filter(l => l.type === 'Home Loan');
  const personalLoans    = liabilities.filter(l => l.type === 'Personal Loan');
  const others           = liabilities.filter(l => l.type !== 'Home Loan' && l.type !== 'Personal Loan');

  // Toggle home page visibility
  const toggleHomeVisibility = () => {
    upd({ showLiabilitiesOnHome: !data.showLiabilitiesOnHome });
  };

  const typeColor = t => ({
    'Home Loan':      T.blue,
    'Personal Loan':  T.orange,
    'Car Loan':       T.green,
    'Education Loan': T.purple,
    'Other':          T.muted,
  }[t] || T.muted);

  const LoanCard = ({ loan }) => {
    const remInt = remainingInterest(loan.outstanding, loan.rate, loan.remainingMonths);
    const paidPct = loan.remainingMonths > 0
      ? Math.max(0, 100 - (loan.remainingMonths / (loan.remainingMonths + 1)) * 100)
      : 0;
    const yrsLeft = Math.floor(loan.remainingMonths / 12);
    const mosLeft = loan.remainingMonths % 12;

    return (
      <Card style={{ padding: '16px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{loan.name}</span>
              <span style={{
                fontSize:10, padding:'2px 8px', borderRadius:12, fontWeight:700,
                background:`${typeColor(loan.type)}18`, color:typeColor(loan.type)
              }}>{loan.type}</span>
            </div>
            <div style={{ fontSize:11, color:T.muted }}>
              {loan.rate}% p.a. · {yrsLeft > 0 ? `${yrsLeft}y ` : ''}{mosLeft > 0 ? `${mosLeft}m` : ''} remaining
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => openEdit(loan)}
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
                color:T.muted, cursor:'pointer', fontSize:11, padding:'4px 10px' }}>✏️</button>
            <button onClick={() => setDelId(loan.id)}
              style={{ background:'none', border:`1px solid ${T.red}40`, borderRadius:6,
                color:T.red, cursor:'pointer', fontSize:11, padding:'4px 10px' }}>🗑</button>
          </div>
        </div>

        {/* Key numbers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:8, marginBottom:12 }}>
          {[
            { label:'Outstanding',    value:inr(loan.outstanding),  color:T.red    },
            { label:'Monthly EMI',    value:inr(loan.emi),          color:T.orange },
            { label:'Interest left',  value:inr(remInt),            color:T.muted  },
            { label:'Total outgo',    value:inr(loan.outstanding + remInt), color:T.text },
          ].map(item => (
            <div key={item.label} style={{ background:T.surf, borderRadius:8, padding:'8px 12px' }}>
              <div style={{ fontSize:10, color:T.muted, marginBottom:3 }}>{item.label}</div>
              <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Repayment progress */}
        <div style={{ fontSize:10, color:T.muted, marginBottom:4, display:'flex', justifyContent:'space-between' }}>
          <span>Repayment progress</span>
          <span>{loan.remainingMonths} months remaining</span>
        </div>
        <ProgressBar value={100 - (loan.remainingMonths)} max={100} color={typeColor(loan.type)} h={6}/>

        {loan.note && (
          <div style={{ fontSize:11, color:T.dim, marginTop:8, fontStyle:'italic' }}>{loan.note}</div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>Liabilities</div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={toggleHomeVisibility} style={{ fontSize:11 }}>
            {data.showLiabilitiesOnHome !== false ? '👁 Visible on Home' : '🙈 Hidden on Home'}
          </Btn>
          <Btn onClick={openAdd} variant="primary">+ Add Loan</Btn>
        </div>
      </div>

      {/* Summary cards */}
      {liabilities.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
          <Card accent={T.red} style={{ padding:'16px 16px 14px' }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Total Outstanding</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'monospace', color:T.red }}>{inr(totalOutstanding)}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{liabilities.length} loan{liabilities.length !== 1 ? 's' : ''}</div>
          </Card>
          <Card accent={T.orange} style={{ padding:'16px 16px 14px' }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Total Monthly EMI</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'monospace', color:T.orange }}>{inr(totalEMI)}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>per month outflow</div>
          </Card>
          <Card accent={T.muted} style={{ padding:'16px 16px 14px' }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Total Interest Left</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'monospace', color:T.text }}>{inr(totalInterestLeft)}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>cost of borrowing</div>
          </Card>
          <Card accent={T.dim} style={{ padding:'16px 16px 14px' }}>
            <div style={{ fontSize:10, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Total Outgo</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'monospace', color:T.text }}>{inr(totalOutstanding + totalInterestLeft)}</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>principal + interest</div>
          </Card>
        </div>
      )}

      {/* Loan groups */}
      {liabilities.length === 0 ? (
        <Card style={{ padding:'40px 20px', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🏦</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>No loans added yet</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>Add your home loan and personal loans to track true net worth</div>
          <Btn onClick={openAdd} variant="primary">+ Add First Loan</Btn>
        </Card>
      ) : (
        <>
          {homeLoan.length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em' }}>Home Loan</div>
              {homeLoan.map(l => <LoanCard key={l.id} loan={l}/>)}
            </>
          )}
          {personalLoans.length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em' }}>Personal Loans</div>
              {personalLoans.map(l => <LoanCard key={l.id} loan={l}/>)}
            </>
          )}
          {others.length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'0.12em' }}>Other Loans</div>
              {others.map(l => <LoanCard key={l.id} loan={l}/>)}
            </>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal onClose={() => { setShowForm(false); setEditId(null); }}>
          <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>{editId ? 'Edit Loan' : 'Add Loan'}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Inp label="Loan name *" value={form.name} placeholder="e.g. HDFC Home Loan"
              onChange={e => setForm(p => ({ ...p, name:e.target.value }))}/>

            <div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Type</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {LOAN_TYPES.map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, type:t }))}
                    style={{
                      padding:'5px 12px', borderRadius:16, border:'none', cursor:'pointer',
                      fontSize:11, fontWeight:600,
                      background: form.type === t ? typeColor(t) : T.surf,
                      color: form.type === t ? '#fff' : T.muted,
                    }}>{t}</button>
                ))}
              </div>
            </div>

            <Inp label="Outstanding Principal (₹) *" value={form.outstanding}
              placeholder="e.g. 2500000" mono
              onChange={e => setForm(p => ({ ...p, outstanding:e.target.value }))}/>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Inp label="Interest rate (% p.a.)" value={form.rate}
                placeholder="e.g. 8.5" mono
                onChange={e => setForm(p => ({ ...p, rate:e.target.value }))}/>
              <Inp label="Remaining months" value={form.remainingMonths}
                placeholder="e.g. 240" mono
                onChange={e => setForm(p => ({ ...p, remainingMonths:e.target.value }))}/>
            </div>

            <div>
              <Inp label="Monthly EMI (₹) — leave blank to auto-calculate" value={form.emi}
                placeholder="Auto-calculated from above" mono
                onChange={e => setForm(p => ({ ...p, emi:e.target.value }))}/>
              {!form.emi && form.outstanding && form.rate && form.remainingMonths && (
                <div style={{ fontSize:11, color:T.green, marginTop:4 }}>
                  Calculated EMI: {inr(monthlyEMI(parseFloat(form.outstanding), parseFloat(form.rate), parseInt(form.remainingMonths)))}
                </div>
              )}
            </div>

            <Inp label="Note (optional)" value={form.note} placeholder="e.g. SBI home loan, started Jan 2022"
              onChange={e => setForm(p => ({ ...p, note:e.target.value }))}/>

            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={() => { setShowForm(false); setEditId(null); }} style={{ flex:1 }}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{ flex:2 }}>
                {editId ? 'Save Changes' : 'Add Loan'} ✓
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {delId && (
        <Modal onClose={() => setDelId(null)}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Delete loan?</div>
          <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>This will permanently remove this loan from your tracker.</div>
          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={() => setDelId(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={() => deleteL(delId)} variant="danger" style={{ flex:1 }}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
