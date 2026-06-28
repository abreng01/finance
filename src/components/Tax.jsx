import { useState } from 'react';
import { T } from '../config';
import { inr } from '../helpers';
import { Card } from './shared';

const TODAY      = new Date();
const LTCG_LIMIT = 125000;
const LTCG_RATE  = 0.125;
const STCG_RATE  = 0.20;

function daysHeld(dateStr) { return Math.floor((TODAY - new Date(dateStr)) / 86400000); }
function isLTCG(dateStr)   { return daysHeld(dateStr) >= 365; }
function daysToLTCG(dateStr){ return Math.max(0, 365 - daysHeld(dateStr)); }
function ltcgDate(dateStr)  { const d=new Date(dateStr); d.setFullYear(d.getFullYear()+1); return d; }
function fmtDate(d)         { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }

function simulateSell(lots, unitsTosell, currentNav) {
  let remaining=unitsTosell, stcgGain=0, ltcgGain=0;
  for (const lot of [...lots].sort((a,b)=>new Date(a.date)-new Date(b.date))) {
    if(remaining<=0) break;
    const sell=Math.min(remaining,lot.units);
    const gain=(currentNav-lot.nav)*sell;
    if(isLTCG(lot.date)) ltcgGain+=gain; else stcgGain+=gain;
    remaining-=sell;
  }
  const stcgTax=Math.max(0,stcgGain)*STCG_RATE;
  const ltcgTax=Math.max(0,ltcgGain-LTCG_LIMIT)*LTCG_RATE;
  const tax=stcgTax+ltcgTax;
  return { stcgGain, ltcgGain, stcgTax, ltcgTax, tax, grossGain:stcgGain+ltcgGain, netGain:stcgGain+ltcgGain-tax };
}

