import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, CirclePlus, Clock3,
  Flame, LayoutDashboard, ListChecks, MoreHorizontal, Pencil, Plus,
  Settings, Target, Trash2, TrendingUp, X, Sparkles, BarChart3
} from "lucide-react";
import "./styles.css";

const KEY = "habitflow-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = d => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0,10);
};
const todayISO = () => iso(new Date());
const parseISO = s => new Date(s + "T12:00:00");
const dateLabel = s => parseISO(s).toLocaleDateString(undefined, {weekday:"long", month:"long", day:"numeric"});
const monthLabel = d => d.toLocaleDateString(undefined, {month:"long", year:"numeric"});
const daysInMonth = d => new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
const sameDay = (a,b) => iso(a) === iso(b);

const starterHabits = [
  {id:uid(), name:"Drink Water", icon:"💧", color:"#4f8cff", schedule:"daily", weekdays:[0,1,2,3,4,5,6], startDate:todayISO(), endDate:"", reminder:"09:00", target:"8 glasses", active:true},
  {id:uid(), name:"DSA Practice", icon:"💻", color:"#8b5cf6", schedule:"weekdays", weekdays:[1,2,3,4,5], startDate:todayISO(), endDate:"", reminder:"18:00", target:"45 min", active:true},
  {id:uid(), name:"Read", icon:"📖", color:"#f59e0b", schedule:"daily", weekdays:[0,1,2,3,4,5,6], startDate:todayISO(), endDate:"", reminder:"21:00", target:"20 min", active:true},
  {id:uid(), name:"Exercise", icon:"🏃", color:"#10b981", schedule:"custom", weekdays:[1,3,5], startDate:todayISO(), endDate:"", reminder:"07:00", target:"30 min", active:true},
  {id:uid(), name:"Journal", icon:"✍️", color:"#ec4899", schedule:"custom", weekdays:[0,2,4,6], startDate:todayISO(), endDate:"", reminder:"22:00", target:"5 min", active:true},
];

function defaultState(){
  return {habits:starterHabits, logs:{}, selectedDate:todayISO()};
}
function load(){
  try { return JSON.parse(localStorage.getItem(KEY)) || defaultState(); }
  catch { return defaultState(); }
}
function save(s){ localStorage.setItem(KEY, JSON.stringify(s)); }

function isScheduled(h, dateStr){
  if(!h.active) return false;
  if(dateStr < h.startDate) return false;
  if(h.endDate && dateStr > h.endDate) return false;
  const dow = parseISO(dateStr).getDay();
  return h.weekdays.includes(dow);
}

