import { useState } from 'react';
import { T, OWNERS } from '../config';

export default function Landing({ onEnter }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.6s ease both' }}>

      <div style={{ position:'fixed', top:'30%', left:'50%', transform:'translate(-50%,-50%)',
        width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(91,141,239,0.08) 0%, transparent 70%)',
        pointerEvents:'none' }}/>

      <div style={{ textAlign:'center', maxWidth:380, position:'relative', zIndex:1 }}>
        <div style={{ width:76, height:76, borderRadius:22,
          background:'linear-gradient(135deg,#5B8DEF,#00E5A0)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:38, margin:'0 auto 28px',
          boxShadow:'0 0 40px rgba(0,229,160,0.25)' }}>
          💎
        </div>

        <div style={{ fontSize:30, fontWeight:800, color:T.text, letterSpacing:'-0.01em', marginBottom:8 }}>
          Wealth Dashboard
        </div>
        <div style={{ fontSize:13, color:T.muted, marginBottom:40, letterSpacing:'0.04em' }}>
          Personal Finance · All in one place
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:52, flexWrap:'wrap' }}>
          {OWNERS.map(o => (
            <div key={o.id} style={{ display:'flex', alignItems:'center', gap:6,
              background:o.bg, borderRadius:20, padding:'6px 14px',
              border:`1px solid ${o.color}40` }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:o.color }}/>
              <span style={{ fontSize:12, color:o.color, fontWeight:600 }}>{o.name}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onEnter}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ background:`linear-gradient(135deg,${T.blue},${T.green})`,
            border:'none', borderRadius:14, padding:'14px 52px',
            fontSize:16, fontWeight:800, color:'#07111E', cursor:'pointer',
            boxShadow:hover
              ? '0 0 48px rgba(0,229,160,0.5), 0 8px 32px rgba(0,0,0,0.4)'
              : '0 0 28px rgba(0,229,160,0.25), 0 4px 16px rgba(0,0,0,0.3)',
            transform:hover?'translateY(-2px)':'translateY(0)',
            transition:'all 0.2s ease', letterSpacing:'0.04em' }}>
          Enter →
        </button>

        <div style={{ marginTop:20, fontSize:11, color:T.dim }}>
          Your financial data stays private
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}