function FundCard({ f }) {
  const [open,     setOpen]     = useState(false);
  const [sellMode, setSellMode] = useState('full');
  const [sellBy,   setSellBy]   = useState('units');
  const [sellVal,  setSellVal]  = useState('');

  const totalUnits = f.lots.reduce((s,l)=>s+l.units,0);
  const nav        = f.currentNav;
  const unitsToSell= sellMode==='full' ? totalUnits
    : sellBy==='units' ? parseFloat(sellVal)||0
    : nav>0 ? (parseFloat(sellVal)||0)/nav : 0;

  const sim     = simulateSell(f.lots, Math.min(unitsToSell,totalUnits), nav);
  const simFull = simulateSell(f.lots, totalUnits, nav);
  const waitGain= f.lots.reduce((s,l)=>s+(nav-l.nav)*l.units,0);
  const waitTax = Math.max(0,waitGain-LTCG_LIMIT)*LTCG_RATE;
  const taxSaving=Math.max(0,simFull.tax-waitTax);

  return (
    <Card style={{padding:0,overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        padding:'13px 16px',cursor:'pointer',display:'flex',
        justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,
      }}>
        <div>
          <div style={{fontWeight:700,fontSize:13}}>{f.name}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>
            {f.lots.length} lots ·
            <span style={{color:T.green}}> {f.lots.filter(l=>isLTCG(l.date)).length} LTCG</span>
            <span style={{color:T.orange}}> · {f.lots.filter(l=>!isLTCG(l.date)).length} STCG</span>
          </div>
        </div>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:T.muted}}>Tax if sold today</div>
            <div style={{fontFamily:'monospace',fontWeight:700,color:simFull.tax>0?T.red:T.green,fontSize:13}}>
              {simFull.tax>0?inr(simFull.tax):'₹0'}
            </div>
          </div>
          {taxSaving>0&&(
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,color:T.muted}}>Save by waiting</div>
              <div style={{fontFamily:'monospace',fontWeight:700,color:T.gold,fontSize:13}}>{inr(taxSaving)}</div>
            </div>
          )}
          <div style={{fontSize:12,color:T.muted}}>{open?'▲':'▼'}</div>
        </div>
      </div>

      {open&&(
        <div style={{borderTop:`1px solid ${T.border}`}}>
          {/* Lot table */}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:T.surf}}>
                {['Date','Days','Units','Buy NAV','Gross Gain','Net After Tax','Status'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',textAlign:h==='Date'||h==='Status'?'left':'right',
                    fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.lots.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map((lot,i)=>{
                const ltcg=isLTCG(lot.date);
                const gross=nav>0?(nav-lot.nav)*lot.units:0;
                const tax=ltcg?Math.max(0,gross-LTCG_LIMIT)*LTCG_RATE:Math.max(0,gross)*STCG_RATE;
                const net=gross-tax;
                return (
                  <tr key={i} style={{borderTop:`1px solid ${T.border}`}}>
                    <td style={{padding:'10px 12px'}}>{lot.date}</td>
                    <td style={{padding:'10px 12px',textAlign:'right',color:T.muted}}>{daysHeld(lot.date)}</td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace'}}>{lot.units.toFixed(3)}</td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:T.muted}}>₹{lot.nav.toFixed(2)}</td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:gross>=0?T.green:T.red}}>
                      {gross>=0?'+':''}{inr(gross)}
                    </td>
                    <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:net>=0?T.green:T.red}}>
                      {net>=0?'+':''}{inr(net)}
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      {ltcg
                        ?<span style={{background:'rgba(27,175,122,0.15)',color:T.green,borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700}}>LTCG</span>
                        :<span style={{background:'rgba(255,152,0,0.15)',color:T.orange,borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700}}>STCG · {daysToLTCG(lot.date)}d</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Today vs Wait */}
          <div style={{padding:'14px 16px',borderTop:`1px solid ${T.border}`,background:T.surf}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>
              Sell all — Today vs Wait for LTCG
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                {label:'Sell Today',gain:simFull.grossGain,tax:simFull.tax,net:simFull.netGain,color:T.orange},
                {label:'Wait for LTCG',gain:waitGain,tax:waitTax,net:waitGain-waitTax,color:T.green},
              ].map(s=>(
                <div key={s.label} style={{background:T.card,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:s.color,marginBottom:8}}>{s.label}</div>
                  {[{l:'Gross gain',v:s.gain},{l:'Tax',v:-s.tax},{l:'Net in hand',v:s.net,bold:true}].map(r=>(
                    <div key={r.l} style={{display:'flex',justifyContent:'space-between',fontSize:12,
                      padding:'3px 0',borderTop:r.bold?`1px solid ${T.border}`:'none',
                      marginTop:r.bold?4:0,paddingTop:r.bold?6:3}}>
                      <span style={{color:T.muted}}>{r.l}</span>
                      <span style={{fontFamily:'monospace',fontWeight:r.bold?700:400,color:r.v>=0?T.green:T.red}}>
                        {r.v>=0?'+':''}{inr(Math.abs(r.v))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {taxSaving>0&&(
              <div style={{marginTop:10,fontSize:12,color:T.green,fontWeight:600,textAlign:'center'}}>
                💰 Tax saving by waiting: {inr(taxSaving)}
              </div>
            )}
          </div>

          {/* Sell Simulator */}
          <div style={{padding:'14px 16px',borderTop:`1px solid ${T.border}`}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
              🧮 Sell Simulator
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {['full','partial'].map(m=>(
                <button key={m} onClick={()=>{setSellMode(m);setSellVal('');}}
                  style={{padding:'6px 16px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                    background:sellMode===m?T.blue:T.surf,color:sellMode===m?'#fff':T.muted}}>
                  {m==='full'?'Full holding':'Partial'}
                </button>
              ))}
            </div>
            {sellMode==='partial'&&(
              <div style={{marginBottom:12}}>
                <div style={{display:'flex',gap:8,marginBottom:8}}>
                  {['units','amount'].map(b=>(
                    <button key={b} onClick={()=>{setSellBy(b);setSellVal('');}}
                      style={{padding:'4px 12px',borderRadius:16,border:`1px solid ${T.border}`,
                        cursor:'pointer',fontSize:11,fontWeight:600,
                        background:sellBy===b?T.surf:'none',color:sellBy===b?T.text:T.muted}}>
                      By {b==='units'?'Units':'Amount (₹)'}
                    </button>
                  ))}
                </div>
                <input type="number" value={sellVal} onChange={e=>setSellVal(e.target.value)}
                  placeholder={sellBy==='units'?`Units (max ${totalUnits.toFixed(3)})`:`Amount in ₹`}
                  style={{width:'100%',background:T.surf,border:`1px solid ${T.border}`,
                    borderRadius:8,padding:'10px 13px',color:T.text,fontSize:13,outline:'none'}}/>
                {sellBy==='amount'&&parseFloat(sellVal)>0&&nav>0&&(
                  <div style={{fontSize:11,color:T.muted,marginTop:4}}>
                    ≈ {(parseFloat(sellVal)/nav).toFixed(3)} units at NAV ₹{nav}
                  </div>
                )}
              </div>
            )}
            {unitsToSell>0&&(
              <div style={{background:T.surf,borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:T.muted,marginBottom:10}}>
                  Selling {Math.min(unitsToSell,totalUnits).toFixed(3)} units · FIFO order
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
                  {[
                    {l:'Gross Gain',v:sim.grossGain,c:sim.grossGain>=0?T.green:T.red},
                    {l:'STCG Tax (20%)',v:-sim.stcgTax,c:T.red},
                    {l:'LTCG Tax (12.5%)',v:-sim.ltcgTax,c:T.red},
                    {l:'Net in hand',v:sim.netGain,c:sim.netGain>=0?T.green:T.red,bold:true},
                  ].map(item=>(
                    <div key={item.l} style={{background:T.card,borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:T.muted,marginBottom:4}}>{item.l}</div>
                      <div style={{fontFamily:'monospace',fontWeight:item.bold?800:600,fontSize:14,color:item.c}}>
                        {item.v>=0?'+':''}{inr(Math.abs(item.v))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function TaxPage({ data }) {
  const [openMonths, setOpenMonths] = useState({});
  const toggleMonth = m => setOpenMonths(p=>({...p,[m]:!p[m]}));

  const mfLots   = data.mfLots||{};
  const holdings = (data.indiaHoldings||[]).filter(h=>h.type==='MF');
  const funds    = holdings.map(h=>({...h,lots:(mfLots[h.id]||[])})).filter(f=>f.lots.length>0);

  // Portfolio totals
  const allLots    = funds.flatMap(f=>f.lots.map(l=>({...l,currentNav:f.currentNav})));
  const totalLTCG  = allLots.filter(l=>isLTCG(l.date)).reduce((s,l)=>s+Math.max(0,(l.currentNav-l.nav)*l.units),0);
  const totalSTCG  = allLots.filter(l=>!isLTCG(l.date)).reduce((s,l)=>s+Math.max(0,(l.currentNav-l.nav)*l.units),0);
  const ltcgTax    = Math.max(0,totalLTCG-LTCG_LIMIT)*LTCG_RATE;
  const stcgTax    = totalSTCG*STCG_RATE;
  const exemptLeft = Math.max(0,LTCG_LIMIT-totalLTCG);

  // Fund summary rows
  const fundSummary = funds.map(f=>{
    const sim = simulateSell(f.lots, f.lots.reduce((s,l)=>s+l.units,0), f.currentNav);
    const waitGain = f.lots.reduce((s,l)=>s+(f.currentNav-l.nav)*l.units,0);
    const waitTax  = Math.max(0,waitGain-LTCG_LIMIT)*LTCG_RATE;
    return {...f, sim, waitTax, taxSaving:Math.max(0,sim.tax-waitTax)};
  });

  // Calendar — collapsed by month
  const calByMonth = {};
  funds.forEach(f=>{
    f.lots.filter(l=>!isLTCG(l.date)).forEach(l=>{
      const key = ltcgDate(l.date).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
      if(!calByMonth[key]) calByMonth[key]=[];
      calByMonth[key].push({
        fundName:f.name, units:l.units,
        estGain:f.currentNav>0?(f.currentNav-l.nav)*l.units:0,
        buyDate:l.date, ltcgOn:ltcgDate(l.date),
      });
    });
  });
  const sortedMonths = Object.keys(calByMonth).sort((a,b)=>new Date(calByMonth[a][0].ltcgOn)-new Date(calByMonth[b][0].ltcgOn));

  return (
    <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
        {[
          {label:'LTCG Gains (≥1yr)',value:totalLTCG>0?inr(totalLTCG):'₹0',sub:'Tax @ 12.5% above ₹1.25L',color:totalLTCG>0?T.green:T.dim},
          {label:'STCG Gains (<1yr)', value:totalSTCG>0?inr(totalSTCG):'₹0',sub:'Tax @ 20% on full amount',color:totalSTCG>0?T.orange:T.dim},
          {label:'₹1.25L Exemption',  value:inr(exemptLeft)+' left',sub:`Used ${inr(Math.min(totalLTCG,LTCG_LIMIT))} this FY`,color:T.blue},
          {label:'Tax if sold today',  value:ltcgTax+stcgTax>0?inr(ltcgTax+stcgTax):'₹0',sub:'STCG + LTCG combined',color:ltcgTax+stcgTax>0?T.red:T.green},
        ].map(card=>(
          <Card key={card.label} accent={card.color} style={{padding:'16px 16px 14px'}}>
            <div style={{fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>{card.label}</div>
            <div style={{fontSize:18,fontWeight:800,fontFamily:'monospace',color:card.color}}>{card.value}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:4}}>{card.sub}</div>
          </Card>
        ))}
      </div>

      {/* LTCG Calendar — collapsed by month */}
      {sortedMonths.length>0&&(
        <Card style={{padding:'16px 18px'}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>
            📅 LTCG Calendar — when lots become long-term
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {sortedMonths.map(month=>{
              const entries = calByMonth[month];
              const totalGain = entries.reduce((s,e)=>s+e.estGain,0);
              const isOpen = openMonths[month];
              return (
                <div key={month}>
                  {/* Month header — always visible */}
                  <div onClick={()=>toggleMonth(month)} style={{
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 14px',background:T.surf,borderRadius:isOpen?'8px 8px 0 0':8,
                    cursor:'pointer',
                  }}>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <span style={{fontSize:13,fontWeight:700,color:T.blue}}>{month}</span>
                      <span style={{fontSize:11,color:T.muted}}>{entries.length} lot{entries.length!==1?'s':''}</span>
                    </div>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <span style={{fontSize:12,color:T.green,fontFamily:'monospace',fontWeight:600}}>
                        Est. ₹{Math.round(totalGain).toLocaleString('en-IN')} gain
                      </span>
                      <span style={{fontSize:11,color:T.muted}}>{isOpen?'▲':'▼'}</span>
                    </div>
                  </div>
                  {/* Month detail — expanded */}
                  {isOpen&&(
                    <div style={{background:`${T.surf}80`,border:`1px solid ${T.border}`,borderTop:'none',borderRadius:'0 0 8px 8px',padding:'8px 14px 10px'}}>
                      {entries.map((e,i)=>(
                        <div key={i} style={{
                          display:'flex',justifyContent:'space-between',alignItems:'center',
                          padding:'7px 0',borderTop:i>0?`1px solid ${T.border}`:'none',
                          flexWrap:'wrap',gap:6,
                        }}>
                          <div>
                            <span style={{fontSize:12,fontWeight:600}}>{e.fundName}</span>
                            <span style={{fontSize:11,color:T.muted,marginLeft:8}}>{e.units.toFixed(3)} units · bought {e.buyDate}</span>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <span style={{fontSize:12,color:T.green,fontFamily:'monospace',fontWeight:600}}>
                              Est. {inr(e.estGain)}
                            </span>
                            <span style={{fontSize:10,color:T.muted,marginLeft:8}}>→ LTCG on {fmtDate(e.ltcgOn)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:T.dim,marginTop:10,lineHeight:1.6}}>
            First ₹1.25L of LTCG gains per FY (Apr–Mar) is tax-free.
          </div>
        </Card>
      )}

      {/* Fund summary table */}
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,fontSize:10,fontWeight:700,
          color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em'}}>
          Fund Summary
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{background:T.surf}}>
              {['Fund','Lots','STCG Gain','LTCG Gain','Tax Now','Save by Waiting'].map(h=>(
                <th key={h} style={{padding:'8px 12px',textAlign:h==='Fund'?'left':'right',
                  fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fundSummary.map(f=>(
              <tr key={f.id} style={{borderTop:`1px solid ${T.border}`}}>
                <td style={{padding:'10px 12px',fontWeight:600}}>{f.name}</td>
                <td style={{padding:'10px 12px',textAlign:'right',color:T.muted}}>{f.lots.length}</td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:f.sim.stcgGain>0?T.orange:T.dim}}>
                  {f.sim.stcgGain>0?inr(f.sim.stcgGain):'—'}
                </td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:f.sim.ltcgGain>0?T.green:T.dim}}>
                  {f.sim.ltcgGain>0?inr(f.sim.ltcgGain):'—'}
                </td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:f.sim.tax>0?T.red:T.green}}>
                  {f.sim.tax>0?inr(f.sim.tax):'₹0'}
                </td>
                <td style={{padding:'10px 12px',textAlign:'right',fontFamily:'monospace',color:f.taxSaving>0?T.gold:T.dim}}>
                  {f.taxSaving>0?inr(f.taxSaving):'—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Per-fund detail cards */}
      <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:'uppercase',letterSpacing:'0.12em'}}>
        Fund Detail & Sell Simulator
      </div>
      {funds.map(f=><FundCard key={f.id} f={f}/>)}

      <div style={{fontSize:11,color:T.dim,lineHeight:1.7,padding:'4px 2px'}}>
        ⚠️ Estimates based on current NAVs. FIFO order for partial sells. ₹1.25L LTCG exemption per FY (Apr–Mar). Consult a tax advisor for filing.
      </div>
    </div>
  );
}