function App(){
  const [state,setState] = useState(load);
  const [page,setPage] = useState("dashboard");
  const [month,setMonth] = useState(() => parseISO(todayISO()));
  const [showModal,setShowModal] = useState(false);
  const [editing,setEditing] = useState(null);
  const [toast,setToast] = useState("");
  const [selectedDate,setSelectedDate] = useState(todayISO());

  useEffect(()=>save(state),[state]);
  useEffect(()=>{
    if(!toast) return;
    const t=setTimeout(()=>setToast(""),2200); return ()=>clearTimeout(t);
  },[toast]);

  const logs = state.logs || {};
  const scheduledFor = date => state.habits.filter(h=>isScheduled(h,date));
  const completed = (h,date) => Boolean(logs[date]?.[h.id]?.completed);
  const toggle = (habit,date) => {
    setState(s=>{
      const day={...(s.logs?.[date]||{})};
      day[habit.id]={completed:!day[habit.id]?.completed, completedAt:new Date().toISOString()};
      return {...s, logs:{...s.logs,[date]:day}};
    });
    setToast(completed(habit,date) ? "Habit marked incomplete" : "Nice — habit completed!");
  };

  const upsert = data => {
    setState(s=>{
      const habits = data.id ? s.habits.map(h=>h.id===data.id?data:h) : [...s.habits,{...data,id:uid(),active:true}];
      return {...s,habits};
    });
    setShowModal(false); setEditing(null); setToast(data.id ? "Habit updated" : "Habit added");
  };
  const remove = id => {
    if(!confirm("Delete this habit? Its historical logs will also be removed.")) return;
    setState(s=>{
      const habits=s.habits.filter(h=>h.id!==id);
      const newLogs={};
      for(const [d,day] of Object.entries(s.logs||{})){
        const copy={...day}; delete copy[id]; newLogs[d]=copy;
      }
      return {...s,habits,logs:newLogs};
    });
    setToast("Habit deleted");
  };

  const today = todayISO();
  const selectedHabits = scheduledFor(selectedDate);
  const todayHabits = scheduledFor(today);
  const todayDone = todayHabits.filter(h=>completed(h,today)).length;
  const todayPct = todayHabits.length ? Math.round(todayDone/todayHabits.length*100) : 0;

  const stats = useMemo(()=>calculateStats(state),[state]);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark"><Sparkles size={18}/></div><span>HabitFlow</span></div>
      <div className="sideLabel">WORKSPACE</div>
      <Nav icon={<LayoutDashboard/>} text="Dashboard" active={page==="dashboard"} onClick={()=>setPage("dashboard")}/>
      <Nav icon={<CalendarDays/>} text="Calendar" active={page==="calendar"} onClick={()=>setPage("calendar")}/>
      <Nav icon={<ListChecks/>} text="Habits" active={page==="habits"} onClick={()=>setPage("habits")}/>
      <Nav icon={<TrendingUp/>} text="Insights" active={page==="insights"} onClick={()=>setPage("insights")}/>
      <div className="sideBottom">
        <Nav icon={<Settings/>} text="Settings" active={page==="settings"} onClick={()=>setPage("settings")}/>
        <div className="miniProfile"><div className="avatar">T</div><div><b>My habits</b><span>Local workspace</span></div></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="mobileBrand"><Sparkles size={17}/> HabitFlow</div>
        <div className="topActions">
          <button className="ghostBtn" onClick={()=>{setSelectedDate(today);setPage("dashboard")}}>Today</button>
          <button className="addBtn" onClick={()=>setShowModal(true)}><Plus size={17}/> Add habit</button>
        </div>
      </header>

      {page==="dashboard" && <Dashboard
        today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
        habits={todayHabits} completed={completed} toggle={toggle} pct={todayPct}
        stats={stats} setPage={setPage}
      />}
      {page==="calendar" && <CalendarPage month={month} setMonth={setMonth} state={state} selectedDate={selectedDate} setSelectedDate={setSelectedDate} completed={completed}/>}
      {page==="habits" && <HabitsPage habits={state.habits} onAdd={()=>setShowModal(true)} onEdit={h=>{setEditing(h);setShowModal(true)}} onDelete={remove}/>}
      {page==="insights" && <Insights stats={stats} habits={state.habits}/>}
      {page==="settings" && <SettingsPage state={state} setState={setState} setToast={setToast}/>}

      {showModal && <HabitModal habit={editing} onClose={()=>{setShowModal(false);setEditing(null)}} onSave={upsert}/>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </main>
  </div>
}

function Nav({icon,text,active,onClick}){return <button className={"navItem "+(active?"active":"")} onClick={onClick}>{icon}<span>{text}</span></button>}

function Dashboard({today,selectedDate,setSelectedDate,habits,completed,toggle,pct,stats,setPage}){
  const done=habits.filter(h=>completed(h,today)).length;
  const greeting = new Date().getHours()<12 ? "Good morning" : new Date().getHours()<18 ? "Good afternoon" : "Good evening";
  return <section className="content">
    <div className="hero">
      <div><div className="eyebrow">{dateLabel(today).toUpperCase()}</div><h1>{greeting} 👋</h1><p>Small actions, repeated consistently, become big results.</p></div>
      <div className="streakHero"><Flame size={20}/><div><b>{stats.currentStreak} day streak</b><span>Keep it going</span></div></div>
    </div>

    <div className="gridTop">
      <div className="card progressCard">
        <div className="cardHead"><div><span className="muted">TODAY'S PROGRESS</span><h2>{done} of {habits.length} completed</h2></div><button className="iconBtn"><MoreHorizontal size={18}/></button></div>
        <div className="progressArea">
          <div className="ring" style={{"--pct":pct}}><div><strong>{pct}%</strong><span>complete</span></div></div>
          <div className="miniStats"><Stat label="Current streak" value={stats.currentStreak+" days"} icon={<Flame/>}/><Stat label="Best streak" value={stats.bestStreak+" days"} icon={<Target/>}/><Stat label="This month" value={stats.monthPct+"%"} icon={<BarChart3/>}/></div>
        </div>
      </div>
      <div className="card quoteCard"><Sparkles size={21}/><span>DAILY NOTE</span><h2>{pct===100 ? "Perfect day. You showed up." : pct>=50 ? "You're already halfway there." : "Start with one small win."}</h2><p>Consistency beats intensity. You don't need a perfect day to build a strong habit.</p></div>
    </div>

    <div className="sectionHead"><div><h2>Today's habits</h2><p>{dateLabel(today)}</p></div><button className="textBtn" onClick={()=>setPage("habits")}>Manage habits →</button></div>
    <div className="habitList">
      {habits.length===0 && <Empty text="No habits are scheduled for today." action={()=>setPage("habits")}/>}
      {habits.map(h=><HabitRow key={h.id} h={h} done={completed(h,today)} onToggle={()=>toggle(h,today)}/>)}
    </div>

    <div className="sectionHead calendarHead"><div><h2>Month at a glance</h2><p>Tap a day to inspect its habits.</p></div><button className="textBtn" onClick={()=>setPage("calendar")}>Open calendar →</button></div>
    <MiniCalendar selectedDate={selectedDate} setSelectedDate={setSelectedDate}/>
  </section>
}

function Stat({label,value,icon}){return <div className="stat"><div className="statIcon">{icon}</div><div><span>{label}</span><b>{value}</b></div></div>}

function HabitRow({h,done,onToggle}){
  return <div className={"habitRow "+(done?"done":"")}>
    <button className={"check "+(done?"checked":"")} onClick={onToggle}>{done?<Check size={17}/>:null}</button>
    <div className="habitEmoji" style={{background:h.color+"18"}}>{h.icon}</div>
    <div className="habitInfo"><b>{h.name}</b><span><Clock3 size={13}/> {h.reminder || "No reminder"} · {h.target || "Daily"}</span></div>
    <div className="habitStatus">{done ? "Completed" : "To do"}</div>
  </div>
}

function MiniCalendar({selectedDate,setSelectedDate}){
  const [m,setM]=useState(parseISO(selectedDate));
  const cells=calendarCells(m);
  return <div className="card calendar">
    <div className="calNav"><button className="iconBtn" onClick={()=>setM(new Date(m.getFullYear(),m.getMonth()-1,1))}><ChevronLeft/></button><b>{monthLabel(m)}</b><button className="iconBtn" onClick={()=>setM(new Date(m.getFullYear(),m.getMonth()+1,1))}><ChevronRight/></button></div>
    <div className="weekdays">{["S","M","T","W","T","F","S"].map((x,i)=><span key={i}>{x}</span>)}</div>
    <div className="calendarGrid">{cells.map((d,i)=>d?<button key={i} className={"calDay "+(d===selectedDate?"selected":"")+(d===todayISO()?" today":"")} onClick={()=>setSelectedDate(d)}>{parseISO(d).getDate()}</button>:<span key={i}/>)}</div>
  </div>
}

function CalendarPage({month,setMonth,state,selectedDate,setSelectedDate,completed}){
  const cells=calendarCells(month);
  const dayInfo=d=>{const hs=state.habits.filter(h=>isScheduled(h,d));const done=hs.filter(h=>completed(h,d)).length;return {hs,done,pct:hs.length?Math.round(done/hs.length*100):0}};
  const selected=dayInfo(selectedDate);
  return <section className="content">
    <div className="pageTitle"><div><div className="eyebrow">HISTORY</div><h1>Calendar</h1><p>See exactly how consistent you've been.</p></div></div>
    <div className="calendarLayout">
      <div className="card bigCalendar">
        <div className="calNav"><button className="iconBtn" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><h2>{monthLabel(month)}</h2><button className="iconBtn" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div>
        <div className="weekdays">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(x=><span key={x}>{x.slice(0,3)}</span>)}</div>
        <div className="calendarGrid big">{cells.map((d,i)=>d?<button key={i} className={"calendarCell "+(d===selectedDate?"selected":"")+(d===todayISO()?" today":"")} onClick={()=>setSelectedDate(d)}>
          <span>{parseISO(d).getDate()}</span>{dayInfo(d).hs.length>0&&<div className="dayBar"><i style={{width:dayInfo(d).pct+"%"}}/></div>}<small>{dayInfo(d).done}/{dayInfo(d).hs.length}</small>
        </button>:<span key={i}/>)}</div>
      </div>
      <div className="card dayDetails">
        <div className="eyebrow">{selectedDate===todayISO()?"TODAY":parseISO(selectedDate).toLocaleDateString(undefined,{weekday:"long"}).toUpperCase()}</div>
        <h2>{dateLabel(selectedDate)}</h2>
        <div className="dayScore"><strong>{selected.pct}%</strong><span>{selected.done} of {selected.hs.length} habits completed</span></div>
        <div className="detailList">{selected.hs.map(h=><div className="detailItem" key={h.id}><span>{h.icon}</span><b>{h.name}</b>{completed(h,selectedDate)?<Check size={16}/>:<span className="emptyDot"/>}</div>)}</div>
      </div>
    </div>
  </section>
}

