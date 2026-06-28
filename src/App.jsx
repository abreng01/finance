import { useState, useEffect, useRef } from 'react';
import { loadData, saveData } from './storage';
import { SEED } from './seed';
import { T, NAV_ITEMS } from './config';
import { inr } from './helpers';
import Landing    from './components/Landing';
import Home       from './components/Home';
import US         from './components/US';
import India      from './components/India';
import Goals      from './components/Goals';
import Analytics  from './components/Analytics';
import Inflows    from './components/Inflows';
import Emergency  from './components/Emergency';
import Tax        from './components/Tax';

// ── Migrate stored data to latest SEED version ────────────────────────────────
const migrate = (saved) => {
  if (!saved?.seedVersion || saved.seedVersion < 3) {
    const mergedIndia = (saved?.indiaHoldings || SEED.indiaHoldings).map(h => {
      const seed = SEED.indiaHoldings.find(x => x.id === h.id);
      if (!seed) return h;
      return {
        ...seed,
        schemeCode:   h.schemeCode   || '',
        currentNav:   h.currentNav   || 0,
        currentValue: h.currentValue || 0,
        navDate:      h.navDate      || '',
      };
    });
    return { ...SEED, ...saved, indiaHoldings: mergedIndia, seedVersion: 3 };
  }
  return { ...SEED, ...saved };
};

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [page,   setPage]   = useState('home');
  const [data,   setData]   = useState(SEED);
  const [status, setStatus] = useState('');   // '' | 'saving' | 'saved' | 'error'
  const init      = useRef(true);
  const saveTimer = useRef(null);

  // ── Load from JSONBin on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await loadData();
        if (saved) setData(migrate(saved));
      } catch (e) {
        console.error('Load failed:', e);
        // Continue with SEED data — app still works offline
      }
    })();
  }, []);

  // ── Debounced save to JSONBin on every data change ──────────────────────────
  useEffect(() => {
    if (init.current) { init.current = false; return; }
    clearTimeout(saveTimer.current);
    setStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        await saveData(data);
        setStatus('saved');
        setTimeout(() => setStatus(''), 2000);
      } catch (e) {
        console.error('Save failed:', e);
        setStatus('error');
        setTimeout(() => setStatus(''), 4000);
      }
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  // ── Total wealth for top bar ────────────────────────────────────────────────
  const totalInr = (() => {
    const getVal = h => h.type === 'MF'
      ? (h.units > 0 && h.currentNav > 0 ? h.units * h.currentNav : 0)
      : (h.currentValue || 0);
    const us = data.usHoldings.reduce((s, h) => s + h.shares * (data.usPrices[h.ticker] || 0), 0) * data.usdInr;
    const in_ = data.indiaHoldings.reduce((s, h) => s + getVal(h), 0);
    return us + in_;
  })();

  // ── Status indicator config ──────────────────────────────────────────────────
  const statusCfg = {
    saving: { text:'Saving…', color:T.muted },
    saved:  { text:'✓ Saved',  color:T.green },
    error:  { text:'⚠ Save failed', color:T.red },
  }[status];

  if (screen === 'landing') return <Landing onEnter={() => setScreen('app')} />;

  return (
    <div style={{ minHeight:'100vh', background:T.bg, color:T.text,
      fontFamily:"'Segoe UI', system-ui, -apple-system, sans-serif" }}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <div style={{ background:T.surf, borderBottom:`1px solid ${T.border}`,
        position:'sticky', top:0, zIndex:50 }}>

        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 20px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8,
              background:'linear-gradient(135deg,#5B8DEF,#00E5A0)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
              💎
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Wealth Dashboard</div>
              <div style={{ fontSize:10, color:T.muted }}>Abilash · Saiharini · Vishruth</div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {statusCfg && (
              <span style={{ fontSize:11, color:statusCfg.color }}>{statusCfg.text}</span>
            )}
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Total Wealth
              </div>
              <div style={{ fontSize:18, fontWeight:800, color:T.green, fontFamily:'monospace' }}>
                {totalInr > 0 ? inr(totalInr) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display:'flex', overflowX:'auto' }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              style={{ flex:'0 0 auto', padding:'10px 16px', background:'none', border:'none',
                cursor:'pointer', fontSize:13, fontWeight:page===n.id?700:400,
                color:page===n.id?T.green:T.muted,
                borderBottom:`2px solid ${page===n.id?T.green:'transparent'}`,
                transition:'all 0.15s', whiteSpace:'nowrap' }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAGE CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        {page==='home'      && <Home      data={data} setPage={setPage}/>}
        {page==='us'        && <US        data={data} setData={setData}/>}
        {page==='india'     && <India     data={data} setData={setData}/>}
        {page==='goals'     && <Goals     data={data} setData={setData}/>}
        {page==='analytics' && <Analytics data={data}/>}
        {page==='inflows'   && <Inflows   data={data} setData={setData}/>}
        {page==='emergency' && <Emergency data={data} setData={setData}/>}
        {page==='tax'       && <Tax       data={data} setData={setData}/>}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
