import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT, FINNHUB_KEY } from '../config';
import VestSchedule from './VestSchedule';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ── Historical sales to pre-populate on first load ────────────────────────────
const NTNX_HISTORICAL_SALES = [
  {
    id: "sale-rsu-20260113",
    date: "2026-01-13",
    type: "RSU",
    qty: 13,
    pricePerShare: 53.15,
    grossProceeds: 690.95,
    commission: 4.95,
    secFees: 0.00,
    disbursementFee: 25.00,
    netProceeds: 661.00,
    currency: "INR",
    grantDetails: [{ grantNumber: "R0041293", vestPeriod: 1, qty: 13 }],
    orderNumber: "99185396",
    notes: "Proceeds wired in INR"
  },
  {
    id: "sale-rsu-20260316",
    date: "2026-03-16",
    type: "RSU",
    qty: 232,
    pricePerShare: 39.29,
    grossProceeds: 9115.28,
    commission: 4.95,
    secFees: 0.00,
    disbursementFee: 25.00,
    netProceeds: 9085.33,
    currency: "INR",
    grantDetails: [
      { grantNumber: "R0039363", vestPeriod: 1, qty: 220 },
      { grantNumber: "R0041293", vestPeriod: 2, qty: 12 }
    ],
    orderNumber: "101041598",
    notes: "Proceeds wired in INR"
  },
  {
    id: "sale-espp-20260323",
    date: "2026-03-23",
    type: "ESPP",
    qty: 50,
    pricePerShare: 40.11,
    grossProceeds: 2005.66,
    commission: 4.95,
    secFees: 0.00,
    disbursementFee: 25.00,
    netProceeds: 1975.71,
    currency: "INR",
    grantDetails: [],
    orderNumber: "101203125",
    notes: "ESPP Mar 2026 · Purchase price $33.56 · Gain: $6.55/share"
  },
  {
    id: "sale-rsu-20260616",
    date: "2026-06-16",
    type: "RSU",
    qty: 69,
    pricePerShare: 48.79,
    grossProceeds: 3366.51,
    commission: 4.95,
    secFees: 0.07,
    disbursementFee: 25.00,
    netProceeds: 3336.49,
    currency: "USD",
    grantDetails: [
      { grantNumber: "R0039363", vestPeriod: 2, qty: 56 },
      { grantNumber: "R0041293", vestPeriod: 3, qty: 13 }
    ],
    orderNumber: "104300679",
    notes: "Proceeds wired in USD"
  }
];

