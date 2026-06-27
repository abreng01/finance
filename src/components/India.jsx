import { useState, useEffect, useRef } from 'react';
import { T, OWNERS, PPF_ANNUAL_LIMIT } from '../config';
import { inr, usd, pct, gc, own, fmtDate, fmtDateTime, daysLeft, timeLeft, getIndianFY } from '../helpers';
import { OwnerBadge, Card, Btn, ProgressBar, SectionLabel, StatCard, Modal, Inp, TypeBtn, OwnerBtns, DelConfirm } from './shared';

// ══════════════════════════════════════════════════════════════════════════════
// INDIA PAGE  — with live AMFI NAV fetch + scheme code search
// ══════════════════════════════════════════════════════════════════════════════
export default function IndiaPage({ data, setData }) {
  const { indiaHoldings } = data;
  const [ownerF,      setOwnerF]     = useState("all");
  const [showEdit,    setShowEdit]   = useState(false);
  const [editId,      setEditId]     = useState(null);
  const [showTopUp,      setShowTopUp]     = useState(false);
  const [showNPSProj,    setShowNPSProj]   = useState(false);
  const [showDeploy,  setShowDeploy] = useState(false);
  const [topUpForm,   setTopUpForm]  = useState({owner:"abilash",amount:"",date:new Date().toISOString().slice(0,10),note:""});
  const [deployForm,  setDeployForm] = useState({owner:"abilash",amount:"",fundId:"",date:new Date().toISOString().slice(0,10),note:""});
  const [form,        setForm]       = useState({name:"",type:"MF",category:"",owner:"saiharini",units:"",invested:"",currentValue:"",schemeCode:""});
  const [formErr,     setFormErr]    = useState("");
  const [delId,       setDelId]      = useState(null);
  const [navLoading,    setNavLoading]    = useState(false);
  const [navMsg,        setNavMsg]        = useState({text:"",ok:true});
  const [showManualNav, setShowManualNav] = useState(false);
  const [manualNavs,    setManualNavs]    = useState({});
  // Fund search inside modal
  const [searchQ,     setSearchQ]    = useState("");
  const [searchRes,   setSearchRes]  = useState([]);
  const [searching,   setSearching]  = useState(false);
  const [showSearch,  setShowSearch] = useState(false);
  const searchTimer = useRef(null);

  const upd  = p => setData(d=>({...d,...p}));
  const poolTxns = data.poolTransactions||[];

  // Pool balance per owner = sum of top-ups minus sum of deploys
  const poolBal = (owner) => poolTxns
    .filter(t=>t.owner===owner)
    .reduce((s,t)=>t.type==="topup"?s+t.amount:s-t.amount,0);
  const totalPool = OWNERS.reduce((s,o)=>s+Math.max(0,poolBal(o.id)),0);

  // Top-up submit
  const submitTopUp = () => {
    const amt = parseFloat(topUpForm.amount)||0;
    if(!amt) return;
    const pt = {id:"pt"+Date.now(),type:"topup",owner:topUpForm.owner,amount:amt,date:topUpForm.date,note:topUpForm.note};
    // Pool top-ups tracked in poolTransactions only
    // Inflows page counts them separately for monthly total
    upd({poolTransactions:[...poolTxns,pt]});
    setShowTopUp(false);
    setTopUpForm({owner:"abilash",amount:"",date:new Date().toISOString().slice(0,10),note:""});
  };

  // Deploy submit — reduces pool, increases MF units + invested
  const submitDeploy = () => {
    const amt = parseFloat(deployForm.amount)||0;
    const bal = poolBal(deployForm.owner);
    if(!amt||!deployForm.fundId) return;
    const pt = {id:"pt"+Date.now(),type:"deploy",owner:deployForm.owner,amount:amt,
      date:deployForm.date,fundId:deployForm.fundId,note:deployForm.note};
    const holding = indiaHoldings.find(h=>h.id===deployForm.fundId);
    const addUnits = holding&&holding.currentNav>0 ? amt/holding.currentNav : 0;
    const newHoldings = indiaHoldings.map(h=>h.id===deployForm.fundId
      ?{...h,units:+(h.units+(addUnits)).toFixed(4),invested:+(h.invested+amt).toFixed(2)}:h);
    upd({poolTransactions:[...poolTxns,pt],indiaHoldings:newHoldings});
    setShowDeploy(false);
    setDeployForm({owner:"abilash",amount:"",fundId:"",date:new Date().toISOString().slice(0,10),note:""});
  };

  const shown = ownerF==="all" ? indiaHoldings : indiaHoldings.filter(h=>h.owner===ownerF);
  const mf    = shown.filter(h=>h.type==="MF");
  const other = shown.filter(h=>h.type!=="MF");

  // MFs: ONLY use units × currentNav (never stale currentValue from old sessions)
  // Non-MF (PPF/NPS/etc): use currentValue as manually entered
  const getValue = h => {
    if(h.type==="MF") return (h.units>0 && h.currentNav>0) ? h.units*h.currentNav : 0;
    return h.currentValue||0;
  };

  // A holding is considered "valued" only if it has a real current value
  // G/L only makes sense for MFs — PPF has fixed 7.1% return, NPS has no cost basis
  const isValued = h => h.type==="MF" && h.currentNav>0;

  // NPS = retirement (locked). PPF = long-term (15yr lock). Both non-liquid.
  const npsHolding  = indiaHoldings.find(h=>h.type==="NPS");
  const ppfHolding  = indiaHoldings.find(h=>h.type==="PPF");

  // ── NPS Projection ─────────────────────────────────────────────────────────
  const NPS_MONTHLY   = 52461;
  const NPS_RATE      = 10;   // % p.a. expected return
  const currentAge    = data.fireSettings?.currentAge || 38;
  const retireAge     = 60;
  const yrsToRetire   = retireAge - currentAge;
  // Adhoc NPS contributions logged in Inflows (on top of auto ₹52,461)
  const npsAdhoc      = (data.transactions||[])
    .filter(t => t.holdingId === (npsHolding?.id||'i9') && (t.amountINR||0) > 0)
    .reduce((s,t) => s + (t.amountINR||0), 0);
  const effectiveNPS  = npsValue + npsAdhoc;
  const r             = NPS_RATE/100/12;
  const n             = yrsToRetire * 12;
  const npsProjCorpus = effectiveNPS * Math.pow(1+NPS_RATE/100, yrsToRetire)
                      + NPS_MONTHLY * (Math.pow(1+r,n)-1)/r*(1+r);
  const npsLumpSum    = npsProjCorpus * 0.60;  // tax-free at 60
  const npsAnnuity    = npsProjCorpus * 0.40;  // must buy annuity
  const npsPension    = npsAnnuity * 0.06 / 12; // ~6% annuity rate
  const npsValue    = npsHolding?.currentValue||0;
  const ppfValue    = ppfHolding?.currentValue||0;
  // MF invested = the amount deployed into mutual funds
  const mfInv       = indiaHoldings.filter(h=>h.type==="MF").reduce((s,h)=>s+(h.invested||0),0);
  // Combined MF+PPF invested for card 2
  const mfPpfInv    = mfInv + ppfValue;
  // For G/L: only MFs with actual NAVs
  const totV = indiaHoldings.filter(h=>h.type==="MF").reduce((s,h)=>s+getValue(h),0);
  const totI = mfInv;
  // Only calculate gain/loss for holdings that actually have a current value set
  // Avoids showing misleading losses for funds awaiting NAV entry
  const fundsWithValue = indiaHoldings.filter(h=>isValued(h));
  const glValue    = fundsWithValue.reduce((s,h)=>s+getValue(h),0);
  const glInvested = fundsWithValue.reduce((s,h)=>s+(h.invested||0),0);
  const totG = glValue - glInvested;
  const hasGL = fundsWithValue.length>0 && glInvested>0;

  // ── Auto-fetch NAVs (tries mfapi.in direct + 2 proxies) ─────────────────────
  const fetchNavs = async () => {
    const mfWithCode = indiaHoldings.filter(h=>h.type==="MF"&&h.schemeCode);
    if(!mfWithCode.length){
      setNavMsg({text:"⚠️ Set scheme codes first via ✏️ → 🔍 Search fund",ok:false});
      return;
    }
    setNavLoading(true); setNavMsg({text:"",ok:true});

    const fetchOne = async (schemeCode) => {
      const url = `https://api.mfapi.in/mf/${schemeCode}/latest`;
      const attempts = [
        url,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      ];
      for(const a of attempts){
        try{
          const ctrl = new AbortController();
          const t = setTimeout(()=>ctrl.abort(),6000);
          const res = await fetch(a,{signal:ctrl.signal});
          clearTimeout(t);
          const json = await res.json();
          const nav  = parseFloat(json?.data?.[0]?.nav);
          if(nav>0) return {nav, date:json?.data?.[0]?.date||""};
        }catch{}
      }
      return null;
    };

    const results = await Promise.all(mfWithCode.map(async h=>{
      const r = await fetchOne(h.schemeCode);
      return {id:h.id, ...(r||{nav:null,date:""})};
    }));

    const fetched = results.filter(r=>r.nav);
    if(fetched.length>0){
      const updated = indiaHoldings.map(h=>{
        const r=results.find(x=>x.id===h.id);
        if(!r?.nav) return h;
        return {...h,currentNav:r.nav,currentValue:h.units*r.nav,navDate:r.date};
      });
      upd({indiaHoldings:updated,lastUpdated:new Date().toISOString()});
      setNavMsg({text:`✅ Updated ${fetched.length}/${mfWithCode.length} NAVs`,ok:true});
      setTimeout(()=>setNavMsg({text:"",ok:true}),4000);
    } else {
      // All failed — open manual entry
      const init={};
      mfWithCode.forEach(h=>{init[h.id]=h.currentNav>0?String(h.currentNav):"";});
      setManualNavs(init);
      setShowManualNav(true);
      setNavMsg({text:"⚠️ Auto-fetch blocked — enter NAVs manually below",ok:false});
    }
    setNavLoading(false);
  };

  // ── Apply manually entered NAVs ────────────────────────────────────────────
  const applyManualNavs = () => {
    const updated = indiaHoldings.map(h=>{
      const val = parseFloat(manualNavs[h.id]);
      if(!val||val<=0) return h;
      return {...h,currentNav:val,currentValue:h.units*val,navDate:new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})};
    });
    upd({indiaHoldings:updated,lastUpdated:new Date().toISOString()});
    setShowManualNav(false);
    setNavMsg({text:"✅ NAVs updated",ok:true});
    setTimeout(()=>setNavMsg({text:"",ok:true}),3000);
  };

  // ── Fund name search via mfapi.in ──────────────────────────────────────────
  const doSearch = async q => {
    if(q.trim().length<3){ setSearchRes([]); return; }
    setSearching(true);
    for(const proxy of ["",`https://corsproxy.io/?${encodeURIComponent("REPLACE")}`,`https://api.allorigins.win/raw?url=${encodeURIComponent("REPLACE")}`]){
      try{
        const url=`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`;
        const fetchUrl = proxy ? proxy.replace("REPLACE",url) : url;
        const res=await fetch(fetchUrl,{signal:AbortSignal.timeout?AbortSignal.timeout(6000):undefined});
        const json=await res.json();
        if(Array.isArray(json)&&json.length){
          // Filter to Direct Growth plans
          const filtered=json.filter(s=>
            /direct/i.test(s.schemeName)&&
            /growth/i.test(s.schemeName)&&
            !/idcw|dividend|bonus|reinvest/i.test(s.schemeName)
          ).slice(0,8);
          setSearchRes(filtered.length ? filtered : json.slice(0,8));
          setSearching(false); return;
        }
      }catch{}
    }
    setSearchRes([]); setSearching(false);
  };

  const onSearchChange = q => {
    setSearchQ(q);
    clearTimeout(searchTimer.current);
    searchTimer.current=setTimeout(()=>doSearch(q),500);
  };

  const pickFund = f => {
    setForm(p=>({...p,name:f.schemeName,schemeCode:String(f.schemeCode)}));
    setShowSearch(false); setSearchQ(""); setSearchRes([]);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditId(null); setForm({name:"",type:"MF",category:"",owner:"saiharini",units:"",invested:"",currentValue:"",schemeCode:""}); setFormErr(""); setShowSearch(false); setShowEdit(true); };
  const openEdit = h  => { setEditId(h.id); setForm({name:h.name,type:h.type,category:h.category||"",owner:h.owner,units:String(h.units||""),invested:String(h.invested||""),currentValue:String(h.currentValue||""),schemeCode:h.schemeCode||""}); setFormErr(""); setShowSearch(false); setShowEdit(true); };

  const submitForm = () => {
    if(!form.name.trim()){setFormErr("Name required");return;}
    const isMF = form.type==="MF";
    const entry={name:form.name.trim(),type:form.type,category:form.category,owner:form.owner,
      units:parseFloat(form.units)||0,invested:parseFloat(form.invested)||0,
      currentValue:parseFloat(form.currentValue)||0,
      schemeCode:form.schemeCode||"",currentNav:0};
    const newH=editId?indiaHoldings.map(h=>h.id===editId?{...h,...entry}:h):[...indiaHoldings,{id:"i"+Date.now(),...entry}];
    upd({indiaHoldings:newH}); setShowEdit(false);
  };

  const TH = () => (
    <tr style={{background:T.surf}}>
      {[["","left"],["Name","left"],["Category","left"],["Units","right"],["Avg NAV","right"],["Current NAV","right"],["Invested","right"],["Current Value","right"],["G/L %","right"],["","right"]].map(([h,a],i)=>(
        <th key={i} style={{padding:"10px 13px",textAlign:a,color:T.muted,fontWeight:600,fontSize:10,
          letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
      ))}
    </tr>
  );

  const Row = ({h}) => {
    const isMF    = h.type==="MF";
    const curVal  = getValue(h);
    const inv     = h.invested||0;
    const g       = curVal-inv;
    // Only show G/L if we have an actual current value (NAV set), not just zeros
    const hasVal  = h.type==="MF" ? h.currentNav>0 : curVal>0;
    const gp      = hasVal&&inv>0&&curVal>0 ? g/inv*100 : null;
    const avgNav  = isMF&&h.units>0&&inv>0 ? inv/h.units : null;
    return (
      <tr onMouseEnter={e=>e.currentTarget.style.background="rgba(91,141,239,0.04)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <td style={{padding:"12px 13px",width:28}}><OwnerBadge id={h.owner}/></td>
        <td style={{padding:"12px 13px",maxWidth:200}}>
          <div style={{fontWeight:600,color:T.text}}>{h.name}</div>
          {isMF&&h.schemeCode&&<div style={{fontSize:10,color:T.dim,marginTop:2}}>Code: {h.schemeCode}{h.navDate?` · NAV as of ${h.navDate}`:""}</div>}
          {isMF&&!h.schemeCode&&<div style={{fontSize:10,color:T.orange,marginTop:2}}>⚠️ No scheme code — use ✏️ to search</div>}
        </td>
        <td style={{padding:"12px 13px"}}>
          <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,
            background:"rgba(91,141,239,0.1)",color:T.blue,border:"1px solid rgba(91,141,239,0.25)"}}>{h.category||h.type}</span>
        </td>
        <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>
          {isMF&&h.units>0?h.units.toLocaleString("en-IN",{maximumFractionDigits:3}):"—"}
        </td>
        <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>
          {isMF&&avgNav?`₹${avgNav.toFixed(2)}`:"—"}
        </td>
        <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace"}}>
          {isMF&&h.currentNav>0?<b>₹{h.currentNav.toFixed(4)}</b>:<span style={{color:T.dim}}>—</span>}
        </td>
        <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",color:T.muted}}>
          {inv>0?inr(inv):<span style={{color:T.dim}}>—</span>}
        </td>
        <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:600}}>
          {curVal>0?inr(curVal):<span style={{color:T.dim}}>—</span>}
        </td>
        <td style={{padding:"12px 13px",textAlign:"right"}}>
          {gp!=null?<span style={{color:gc(gp),fontWeight:700,fontSize:12,
            background:gp>=0?"rgba(0,229,160,0.1)":"rgba(255,94,107,0.1)",
            padding:"2px 8px",borderRadius:20}}>{pct(gp)}</span>:<span style={{color:T.dim}}>—</span>}
        </td>
        <td style={{padding:"12px 13px"}}>
          <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
            <Btn onClick={()=>openEdit(h)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
            <Btn onClick={()=>setDelId(h.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        {/* Card 1: NPS Retirement */}
        <Card accent={T.purple} style={{padding:"16px 16px 14px"}}>
          <div style={{fontSize:10,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:7}}>
            🔒 Retirement (NPS)
          </div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:T.purple}}>
            {npsValue>0?inr(npsValue):"—"}
          </div>
          <div style={{fontSize:10,color:T.muted,marginTop:4,lineHeight:1.5}}>
            ₹52,461/mo auto · Locked until retirement
          </div>
          {npsAdhoc>0&&(
            <div style={{fontSize:10,color:T.green,marginTop:2}}>
              +{inr(npsAdhoc)} adhoc logged
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
            {npsHolding&&(
              <button onClick={()=>openEdit(npsHolding)}
                style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:11,
                  fontWeight:600,padding:0}}>
                ✏️ Update balance
              </button>
            )}
            <button onClick={()=>setShowNPSProj(p=>!p)}
              style={{background:"none",border:"none",color:T.purple,cursor:"pointer",fontSize:11,
                fontWeight:600,padding:0}}>
              {showNPSProj?"▲ Hide":"📈 Projection"}
            </button>
          </div>
        </Card>

        {/* Card 2: MF + PPF Invested */}
        <Card accent={T.blue} style={{padding:"16px 16px 14px"}}>
          <div style={{fontSize:10,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:7}}>
            MF + PPF Invested
          </div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:T.blue}}>
            {mfPpfInv>0?inr(mfPpfInv):"—"}
          </div>
          <div style={{fontSize:10,color:T.muted,marginTop:4,lineHeight:1.5}}>
            MF: {inr(mfInv)} · PPF: {ppfValue>0?inr(ppfValue):"₹0 (add balance)"}
          </div>
          {ppfHolding&&(
            <button onClick={()=>openEdit(ppfHolding)}
              style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:11,
                fontWeight:600,padding:"4px 0 0",display:"block"}}>
              ✏️ Update PPF balance
            </button>
          )}
        </Card>

        {/* Card 3: Gain/Loss (MF only) */}
        <Card accent={hasGL?gc(totG):T.dim} style={{padding:"16px 16px 14px"}}>
          <div style={{fontSize:10,color:T.muted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:7}}>
            MF Unrealised Gain/Loss
          </div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:hasGL?gc(totG):T.dim}}>
            {hasGL?inr(Math.abs(totG)):"—"}
          </div>
          <div style={{fontSize:10,marginTop:4}}>
            {hasGL
              ?<span style={{color:gc(totG)}}>{pct(totG/glInvested*100)} · on {inr(glInvested)} invested</span>
              :<span style={{color:T.muted}}>Set NAVs to calculate</span>}
          </div>
        </Card>
      </div>

      {/* Per-owner MF breakdown */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        {OWNERS.map(o=>{
          const ownerMFs = indiaHoldings.filter(h=>h.owner===o.id&&h.type==="MF");
          if(!ownerMFs.length) return null;
          const oInv = ownerMFs.reduce((s,h)=>s+(h.invested||0),0);
          const oVal = ownerMFs.reduce((s,h)=>s+getValue(h),0);
          const ownerFundsWithVal = ownerMFs.filter(h=>isValued(h));
          const oValGL = ownerFundsWithVal.reduce((s,h)=>s+getValue(h),0);
          const oInvGL = ownerFundsWithVal.reduce((s,h)=>s+(h.invested||0),0);
          const oGain  = oValGL - oInvGL;
          const oGp    = oInvGL>0&&oValGL>0 ? (oGain/oInvGL)*100 : null;
          return (
            <Card key={o.id} accent={o.color} style={{padding:"16px 16px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <OwnerBadge id={o.id}/>
                <span style={{fontSize:13,fontWeight:700,color:o.color}}>{o.name}</span>
                <span style={{fontSize:10,color:T.muted,marginLeft:"auto"}}>{ownerMFs.length} fund{ownerMFs.length!==1?"s":""}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div>
                  <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>Invested</div>
                  <div style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:T.text}}>{oInv?inr(oInv):"—"}</div>
                </div>
                <div>
                  <div style={{fontSize:9,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>Current Value</div>
                  <div style={{fontSize:14,fontWeight:700,fontFamily:"monospace",color:oVal>0?o.color:T.dim}}>{oVal>0?inr(oVal):"—"}</div>
                </div>
              </div>
              {oGp!=null&&(
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:T.muted}}>Gain / Loss</span>
                  <span style={{fontSize:12,fontWeight:700,color:gc(oGain),fontFamily:"monospace"}}>{inr(Math.abs(oGain))} <span style={{opacity:0.8}}>({pct(oGp)})</span></span>
                </div>
              )}
            </Card>
          );
        })}
      </div>



      {/* ── NPS Projection Panel ─────────────────────────────────────────── */}
      {showNPSProj&&(
        <Card accent={T.purple} style={{padding:"18px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",
            letterSpacing:"0.12em",marginBottom:14}}>
            📈 NPS Corpus Projection — Age {currentAge} → {retireAge}
          </div>

          {/* Key numbers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
            <div style={{background:T.surf,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:4}}>Base corpus today</div>
              <div style={{fontFamily:"monospace",fontWeight:700,color:T.purple,fontSize:15}}>{inr(effectiveNPS)}</div>
              {npsAdhoc>0&&<div style={{fontSize:10,color:T.green,marginTop:2}}>incl. {inr(npsAdhoc)} adhoc</div>}
            </div>
            <div style={{background:T.surf,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:4}}>Monthly contribution</div>
              <div style={{fontFamily:"monospace",fontWeight:700,fontSize:15}}>₹52,461</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>auto from salary</div>
            </div>
            <div style={{background:T.surf,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:T.muted,marginBottom:4}}>Years to retirement</div>
              <div style={{fontFamily:"monospace",fontWeight:700,fontSize:15}}>{yrsToRetire} yrs</div>
              <div style={{fontSize:10,color:T.muted,marginTop:2}}>at 10% p.a. expected</div>
            </div>
          </div>

          {/* Projected corpus + breakdown */}
          <div style={{background:`rgba(149,117,205,0.08)`,borderRadius:12,padding:"14px 16px",
            border:`1px solid rgba(149,117,205,0.2)`,marginBottom:14}}>
            <div style={{fontSize:11,color:T.muted,marginBottom:6}}>Projected NPS corpus at age {retireAge}</div>
            <div style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:T.purple}}>
              {inr(npsProjCorpus)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
              <div>
                <div style={{fontSize:10,color:T.muted,marginBottom:3}}>60% Lump sum (tax-free)</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:T.green,fontSize:15}}>
                  {inr(npsLumpSum)}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:T.muted,marginBottom:3}}>40% Annuity → monthly pension</div>
                <div style={{fontFamily:"monospace",fontWeight:700,color:T.blue,fontSize:15}}>
                  {inr(npsPension)}/mo
                </div>
                <div style={{fontSize:10,color:T.dim}}>at ~6% annuity rate</div>
              </div>
            </div>
          </div>

          {/* Scenarios */}
          <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>
            Scenarios
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
            {[{r:8,label:"Conservative"},{r:10,label:"Base"},{r:12,label:"Optimistic"}].map(({r:rate,label})=>{
              const rr=rate/100/12, nn=yrsToRetire*12;
              const proj = effectiveNPS*Math.pow(1+rate/100,yrsToRetire)
                         + NPS_MONTHLY*(Math.pow(1+rr,nn)-1)/rr*(1+rr);
              return (
                <div key={rate} style={{background:T.surf,borderRadius:8,padding:"10px 12px",
                  border:rate===10?`1px solid ${T.purple}`:"none"}}>
                  <div style={{fontSize:10,color:T.muted,marginBottom:4}}>{label} ({rate}%)</div>
                  <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,
                    color:rate===10?T.purple:T.text}}>{inr(proj)}</div>
                  <div style={{fontSize:10,color:T.muted,marginTop:2}}>
                    ~{inr(proj*0.4*0.06/12)}/mo pension
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{fontSize:11,color:T.dim,lineHeight:1.6,borderTop:`1px solid ${T.border}`,paddingTop:10}}>
            💡 Any extra NPS contribution you log in Inflows automatically updates this projection.
            Update your NPS balance quarterly from your CRA statement to keep the base accurate.
          </div>
        </Card>
      )}

      {/* ── Deployment Pool ─────────────────────────────────────────────── */}
      <Card accent={T.gold} style={{padding:"18px 18px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:10,color:T.muted,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:5}}>
              Deployment Pool
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <span style={{fontSize:28,fontWeight:800,fontFamily:"monospace",color:T.gold}}>
                {totalPool>0?inr(totalPool):"₹0"}
              </span>
              <span style={{fontSize:12,color:T.muted}}>ready to deploy</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>{setTopUpForm({owner:"abilash",amount:"",date:new Date().toISOString().slice(0,10),note:""});setShowTopUp(true);}} variant="blue">
              + Top Up
            </Btn>
            <Btn onClick={()=>{
              const firstOwnerWithBal = OWNERS.find(o=>poolBal(o.id)>0);
              const defaultOwner = firstOwnerWithBal?firstOwnerWithBal.id:"abilash";
              const bal = poolBal(defaultOwner);
              setDeployForm({owner:defaultOwner,amount:bal>0?String(bal):"",fundId:"",date:new Date().toISOString().slice(0,10),note:""});
              setShowDeploy(true);
            }} variant="primary" disabled={totalPool<=0}>
              → Deploy to MF
            </Btn>
          </div>
        </div>

        {/* Per-owner balances */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
          {OWNERS.map(o=>{
            const bal = poolBal(o.id);
            return (
              <div key={o.id} style={{background:bal>0?o.bg:"rgba(255,255,255,0.03)",borderRadius:10,
                padding:"10px 14px",border:`1px solid ${bal>0?o.color+"40":T.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                  <OwnerBadge id={o.id}/>
                  <span style={{fontSize:11,color:o.color,fontWeight:600}}>{o.name}</span>
                </div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"monospace",color:bal>0?o.color:T.dim}}>
                  {bal>0?inr(bal):"₹0"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent pool activity */}
        {poolTxns.length>0&&(
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Recent Activity</div>
            {[...poolTxns].reverse().slice(0,3).map(t=>{
              const o=own(t.owner); const isD=t.type==="deploy";
              const fund = isD ? indiaHoldings.find(h=>h.id===t.fundId) : null;
              return (
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  fontSize:12,padding:"4px 0",borderBottom:`1px solid ${T.border+"60"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14}}>{isD?"→":"↑"}</span>
                    <span style={{color:T.muted}}>
                      {isD?`Deployed to ${fund?.name||"MF"}  (${o.name})`:`Top-up  (${o.name})`}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontFamily:"monospace",color:isD?T.green:T.gold,fontWeight:600}}>
                      {isD?"+":""}{inr(t.amount)}
                    </span>
                    <span style={{color:T.dim,fontSize:10}}>{t.date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* NPS Retirement Corpus — separate from liquid holdings */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all",...OWNERS.map(o=>o.id)].map(id=>{
            const o=OWNERS.find(x=>x.id===id); const active=ownerF===id;
            return (<button key={id} onClick={()=>setOwnerF(id)}
              style={{padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:active?700:400,
                border:`1px solid ${active?(o?.color||T.green):T.border}`,
                background:active?(o?o.bg:"rgba(0,229,160,0.1)"):"transparent",
                color:active?(o?.color||T.green):T.muted}}>
              {id==="all"?"All owners":o?.name}
            </button>);
          })}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {navMsg.text&&<span style={{fontSize:12,color:navMsg.ok?T.green:T.orange}}>{navMsg.text}</span>}
          <Btn onClick={fetchNavs} disabled={navLoading} variant="blue">
            <span style={{display:"inline-block",animation:navLoading?"spin 1s linear infinite":"none"}}>🔄</span>
            {navLoading?" Fetching NAVs…":" Refresh NAVs"}
          </Btn>
          <Btn onClick={openAdd} variant="primary">+ Add</Btn>
        </div>
      </div>

      {mf.length>0&&(
        <Card style={{overflow:"hidden"}}>
          <SectionLabel>Mutual Funds ({mf.length})</SectionLabel>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><TH/></thead>
              <tbody>{mf.map(h=><Row key={h.id} h={h}/>)}</tbody>
            </table>
          </div>
        </Card>
      )}

      {other.length>0&&(
        <Card style={{overflow:"hidden"}}>
          <SectionLabel>Other Investments</SectionLabel>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:T.surf}}>
                  {[["","left"],["Name","left"],["Type","left"],["Current Value","right"],["Return","right"],["","right"]].map(([h,a],i)=>(
                    <th key={i} style={{padding:"10px 13px",textAlign:a,color:T.muted,fontWeight:600,fontSize:10,
                      letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{other.map((h,idx)=>{
                const isPPF = h.type==="PPF";
                const isNPS = h.type==="NPS";
                return (
                  <tr key={h.id} style={{borderBottom:idx<other.length-1?`1px solid ${T.border}`:"none"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(91,141,239,0.04)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 13px"}}><OwnerBadge id={h.owner}/></td>
                    <td style={{padding:"12px 13px"}}>
                      <div style={{fontWeight:600}}>{h.name}</div>
                      {isPPF&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>Government guaranteed · Lock-in till 60</div>}
                      {isNPS&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>Market-linked · Returns vary</div>}
                    </td>
                    <td style={{padding:"12px 13px"}}>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,
                        background:"rgba(240,180,41,0.1)",color:T.gold,border:"1px solid rgba(240,180,41,0.25)"}}>
                        {h.type}
                      </span>
                    </td>
                    <td style={{padding:"12px 13px",textAlign:"right",fontFamily:"monospace",fontWeight:700,fontSize:14}}>
                      {h.currentValue?inr(h.currentValue):<span style={{color:T.dim,fontWeight:400,fontSize:13}}>Add value →</span>}
                    </td>
                    <td style={{padding:"12px 13px",textAlign:"right"}}>
                      {isPPF&&(()=>{
                        const fy     = getIndianFY();
                        const ppfTxns= (data.transactions||[]).filter(t=>{
                          const holding=data.indiaHoldings.find(x=>x.id===t.holdingId);
                          return t.date>=fy.start && t.date<=fy.end && holding?.type==="PPF";
                        });
                        const contrib = ppfTxns.reduce((s,t)=>s+t.amountINR,0);
                        const pct100  = Math.min(100,(contrib/PPF_ANNUAL_LIMIT)*100);
                        const remaining = Math.max(0,PPF_ANNUAL_LIMIT-contrib);
                        const sc = pct100>=100 ? T.red : pct100>=80 ? T.orange : T.green;
                        return (
                          <div style={{minWidth:160,textAlign:"left"}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                              <span style={{color:T.muted}}>{fy.label} contributions</span>
                              <span style={{color:sc,fontWeight:700}}>{pct100.toFixed(0)}%</span>
                            </div>
                            <ProgressBar value={contrib} max={PPF_ANNUAL_LIMIT} color={sc} h={5}/>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:3}}>
                              <span style={{color:sc,fontWeight:600}}>{inr(contrib)} used</span>
                              <span>{pct100<100?`${inr(remaining)} left`:<span style={{color:T.red}}>⚠️ Limit reached</span>}</span>
                            </div>
                            <div style={{fontSize:10,color:T.dim,marginTop:2}}>Max: ₹1.5L/FY · 7.1% p.a.</div>
                          </div>
                        );
                      })()}
                      {isNPS&&<span style={{fontSize:12,color:T.muted}}>Market-linked</span>}
                    </td>
                    <td style={{padding:"12px 13px"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                        <Btn onClick={()=>openEdit(h)} style={{padding:"3px 9px",fontSize:11}}>✏️</Btn>
                        <Btn onClick={()=>setDelId(h.id)} variant="danger" style={{padding:"3px 9px",fontSize:11}}>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>
      )}

      {shown.length===0&&(
        <Card style={{padding:40,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>🇮🇳</div>
          <div style={{fontWeight:600,color:T.text,marginBottom:6}}>No investments yet</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Add mutual funds, PPF, NPS and more</div>
          <Btn onClick={openAdd} variant="primary">+ Add Investment</Btn>
        </Card>
      )}

      {/* ── MANUAL NAV ENTRY MODAL ─────────────────────────────────────────── */}
      {showManualNav&&(
        <Modal onClose={()=>setShowManualNav(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:4}}>✏️ Enter NAVs Manually</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20,lineHeight:1.6}}>
            Get latest NAVs from <b style={{color:T.text}}>mfapi.in</b>, Groww, Zerodha, or any fund platform.<br/>
            Enter the current NAV for each fund below.
          </div>
          {indiaHoldings.filter(h=>h.type==="MF"&&h.schemeCode).map(h=>(
            <div key={h.id} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600,color:T.text}}>{h.name}</span>
                <span style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Current NAV (₹)</span>
              </div>
              <input type="text" inputMode="decimal"
                value={manualNavs[h.id]||""}
                placeholder={h.currentNav>0?String(h.currentNav):"e.g. 122.74"}
                onChange={e=>setManualNavs(p=>({...p,[h.id]:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"10px 13px",color:T.text,fontSize:14,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
              {h.units>0&&manualNavs[h.id]&&parseFloat(manualNavs[h.id])>0&&(
                <div style={{fontSize:11,color:T.muted,marginTop:3}}>
                  Value: {inr(h.units*parseFloat(manualNavs[h.id]))} · Units: {h.units.toLocaleString("en-IN",{maximumFractionDigits:3})}
                </div>
              )}
            </div>
          ))}
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <Btn onClick={()=>setShowManualNav(false)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={applyManualNavs} variant="primary" style={{flex:2}}>Apply NAVs ✓</Btn>
          </div>
        </Modal>
      )}


      {/* ── TOP UP MODAL ───────────────────────────────────────────────── */}
      {showTopUp&&(
        <Modal onClose={()=>setShowTopUp(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>💧 Top Up Pool</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
            Park funds in savings — counts toward your monthly ₹2.52L target.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Owner</div>
              <OwnerBtns value={topUpForm.owner} onChange={v=>setTopUpForm(p=>({...p,owner:v}))}/>
              {poolBal(topUpForm.owner)>0&&(
                <div style={{fontSize:11,color:T.muted,marginTop:6}}>
                  Current balance: <b style={{color:T.gold,fontFamily:"monospace"}}>{inr(poolBal(topUpForm.owner))}</b>
                </div>
              )}
            </div>
            <Inp label="Amount (₹) *" value={topUpForm.amount} placeholder="e.g. 100000"
              onChange={e=>setTopUpForm(p=>({...p,amount:e.target.value}))} mono/>
            <Inp label="Date" value={topUpForm.date} type="date"
              onChange={e=>setTopUpForm(p=>({...p,date:e.target.value}))}/>
            <Inp label="Note (optional)" value={topUpForm.note} placeholder="e.g. June savings transfer"
              onChange={e=>setTopUpForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowTopUp(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitTopUp} variant="primary" style={{flex:2}}>Top Up Pool ✓</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── DEPLOY MODAL ───────────────────────────────────────────────── */}
      {showDeploy&&(
        <Modal onClose={()=>setShowDeploy(false)}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>→ Deploy to MF</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:20}}>
            Market dipped — move funds from pool into a mutual fund.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>From Owner's Pool</div>
              <OwnerBtns value={deployForm.owner} onChange={v=>{
                const bal=poolBal(v);
                setDeployForm(p=>({...p,owner:v,amount:bal>0?String(bal):""}));
              }}/>
              <div style={{fontSize:11,marginTop:6}}>
                Available: <b style={{color:poolBal(deployForm.owner)>0?T.gold:T.red,fontFamily:"monospace"}}>
                  {inr(Math.max(0,poolBal(deployForm.owner)))}
                </b>
                {poolBal(deployForm.owner)<=0&&<span style={{color:T.red}}> — no balance</span>}
              </div>
            </div>
            <Inp label="Amount (₹) *" value={deployForm.amount} placeholder="Full balance"
              onChange={e=>setDeployForm(p=>({...p,amount:e.target.value}))} mono/>
            <div>
              <div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Into Fund *</div>
              <select value={deployForm.fundId} onChange={e=>setDeployForm(p=>({...p,fundId:e.target.value}))}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,
                  padding:"10px 13px",color:deployForm.fundId?T.text:T.muted,fontSize:13,outline:"none"}}>
                <option value="">Select a mutual fund…</option>
                {indiaHoldings.filter(h=>h.type==="MF").map(h=>{
                  const o=own(h.owner);
                  return <option key={h.id} value={h.id}>{o.name} — {h.name}</option>;
                })}
              </select>
              {deployForm.fundId&&(()=>{
                const h=indiaHoldings.find(x=>x.id===deployForm.fundId);
                const amt=parseFloat(deployForm.amount)||0;
                return h&&h.currentNav>0&&amt>0?(
                  <div style={{fontSize:11,color:T.muted,marginTop:6}}>
                    ≈ <b style={{color:T.green,fontFamily:"monospace"}}>{(amt/h.currentNav).toFixed(3)} units</b> at NAV ₹{h.currentNav}
                  </div>
                ):h&&!h.currentNav?(
                  <div style={{fontSize:11,color:T.orange,marginTop:6}}>⚠️ No NAV set — units won't be calculated automatically</div>
                ):null;
              })()}
            </div>
            <Inp label="Date" value={deployForm.date} type="date"
              onChange={e=>setDeployForm(p=>({...p,date:e.target.value}))}/>
            <Inp label="Note (optional)" value={deployForm.note} placeholder="e.g. Dip buy — Nifty down 2%"
              onChange={e=>setDeployForm(p=>({...p,note:e.target.value}))}/>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setShowDeploy(false)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitDeploy} variant="primary" style={{flex:2}}
                disabled={!deployForm.fundId||!deployForm.amount}>
                Deploy ₹{parseFloat(deployForm.amount)>0?inr(parseFloat(deployForm.amount)):""} ✓
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── ADD / EDIT MODAL ───────────────────────────────────────────────── */}
      {showEdit&&(
        <Modal onClose={()=>{setShowEdit(false);setEditId(null);setShowSearch(false);}}>
          <div style={{fontWeight:700,fontSize:17,marginBottom:20}}>{editId?"Edit":"Add"} India Investment</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Inp label="Name *" value={form.name} placeholder="e.g. HDFC Nifty Next 50 Index Fund" onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>

            <div><div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Type</div>
              <TypeBtn options={["MF","PPF","NPS","Stock","FD","Gold"]} value={form.type} onChange={v=>setForm(p=>({...p,type:v}))}/>
            </div>

            <Inp label="Category (optional)" value={form.category} placeholder="e.g. Mid Cap, Index, Debt" onChange={e=>setForm(p=>({...p,category:e.target.value}))}/>

            {/* MF-specific fields */}
            {form.type==="MF"&&(<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="Units held *"      value={form.units}    placeholder="342.718" onChange={e=>setForm(p=>({...p,units:e.target.value}))}    mono/>
                <Inp label="Total Invested (₹)"value={form.invested} placeholder="54997"  onChange={e=>setForm(p=>({...p,invested:e.target.value}))} mono/>
              </div>

              {/* Scheme code + search */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>AMFI Scheme Code</span>
                  <button onClick={()=>setShowSearch(s=>!s)}
                    style={{fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>
                    {showSearch?"✕ Close":"🔍 Search fund"}
                  </button>
                </div>
                <input type="text" value={form.schemeCode} placeholder="e.g. 145550 — search above to find"
                  onChange={e=>setForm(p=>({...p,schemeCode:e.target.value}))}
                  style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 13px",
                    color:T.text,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>

                {showSearch&&(
                  <div style={{marginTop:10,background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:12}}>
                    <input type="text" value={searchQ} placeholder="Type fund name to search AMFI…"
                      onChange={e=>onSearchChange(e.target.value)}
                      style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:7,padding:"9px 12px",
                        color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                    {searching&&<div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0"}}>Searching AMFI…</div>}
                    {!searching&&searchRes.length>0&&searchRes.map(f=>(
                      <div key={f.schemeCode} onClick={()=>pickFund(f)}
                        style={{padding:"8px 10px",borderRadius:7,cursor:"pointer",marginBottom:4,
                          background:T.surf,border:`1px solid ${T.border}`}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=T.green}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                        <div style={{fontSize:12,fontWeight:600,color:T.text}}>{f.schemeName}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>Code: {f.schemeCode}</div>
                      </div>
                    ))}
                    {!searching&&searchQ.length>=3&&searchRes.length===0&&(
                      <div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"8px 0"}}>No results — try a shorter search term</div>
                    )}
                    {searchQ.length<3&&<div style={{fontSize:11,color:T.dim}}>Type at least 3 characters to search</div>}
                  </div>
                )}
              </div>
            </>)}

            {/* Non-MF: just current value (PPF/NPS don't need invested tracking) */}
            {form.type!=="MF"&&(
              <div>
                <Inp label="Current Value (₹)" value={form.currentValue} placeholder="e.g. 312000"
                  onChange={e=>setForm(p=>({...p,currentValue:e.target.value}))} mono/>
                {form.type==="PPF"&&(
                  <div style={{fontSize:11,color:T.muted,marginTop:6}}>
                    💡 PPF earns <b style={{color:T.green}}>7.1% p.a.</b> (government guaranteed, tax-free)
                  </div>
                )}
                {form.type==="NPS"&&(
                  <div style={{fontSize:11,color:T.muted,marginTop:6}}>
                    💡 NPS returns vary based on your asset allocation scheme
                  </div>
                )}
              </div>
            )}

            <div><div style={{fontSize:11,color:T.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em"}}>Owner</div>
              <OwnerBtns value={form.owner} onChange={v=>setForm(p=>({...p,owner:v}))}/>
            </div>

            {formErr&&<div style={{color:T.red,fontSize:12}}>⚠️ {formErr}</div>}
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{setShowEdit(false);setEditId(null);setShowSearch(false);}} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={submitForm} variant="primary" style={{flex:2}}>{editId?"Save Changes":"Add Investment"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {delId&&<DelConfirm label={indiaHoldings.find(h=>h.id===delId)?.name}
        onConfirm={()=>{upd({indiaHoldings:indiaHoldings.filter(h=>h.id!==delId)});setDelId(null);}}
        onCancel={()=>setDelId(null)}/>}
    </div>
  );
}