function HabitsPage({habits,onAdd,onEdit,onDelete}){
  return <section className="content">
    <div className="pageTitle"><div><div className="eyebrow">ROUTINE</div><h1>My habits</h1><p>Decide what deserves a place in your day.</p></div><button className="addBtn" onClick={onAdd}><Plus size={17}/> New habit</button></div>
    <div className="habitCards">{habits.map(h=><div className="card habitCard" key={h.id}>
      <div className="habitCardTop"><div className="largeEmoji" style={{background:h.color+"18"}}>{h.icon}</div><div className="habitCardActions"><button className="iconBtn" onClick={()=>onEdit(h)}><Pencil size={16}/></button><button className="iconBtn danger" onClick={()=>onDelete(h.id)}><Trash2 size={16}/></button></div></div>
      <h2>{h.name}</h2><p>{scheduleText(h)}</p>
      <div className="habitMeta"><span>⏰ {h.reminder||"No reminder"}</span><span>🎯 {h.target||"Complete it"}</span></div>
      <div className="weekdayPills">{["S","M","T","W","T","F","S"].map((x,i)=><span className={h.weekdays.includes(i)?"on":""} key={i}>{x}</span>)}</div>
    </div>)}</div>
    {habits.length===0&&<Empty text="You haven't created any habits yet." action={onAdd}/>}
  </section>
}