// ══════════════════════════════════════════════════════════════════════════════
// US PORTFOLIO PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function USPage({ data, setData }) {
  const { usHoldings, usPrices, usdInr } = data;
  const [showPrices, setShowPrices] = useState(false);
  const [priceForm,  setPriceForm]  = useState({});
  const [showEdit,   setShowEdit]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({ ticker:"",name:"",shares:"",avgCost:"",type:"ETF",owner:"abilash" });
  const [formErr,    setFormErr]    = useState("");
  const [delId,      setDelId]      = useState(null);
  const [fetching,   setFetching]   = useState(false);
  const [fetchMsg,   setFetchMsg]   = useState({ text:"", ok:true });
  const [sellId,     setSellId]     = useState(null);
  const [sellForm,   setSellForm]   = useState({ qty:"", price:"", date:"", notes:"" });
  const [sellErr,    setSellErr]    = useState("");
  const [histId,     setHistId]     = useState(null);

  // ── Inject historical sales into NTNX on first load ──────────────────────
  useEffect(() => {
    const ntnx = usHoldings.find(h => h.ticker === "NTNX");
    if (!ntnx) return;
    const existingIds = new Set((ntnx.sales || []).map(s => s.id));
    const missing = NTNX_HISTORICAL_SALES.filter(s => !existingIds.has(s.id));
    if (missing.length === 0) return;
    // Only add sales history — do NOT touch share count
    setData(d => ({
      ...d,
      usHoldings: d.usHoldings.map(h =>
        h.ticker === "NTNX"
          ? { ...h, sales: [...(h.sales || []), ...missing] }
          : h
      )
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUSD  = usHoldings.reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0);
  const totalINR  = totalUSD*usdInr;
  const totalInvU = usHoldings.reduce((s,h)=>s+h.shares*h.avgCost,0);
  const gainUSD   = totalUSD-totalInvU;
  const upd = p => setData(d=>({...d,...p}));

  // ── Sell handlers ──────────────────────────────────────────────────────────
  const openSell = h => {
    setSellId(h.id);
    setSellForm({ qty:"", price:"", date: new Date().toISOString().slice(0,10), notes:"" });
    setSellErr("");
  };

  const submitSell = () => {
    const h = usHoldings.find(x => x.id === sellId);
    if (!h) return;
    const qty   = parseFloat(sellForm.qty);
    const price = parseFloat(sellForm.price);
    if (!(qty > 0))              { setSellErr("Enter valid qty"); return; }
    if (qty > h.shares)          { setSellErr(`Max ${h.shares} shares available`); return; }
    if (!(price > 0))            { setSellErr("Enter valid price"); return; }
    if (!sellForm.date)          { setSellErr("Enter date"); return; }
    const gross = qty * price;
    const sale = {
      id:            `sale-${h.ticker.toLowerCase()}-${Date.now()}`,
      date:          sellForm.date,
      type:          h.type,
      qty,
      pricePerShare: price,
      grossProceeds: gross,
      commission:    0,
      secFees:       0,
      disbursementFee: 0,
      netProceeds:   gross,
      currency:      "USD",
      grantDetails:  [],
      orderNumber:   "",
      notes:         sellForm.notes
    };
    upd({
      usHoldings: usHoldings.map(x =>
        x.id === sellId
          ? { ...x, shares: x.shares - qty, sales: [...(x.sales || []), sale] }
          : x
      )
    });
    setSellId(null);
  };

  const openPrices = () => {
    const init={};
    usHoldings.forEach(h=>{init[h.ticker]=usPrices[h.ticker]!=null?String(usPrices[h.ticker]):"";});
    init.USDINR=String(usdInr);
    setPriceForm(init); setShowPrices(true);
  };

  const applyPrices = () => {
    const np={};
    usHoldings.forEach(h=>{const v=parseFloat(priceForm[h.ticker]);if(v>0)np[h.ticker]=v;});
    const rate=parseFloat(priceForm.USDINR);
    upd({usPrices:{...usPrices,...np},usdInr:rate>0?rate:usdInr,lastUpdated:new Date().toISOString()});
    setShowPrices(false);
  };

  const tryFetch = async () => {
    setFetching(true); setFetchMsg({text:"Fetching prices…",ok:true});

    try {
      // ── USD/INR via exchangerate-api (no key needed) ──────────────────────
      let newRate = usdInr;
      try {
        const fx = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const fxd = await fx.json();
        if(fxd?.rates?.INR) newRate = fxd.rates.INR;
      } catch {}

      // ── Stock prices via Finnhub ──────────────────────────────────────────
      const tickers = [...new Set(usHoldings.map(h=>h.ticker))];
      const results = await Promise.all(tickers.map(async ticker => {
        try {
          const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`);
          const d = await r.json();
          return { ticker, price: d.c || null };
        } catch { return { ticker, price: null }; }
      }));

      const newPrices = {...usPrices};
      results.forEach(({ticker,price}) => { if(price>0) newPrices[ticker]=price; });
      const fetched = results.filter(r=>r.price>0).length;

      upd({usPrices:newPrices, usdInr:newRate, lastUpdated:new Date().toISOString()});
      setFetchMsg({
        text: fetched>0
          ? `✅ ${fetched}/${tickers.length} prices · ₹${newRate.toFixed(2)}/USD`
          : "⚠️ Prices unavailable — enter manually",
        ok: fetched>0
      });
    } catch(e) {
      setFetchMsg({text:"⚠️ Fetch failed — enter prices manually",ok:false});
    }
    setFetching(false);
  };

  const openAdd  = () => { setEditId(null); setForm({ticker:"",name:"",shares:"",avgCost:"",type:"ETF",owner:"abilash"}); setFormErr(""); setShowEdit(true); };
  const openEdit = h  => { setEditId(h.id); setForm({ticker:h.ticker,name:h.name,shares:String(h.shares),avgCost:String(h.avgCost),type:h.type,owner:h.owner}); setFormErr(""); setShowEdit(true); };

  const submitForm = () => {
    const ticker=form.ticker.trim().toUpperCase(),shares=parseFloat(form.shares),avgCost=parseFloat(form.avgCost);
    if(!ticker){setFormErr("Ticker required");return;}
    if(!(shares>0)){setFormErr("Valid shares required");return;}
    if(!(avgCost>0)){setFormErr("Valid avg cost required");return;}
    const entry={ticker,name:form.name||ticker,shares,avgCost,type:form.type,owner:form.owner};
    upd({usHoldings:editId?usHoldings.map(h=>h.id===editId?{...h,...entry}:h):[...usHoldings,{id:"u"+Date.now(),...entry}]});
    setShowEdit(false);
  };

  // ── Totals across all sale histories ─────────────────────────────────────
  const allSales     = usHoldings.flatMap(h => h.sales || []);
  const totalSoldNet = allSales.reduce((s, x) => s + (x.netProceeds || 0), 0);
  const totalSoldQty = allSales.reduce((s, x) => s + (x.qty || 0), 0);

  const TH = () => (
    <tr style={{background:T.surf}}>
      {[["","left"],["Ticker","left"],["Name","left"],["Type","left"],["Shares","right"],["Avg Cost","right"],["Invested","right"],["Price","right"],["Value USD","right"],["Value INR","right"],["G/L %","right"],["Actions","right"]].map(([h,a],i)=>(
        <th key={i} style={{padding:"10px 13px",textAlign:a,color:T.muted,fontWeight:600,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap",minWidth:i===11?"190px":"auto"}}>{h}</th>
      ))}
    </tr>
  );

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        <StatCard label="Value (USD)"  value={usd(totalUSD)}       sub={inr(totalINR)}         color={T.blue}   accent={T.blue}/>
        <StatCard label="Invested"     value={usd(totalInvU)}      sub={inr(totalInvU*usdInr)} color={T.muted}/>
        <StatCard label="Gain / Loss"  value={usd(gainUSD,true)}   sub={totalInvU?pct(gainUSD/totalInvU*100):""} color={gc(gainUSD)} accent={gc(gainUSD)}/>
        <StatCard label="Sold (Net)" value={usd(totalSoldNet)} sub={allSales.length > 0 ? `${totalSoldQty} shares · ${allSales.length} trades` : "No sales yet"} color={T.purple} accent={T.purple}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:14,fontWeight:600}}>Holdings</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {fetchMsg.text && <span style={{fontSize:12,color:fetchMsg.ok?T.green:T.orange}}>{fetchMsg.text}</span>}
          <Btn onClick={openPrices}>✏️ Update Prices</Btn>
          <Btn onClick={tryFetch} disabled={fetching} variant="blue">
            <span style={{display:"inline-block",animation:fetching?"spin 1s linear infinite":"none"}}>🔄</span>
            {fetching?" Fetching…":" Auto-Refresh"}
          </Btn>
          <Btn onClick={openAdd} variant="primary">+ Add</Btn>
        </div>
      </div>

      <Card style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><TH/></thead>
            <tbody>
              {usHoldings.map((h,idx)=>{
                const price=usPrices[h.ticker]??null;
                const val=price!=null?h.shares*price:null;
                const inv=h.shares*h.avgCost;
                const gain=val!=null?val-inv:null;
                const gp=gain!=null&&inv?gain/inv*100:null;
                const typeCfg={ETF:{bg:"rgba(91,141,239,0.12)",c:T.blue},ESOP:{bg:"rgba(167,139,250,0.12)",c:T.purple},Stock:{bg:"rgba(240,180,41,0.12)",c:T.gold}};
                const tc=typeCfg[h.type]||typeCfg.Stock;
                return (
                  <tr key={h.id} style={{borderBottom:idx<usHoldings.length-1?`1px solid ${T.border}`:"none"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(91,141,239,0.04)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 13px"}}><OwnerBadge id={h.owner}/></td>
                    <td style={{padding:"12px 13px",fontWeight:800,color:T.blue,fontFamily:"monospace"}}>{h.ticker}</td>
                    <td style={{padding:"12px 13px",color:T.text,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</td>
                    <td style={{padding:"12px 13px"}}>
                      <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:tc.bg,color:tc.c,border:`1px solid ${tc.c}40`,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h.type}</span>
                    </td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace"}}>{h.shares.toLocaleString()}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>${h.avgCost.toFixed(2)}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>{usd(inv)}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace"}}>{price!=null?<b>${price.toFixed(2)}</b>:<span style={{color:T.dim}}>—</span>}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{val!=null?usd(val):<span style={{color:T.dim}}>—</span>}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>{val!=null?inr(val*usdInr):"—"}</td>
                    <td style={{padding:"12px 13px",textAlign:"right"}}>
                      {gp!=null?<span style={{color:gc(gp),fontWeight:700,fontSize:12,background:gp>=0?"rgba(0,229,160,0.1)":"rgba(255,94,107,0.1)",padding:"2px 8px",borderRadius:20}}>{pct(gp)}</span>:<span style={{color:T.dim}}>—</span>}
                    </td>
                    <td style={{padding:"8px 13px"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end",alignItems:"center",flexWrap:"nowrap"}}>
                        {(h.sales||[]).length>0 && (
                          <button onClick={()=>setHistId(h.id)} title="Sale history"
                            style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",fontSize:11,fontWeight:600,
                              borderRadius:6,border:`1px solid ${T.border}`,background:"rgba(167,139,250,0.12)",
                              color:T.purple,cursor:"pointer",whiteSpace:"nowrap"}}>
                            📋 {(h.sales||[]).length}
                          </button>
                        )}
                        <button onClick={()=>openSell(h)} title="Record a sale"
                          style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",fontSize:11,fontWeight:600,
                            borderRadius:6,border:`1px solid ${T.blue}40`,background:"rgba(91,141,239,0.12)",
                            color:T.blue,cursor:"pointer",whiteSpace:"nowrap"}}>
                          💰 Sell
                        </button>
                        <button onClick={()=>openEdit(h)} title="Edit"
                          style={{padding:"4px 7px",fontSize:12,borderRadius:6,border:`1px solid ${T.border}`,
                            background:"transparent",color:T.muted,cursor:"pointer"}}>
                          ✏️
                        </button>
                        <button onClick={()=>setDelId(h.id)} title="Delete"
                          style={{padding:"4px 7px",fontSize:12,borderRadius:6,border:`1px solid rgba(255,94,107,0.3)`,
                            background:"rgba(255,94,107,0.08)",color:"#FF5E6B",cursor:"pointer"}}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:T.surf,borderTop:`2px solid ${T.border}`}}>
                <td colSpan={8} style={{padding:"12px 13px",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Total</td>
                <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:800,fontSize:14,color:T.blue}}>{usd(totalUSD)}</td>
                <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:T.gold}}>{inr(totalINR)}</td>
                <td style={{padding:"12px 13px",textAlign:"right"}}><span style={{fontWeight:800,color:gc(gainUSD)}}>{totalInvU?pct(gainUSD/totalInvU*100):"—"}</span></td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Price modal */}
      {showPrices && (
        <Modal onClose={()=>setShowPrices(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:18}}>✏️ Update US Prices</div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:16}}>
            {[...new Set(usHoldings.map(h=>h.ticker))].map(t=>(
              <div key={t}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontFamily:"monospace",fontWeight:800,fontSize:14,color:T.blue}}>{t}</span>
                  <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>USD Price</span>
                </div>
                <input type="text" inputMode="decimal" value={priceForm[t]||""} placeholder="e.g. 46.90"
                  onChange={e=>setPriceForm(p=>({...p,[t]:e.target.value}))}
                  style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontWeight:700,fontSize:14,color:T.gold}}>USD / INR Rate</span>
              </div>
              <input type="text" inputMode="decimal" value={priceForm.USDINR||""} placeholder="e.g. 83.50"
                onChange={e=>setPriceForm(p=>({...p,USDINR:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",color:T.text,fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setShowPrices(false)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={applyPrices} variant="primary" style={{flex:2}}>Apply ✓</Btn>
          </div>
        </Modal>
      )}

      {/* Add/Edit modal */}
      {showEdit && (
        <Modal onClose={()=>setShowEdit(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:20}}>{editId?"Edit":"Add"} US Holding</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12}}>
              <Inp label="Ticker *" value={form.ticker} placeholder="SCHG" onChange={e=>setForm(p=>({...p,ticker:e.target.value.toUpperCase().replace(/\s/g,"")}))}/>
              <Inp label="Name"     value={form.name}   placeholder="Fund name" onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Inp label="Shares *"          value={form.shares}  placeholder="19"    onChange={e=>setForm(p=>({...p,shares:e.target.value}))}  mono/>
              <Inp label="Avg Cost (USD) *"  value={form.avgCost} placeholder="34.33" onChange={e=>setForm(p=>({...p,avgCost:e.target.value}))} mono/>
            </div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Type</div><TypeBtn options={["ETF","Stock","ESOP"]} value={form.type} onChange={v=>setForm(p=>({...p,type:v}))}/></div>
            <div><div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Owner</div><OwnerBtns value={form.owner} onChange={v=>setForm(p=>({...p,owner:v}))}/></div>
            {formErr && <div style={{color:T.red,fontSize:12}}>⚠️ {formErr}</div>}
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowEdit(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?"Save Changes":"Add Holding"}</Btn>
            </div>
          </div>
        </Modal>
      )}
      {delId && <DelConfirm label={usHoldings.find(h=>h.id===delId)?.ticker} onConfirm={()=>{upd({usHoldings:usHoldings.filter(h=>h.id!==delId)});setDelId(null);}} onCancel={()=>setDelId(null)}/>}

      {/* ── Sell Modal ──────────────────────────────────────────────────────── */}
      {sellId && (() => {
        const h = usHoldings.find(x => x.id === sellId);
        if (!h) return null;
        return (
          <Modal onClose={() => setSellId(null)}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>💰 Sell {h.ticker}</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
              Available: <b style={{color:T.text}}>{h.shares.toLocaleString()} shares</b>
              {h.avgCost > 0 && <> · Avg cost <b style={{color:T.text}}>${h.avgCost.toFixed(2)}</b></>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="Shares to Sell *" value={sellForm.qty}   placeholder="50"    onChange={e=>setSellForm(p=>({...p,qty:e.target.value}))}   mono/>
                <Inp label="Sell Price (USD) *" value={sellForm.price} placeholder="48.79" onChange={e=>setSellForm(p=>({...p,price:e.target.value}))} mono/>
              </div>
              <Inp label="Sale Date *" value={sellForm.date} type="date" onChange={e=>setSellForm(p=>({...p,date:e.target.value}))}/>
              <Inp label="Notes (optional)" value={sellForm.notes} placeholder="Grant details, order number…" onChange={e=>setSellForm(p=>({...p,notes:e.target.value}))}/>
              {sellForm.qty && sellForm.price && parseFloat(sellForm.qty)>0 && parseFloat(sellForm.price)>0 && (
                <div style={{background:"rgba(0,229,160,0.08)",border:`1px solid ${T.green}30`,borderRadius:10,padding:"12px 14px",fontSize:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{color:T.muted}}>Gross proceeds</span>
                    <span style={{fontFamily:"monospace",fontWeight:700}}>{usd(parseFloat(sellForm.qty)*parseFloat(sellForm.price))}</span>
                  </div>
                  {h.avgCost > 0 && (
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{color:T.muted}}>Est. gain/loss</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:gc(parseFloat(sellForm.price)-h.avgCost)}}>
                        {usd((parseFloat(sellForm.price)-h.avgCost)*parseFloat(sellForm.qty),true)}
                        {" "}({pct((parseFloat(sellForm.price)/h.avgCost-1)*100)})
                      </span>
                    </div>
                  )}
                </div>
              )}
              {sellErr && <div style={{color:T.red,fontSize:12}}>⚠️ {sellErr}</div>}
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={()=>setSellId(null)} style={{flex:1}}>Cancel</Btn>
                <Btn onClick={submitSell} variant="primary" style={{flex:2}}>Record Sale ✓</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Sales History Modal ─────────────────────────────────────────────── */}
      {histId && (() => {
        const h = usHoldings.find(x => x.id === histId);
        if (!h) return null;
        const sales = [...(h.sales || [])].sort((a,b) => b.date.localeCompare(a.date));
        const totalNet   = sales.reduce((s,x) => s + x.netProceeds, 0);
        const totalShares = sales.reduce((s,x) => s + x.qty, 0);
        const typeColor = { RSU:"rgba(167,139,250,0.15)", ESPP:"rgba(240,180,41,0.15)", ETF:"rgba(91,141,239,0.15)" };
        const typeText  = { RSU:T.purple, ESPP:T.gold, ETF:T.blue };
        return (
          <Modal onClose={() => setHistId(null)} width={680}>
            <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>📋 {h.ticker} Sale History</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
              {sales.length} sale{sales.length!==1?"s":""} · {totalShares.toLocaleString()} shares sold · Net proceeds {usd(totalNet)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,maxHeight:480,overflowY:"auto"}}>
              {sales.map(s => (
                <div key={s.id} style={{background:T.surf,border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px"}}>
                  {/* Header row */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
                        background:typeColor[s.type]||"rgba(91,141,239,0.15)",
                        color:typeText[s.type]||T.blue,
                        border:`1px solid ${(typeText[s.type]||T.blue)}40`,
                        textTransform:"uppercase",letterSpacing:"0.08em"}}>
                        {s.type}
                      </span>
                      <span style={{fontSize:13,fontWeight:700}}>{s.date}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:800,fontFamily:"monospace",color:T.green}}>{usd(s.netProceeds)}</div>
                      <div style={{fontSize:11,color:T.muted}}>net · {s.currency}</div>
                    </div>
                  </div>
                  {/* Details grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,fontSize:12}}>
                    <div><span style={{color:T.muted}}>Shares</span><br/><b style={{fontFamily:"monospace"}}>{s.qty.toLocaleString()}</b></div>
                    <div><span style={{color:T.muted}}>Price</span><br/><b style={{fontFamily:"monospace"}}>${s.pricePerShare.toFixed(2)}</b></div>
                    <div><span style={{color:T.muted}}>Gross</span><br/><b style={{fontFamily:"monospace"}}>{usd(s.grossProceeds)}</b></div>
                    <div><span style={{color:T.muted}}>Fees</span><br/><b style={{fontFamily:"monospace",color:T.orange}}>{usd((s.commission||0)+(s.secFees||0)+(s.disbursementFee||0))}</b></div>
                  </div>
                  {/* Grant details */}
                  {s.grantDetails && s.grantDetails.length > 0 && (
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                      <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Grant Breakdown</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {s.grantDetails.map((g,i) => (
                          <span key={i} style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:"rgba(167,139,250,0.1)",color:T.purple,border:`1px solid ${T.purple}30`,fontFamily:"monospace"}}>
                            {g.grantNumber} · VP{g.vestPeriod} · {g.qty} shares
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Notes / Order number */}
                  {(s.notes || s.orderNumber) && (
                    <div style={{marginTop:8,fontSize:11,color:T.muted,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {s.orderNumber && <span>Order# {s.orderNumber}</span>}
                      {s.notes && <span>{s.notes}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
              <div>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total Sold</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace"}}>{totalShares.toLocaleString()}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total Net</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:T.green}}>{usd(totalNet)}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>INR Value</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:T.gold}}>{inr(totalNet*usdInr)}</div>
              </div>
            </div>
            <div style={{marginTop:14}}>
              <Btn onClick={()=>setHistId(null)} style={{width:"100%"}}>Close</Btn>
            </div>
          </Modal>
        );
      })()}

    <VestSchedule ntnxPrice={(usPrices||{})['NTNX']||0} usdInr={usdInr}/>
    </div>
  );
}
