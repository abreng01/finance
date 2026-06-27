import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, own, fmtDate, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

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

  const totalUSD  = usHoldings.reduce((s,h)=>s+h.shares*(usPrices[h.ticker]||0),0);
  const totalINR  = totalUSD*usdInr;
  const totalInvU = usHoldings.reduce((s,h)=>s+h.shares*h.avgCost,0);
  const gainUSD   = totalUSD-totalInvU;
  const upd = p => setData(d=>({...d,...p}));

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
    setFetching(true); setFetchMsg({text:"",ok:true});
    const tickers=[...new Set(usHoldings.map(h=>h.ticker))];
    const sym=[...tickers,"USDINR=X"].join(",");
    const YF=`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${sym}&fields=regularMarketPrice,symbol`;
    for (const a of [()=>fetch(YF),()=>fetch(`https://corsproxy.io/?${encodeURIComponent(YF)}`),()=>fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(YF)}`)]) {
      try {
        const r=await a(); const d=await r.json();
        const quotes=d?.quoteResponse?.result??[];
        if(!quotes.length) continue;
        const map={};
        quotes.forEach(q=>{if(q.regularMarketPrice)map[q.symbol==="USDINR=X"?"USDINR":q.symbol]=q.regularMarketPrice;});
        const {USDINR:rate,...tp}=map;
        if(Object.keys(tp).length){
          upd({usPrices:{...usPrices,...tp},usdInr:rate||usdInr,lastUpdated:new Date().toISOString()});
          setFetchMsg({text:"✅ Prices refreshed",ok:true}); setFetching(false); return;
        }
      } catch {}
    }
    setFetchMsg({text:"⚠️ Auto-fetch blocked — use ✏️ Update Prices",ok:false}); setFetching(false);
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

  const TH = () => (
    <tr style={{background:T.surf}}>
      {[["","left"],["Ticker","left"],["Name","left"],["Type","left"],["Shares","right"],["Avg Cost","right"],["Price","right"],["Value USD","right"],["Value INR","right"],["G/L %","right"],["","right"]].map(([h,a],i)=>(
        <th key={i} style={{padding:"10px 13px",textAlign:a,color:T.muted,fontWeight:600,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
      ))}
    </tr>
  );

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        <StatCard label="Value (USD)"  value={usd(totalUSD)}      sub={inr(totalINR)}   color={T.blue}  accent={T.blue}/>
        <StatCard label="Invested"     value={usd(totalInvU)}     sub={inr(totalInvU*usdInr)} color={T.muted}/>
        <StatCard label="Gain / Loss"  value={usd(gainUSD,true)}  sub={totalInvU?pct(gainUSD/totalInvU*100):""} color={gc(gainUSD)} accent={gc(gainUSD)}/>
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
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace"}}>{price!=null?<b>${price.toFixed(2)}</b>:<span style={{color:T.dim}}>—</span>}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>{val!=null?usd(val):<span style={{color:T.dim}}>—</span>}</td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>{val!=null?inr(val*usdInr):"—"}</td>
                    <td style={{padding:"12px 13px",textAlign:"right"}}>
                      {gp!=null?<span style={{color:gc(gp),fontWeight:700,fontSize:12,background:gp>=0?"rgba(0,229,160,0.1)":"rgba(255,94,107,0.1)",padding:"2px 8px",borderRadius:20}}>{pct(gp)}</span>:<span style={{color:T.dim}}>—</span>}
                    </td>
                    <td style={{padding:"12px 13px"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                        <Btn onClick={()=>openEdit(h)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
                        <Btn onClick={()=>setDelId(h.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:T.surf,borderTop:`2px solid ${T.border}`}}>
                <td colSpan={7} style={{padding:"12px 13px",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Total</td>
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
    </div>
  );
}