function Insights({stats,habits}){
  const max=Math.max(...stats.weekValues,1);
  return <section className="content">
    <div className="pageTitle"><div><div className="eyebrow">ANALYTICS</div><h1>Insights</h1><p>Understand your consistency, not just your checkmarks.</p></div></div>
    <div className="insightGrid">
      <div className="card insightStat"><span>OVERALL COMPLETION</span><strong>{stats.allPct}%</strong><p>Across all scheduled habit days</p></div>
      <div className="card insightStat"><span>CURRENT STREAK</span><strong>{stats.currentStreak}</strong><p>Consecutive active days</p></div>
      <div className="card insightStat"><span>LONGEST STREAK</span><strong>{stats.bestStreak}</strong><p>Your personal best</p></div>
      <div className="card insightStat"><span>ACTIVE HABITS</span><strong>{habits.filter(h=>h.active).length}</strong><p>Currently in your routine</p></div>
    </div>
    <div className="card chartCard"><div className="sectionHead"><div><h2>Last 7 days</h2><p>Completion percentage by day</p></div></div>
      <div className="barChart">{stats.weekValues.map((v,i)=><div className="barCol" key={i}><span>{v}%</span><div className="barTrack"><i style={{height:Math.max(v,3)+"%"}}/></div><small>{stats.weekLabels[i]}</small></div>)}</div>
    </div>
    <div className="card tableCard"><div className="sectionHead"><div><h2>Habit performance</h2><p>Where your consistency is strongest.</p></div></div>
      {stats.habitStats.map(x=><div className="perfRow" key={x.id}><span className="perfIcon">{x.icon}</span><b>{x.name}</b><div className="perfTrack"><i style={{width:x.pct+"%",background:x.color}}/></div><strong>{x.pct}%</strong></div>)}
    </div>
  </section>
}

