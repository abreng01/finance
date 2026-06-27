import { T, OWNERS } from '../config';
import { own } from '../helpers';

export const OwnerBadge = ({ id }) => {
  const o = own(id);
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:24, height:24, borderRadius:'50%', background:o.bg, color:o.color,
      fontSize:9, fontWeight:800, border:`1px solid ${o.color}50`, flexShrink:0, letterSpacing:'0.02em' }}>
      {o.short}
    </span>
  );
};

export const Card = ({ children, style={}, accent, onClick }) => (
  <div onClick={onClick} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
    position:'relative', overflow:'hidden', cursor:onClick?'pointer':undefined, ...style }}>
    {accent && <div style={{ position:'absolute', top:0, left:0, right:0, height:3,
      background:accent, borderRadius:'14px 14px 0 0' }}/>}
    {children}
  </div>
);

export const Btn = ({ onClick, children, variant='ghost', disabled=false, style={} }) => {
  const V = {
    ghost:   { background:'rgba(255,255,255,0.05)', border:`1px solid ${T.border}`, color:T.text },
    primary: { background:T.green, border:'none', color:'#07111E' },
    danger:  { background:'rgba(255,94,107,0.1)', border:'1px solid rgba(255,94,107,0.3)', color:T.red },
    blue:    { background:'rgba(91,141,239,0.12)', border:'1px solid rgba(91,141,239,0.3)', color:T.blue },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ borderRadius:8, padding:'8px 16px', cursor:disabled?'not-allowed':'pointer',
        fontSize:13, fontWeight:600, opacity:disabled?0.5:1, transition:'opacity 0.15s',
        ...V[variant], ...style }}>
      {children}
    </button>
  );
};

export const ProgressBar = ({ value, max, color=T.green, h=8 }) => {
  const p = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ background:T.dim, borderRadius:100, height:h, overflow:'hidden' }}>
      <div style={{ width:`${p}%`, height:'100%', background:color, borderRadius:100,
        minWidth:p>0?3:0, transition:'width 0.6s ease' }}/>
    </div>
  );
};

export const SectionLabel = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:'0.14em',
    textTransform:'uppercase', padding:'9px 16px', background:T.surf,
    borderBottom:`1px solid ${T.border}` }}>
    {children}
  </div>
);

export const StatCard = ({ label, value, sub, color=T.text, accent }) => (
  <Card accent={accent||color} style={{ padding:'16px 16px 14px' }}>
    <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:7 }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:800, color, fontFamily:'monospace', letterSpacing:'-0.01em' }}>{value}</div>
    {sub && <div style={{ fontSize:12, color, marginTop:3, opacity:0.8 }}>{sub}</div>}
  </Card>
);

export const Modal = ({ children, onClose }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.80)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:400, backdropFilter:'blur(6px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:20, padding:28,
      width:440, maxWidth:'94vw', maxHeight:'88vh', overflowY:'auto',
      boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
      {children}
    </div>
  </div>
);

export const Inp = ({ label, value, onChange, placeholder, type='text', mono=false }) => (
  <div>
    <div style={{ fontSize:11, color:T.muted, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
    <input type={type} inputMode={type==='number'?'decimal':undefined}
      value={value} onChange={onChange} placeholder={placeholder}
      style={{ width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:8,
        padding:'10px 13px', color:T.text, fontSize:13,
        fontFamily:mono?'monospace':'inherit', outline:'none', boxSizing:'border-box' }}/>
  </div>
);

export const TypeBtn = ({ options, value, onChange }) => (
  <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
    {options.map(o => (
      <button key={o} onClick={() => onChange(o)}
        style={{ padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12,
          fontWeight:value===o?700:400,
          border:`1px solid ${value===o?T.green:T.border}`,
          background:value===o?'rgba(0,229,160,0.1)':'transparent',
          color:value===o?T.green:T.muted }}>
        {o}
      </button>
    ))}
  </div>
);

export const OwnerBtns = ({ value, onChange }) => (
  <div style={{ display:'flex', gap:8 }}>
    {OWNERS.map(o => (
      <button key={o.id} onClick={() => onChange(o.id)}
        style={{ flex:1, padding:'9px', borderRadius:8, cursor:'pointer', fontSize:12,
          fontWeight:value===o.id?700:400,
          border:`1px solid ${value===o.id?o.color:T.border}`,
          background:value===o.id?o.bg:'transparent',
          color:value===o.id?o.color:T.muted }}>
        {o.name}
      </button>
    ))}
  </div>
);

export const DelConfirm = ({ label, onConfirm, onCancel }) => (
  <Modal onClose={onCancel}>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
      <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Remove {label}?</div>
      <div style={{ fontSize:13, color:T.muted, marginBottom:22 }}>This cannot be undone.</div>
      <div style={{ display:'flex', gap:10 }}>
        <Btn onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
        <Btn onClick={onConfirm} variant='danger' style={{ flex:1 }}>Remove</Btn>
      </div>
    </div>
  </Modal>
);