function SettingsPage({state,setState,setToast}){
  const reset=()=>{if(confirm("Reset all habits and history to the starter data?")){const s=defaultState();setState(s);setToast("Workspace reset")}};
  const clear=()=>{if(confirm("Delete all completion history? Your habits will remain.")){setState(s=>({...s,logs:{}}));setToast("History cleared")}};
  return <section className="content">
    <div className="pageTitle"><div><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p>Your data stays in this browser.</p></div></div>
    <div className="card settingsCard"><h2>Data</h2><p>HabitFlow uses local storage in this version, so your habits and history persist between visits on this device.</p><div className="settingActions"><button className="secondaryBtn" onClick={clear}>Clear completion history</button><button className="dangerBtn" onClick={reset}>Reset workspace</button></div></div>
    <div className="card settingsCard"><h2>What's next</h2><p>This architecture is ready to move to Firebase later for accounts, cloud sync, notifications, and multi-device access.</p></div>
  </section>
}

function HabitModal({habit,onClose,onSave}){
  const initial=habit || {name:"",icon:"✨",color:"#4f8cff",schedule:"daily",weekdays:[0,1,2,3,4,5,6],startDate:todayISO(),endDate:"",reminder:"",target:""};
  const [f,setF]=useState(initial);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const toggleDay=i=>set("weekdays",f.weekdays.includes(i)?f.weekdays.filter(x=>x!==i):[...f.weekdays,i].sort());
  const scheduleChange=v=>{
    const weekdays=v==="daily"?[0,1,2,3,4,5,6]:v==="weekdays"?[1,2,3,4,5]:v==="weekends"?[0,6]:f.weekdays;
    setF(x=>({...x,schedule:v,weekdays}));
  };
  const submit=e=>{e.preventDefault(); if(!f.name.trim())return; onSave({...f,name:f.name.trim()})};
  return <div className="modalBackdrop"><form className="modal" onSubmit={submit}>
    <div className="modalHead"><div><span className="eyebrow">{habit?"EDIT HABIT":"NEW HABIT"}</span><h2>{habit?"Update your habit":"Create a habit"}</h2></div><button type="button" className="iconBtn" onClick={onClose}><X/></button></div>
    <label>Habit name<input autoFocus value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Study DSA"/></label>
    <div className="formGrid"><label>Icon<input value={f.icon} onChange={e=>set("icon",e.target.value)} maxLength={4}/></label><label>Accent<select value={f.color} onChange={e=>set("color",e.target.value)}>{["#4f8cff","#8b5cf6","#10b981","#f59e0b","#ec4899","#ef4444","#06b6d4"].map(c=><option key={c}>{c}</option>)}</select></label></div>
    <label>Schedule<select value={f.schedule} onChange={e=>scheduleChange(e.target.value)}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="custom">Custom days</option></select></label>
    <div className="formLabel">Active days</div><div className="dayPicker">{["S","M","T","W","T","F","S"].map((x,i)=><button type="button" className={f.weekdays.includes(i)?"chosen":""} onClick={()=>toggleDay(i)} key={i}>{x}</button>)}</div>
    <div className="formGrid"><label>Start date<input type="date" value={f.startDate} onChange={e=>set("startDate",e.target.value)}/></label><label>End date <small>(optional)</small><input type="date" value={f.endDate} onChange={e=>set("endDate",e.target.value)}/></label></div>
    <div className="formGrid"><label>Reminder <small>(optional)</small><input type="time" value={f.reminder} onChange={e=>set("reminder",e.target.value)}/></label><label>Target <small>(optional)</small><input value={f.target} onChange={e=>set("target",e.target.value)} placeholder="30 min"/></label></div>
    <div className="modalActions"><button type="button" className="secondaryBtn" onClick={onClose}>Cancel</button><button className="addBtn" type="submit">{habit?"Save changes":"Create habit"}</button></div>
  </form></div>
}

function Empty({text,action}){return <div className="empty"><Target size={26}/><b>{text}</b><button className="secondaryBtn" onClick={action}>Get started</button></div>}

function calendarCells(m){
  const first=new Date(m.getFullYear(),m.getMonth(),1).getDay();
  const n=daysInMonth(m), arr=Array(first).fill(null);
  for(let i=1;i<=n;i++)arr.push(iso(new Date(m.getFullYear(),m.getMonth(),i)));
  while(arr.length%7)arr.push(null);
  return arr;
}
function scheduleText(h){
  if(h.schedule==="daily")return "Every day";
  if(h.schedule==="weekdays")return "Monday to Friday";
  if(h.schedule==="weekends")return "Saturday and Sunday";
  return h.weekdays.map(i=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][i]).join(" · ");
}
function calculateStats(state){
  const today=todayISO();
  let current=0, best=0, run=0;
  const d=new Date(); d.setHours(12,0,0,0);
  for(let i=0;i<365;i++){
    const s=iso(d);
    const hs=state.habits.filter(h=>isScheduled(h,s));
    const pct=hs.length?hs.filter(h=>state.logs?.[s]?.[h.id]?.completed).length/hs.length:0;
    if(hs.length && pct===1){run++;best=Math.max(best,run)} else if(hs.length){run=0}
    if(i===0){current=pct===1&&hs.length?1:0}
    d.setDate(d.getDate()-1);
  }
  run=0;
  d=new Date(); d.setHours(12,0,0,0);
  for(let i=0;i<365;i++){
    const s=iso(d),hs=state.habits.filter(h=>isScheduled(h,s));
    if(hs.length&&hs.every(h=>state.logs?.[s]?.[h.id]?.completed))run++; else if(hs.length)break; else {}
    if(hs.length&&i>0&&run===i+1) current=run;
  }
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  let total=0,done=0;
  for(let day=1;day<=daysInMonth(now);day++){
    const s=iso(new Date(y,m,day)); const hs=state.habits.filter(h=>isScheduled(h,s));
    total+=hs.length;done+=hs.filter(h=>state.logs?.[s]?.[h.id]?.completed).length;
  }
  const allDays=[]; for(let i=6;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);allDays.push(x)}
  const weekValues=allDays.map(d=>{const s=iso(d),hs=state.habits.filter(h=>isScheduled(h,s));return hs.length?Math.round(hs.filter(h=>state.logs?.[s]?.[h.id]?.completed).length/hs.length*100):0});
  const habitStats=state.habits.map(h=>{
    let t=0,d=0; for(let i=0;i<365;i++){const x=new Date();x.setDate(x.getDate()-i);const s=iso(x);if(isScheduled(h,s)){t++;if(state.logs?.[s]?.[h.id]?.completed)d++}}
    return {id:h.id,name:h.name,icon:h.icon,color:h.color,pct:t?Math.round(d/t*100):0};
  });
  return {currentStreak:current,bestStreak:best,monthPct:total?Math.round(done/total*100):0,allPct:total?Math.round(done/total*100):0,weekValues,weekLabels:allDays.map(d=>d.toLocaleDateString(undefined,{weekday:"short"})),habitStats};
}

createRoot(document.getElementById("root")).render(<App/>);
