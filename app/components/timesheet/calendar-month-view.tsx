"use client";

/**
 * CalendarMonthView — Issue #966
 *
 * Month grid calendar for the timesheet page:
 * - Days as cells, each shows total hours + color coding
 *   (green ≤8h, yellow >8h, red >10h, gray 0)
 * - Click day → navigate to day view for that date
 * - Manager: team member selector dropdown
 * - Month navigation: ◀ 上月 | 本月 | 下月 ▶
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

interface DayData { date: string; totalHours: number; entryCount: number; }
interface CalendarMonthViewProps { onDayClick: (date: Date) => void; }

function getDaysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfWeek(year: number, month: number): number { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
function fmtDate(y: number, m: number, d: number): string { return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function isWeekend(y: number, m: number, d: number): boolean { const day = new Date(y, m, d).getDay(); return day === 0 || day === 6; }
function isToday(y: number, m: number, d: number): boolean { const n = new Date(); return n.getFullYear()===y && n.getMonth()===m && n.getDate()===d; }
function hourColor(h: number): string {
  if (h <= 0) return "bg-muted/30 text-muted-foreground/40";
  if (h <= 8) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (h <= 10) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}
function hourBadge(h: number): string {
  if (h <= 0) return "text-muted-foreground/30";
  if (h <= 8) return "text-emerald-600 dark:text-emerald-400";
  if (h <= 10) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarMonthView({ onDayClick }: CalendarMonthViewProps) {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [dayData, setDayData] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{id:string;name:string}[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month);
  const monthDisplay = `${year} 年 ${month + 1} 月`;

  const prevMonth = useCallback(() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1)), []);
  const goToThisMonth = useCallback(() => setCurrentMonth(new Date()), []);

  const fetchMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("weekStart", `${year}-${String(month+1).padStart(2,"0")}-01`);
      if (selectedUserId) p.set("userId", selectedUserId);
      const res = await fetch(`/api/time-entries?${p}`);
      if (!res.ok) throw new Error("fail");
      const body = await res.json();
      const entries = extractItems<{id:string;date:string;hours:number}>(body);
      const map = new Map<string, DayData>();
      for (const e of entries) {
        const ds = e.date.split("T")[0];
        const ex = map.get(ds);
        if (ex) { ex.totalHours += e.hours; ex.entryCount += 1; }
        else map.set(ds, { date: ds, totalHours: e.hours, entryCount: 1 });
      }
      setDayData(map);
    } catch { setDayData(new Map()); } finally { setLoading(false); }
  }, [year, month, selectedUserId]);

  useEffect(() => { fetchMonthData(); }, [fetchMonthData]);
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/users").then(r=>r.json()).then(body => {
      setUsers(extractItems<{id:string;name:string}>(body).map(u=>({id:u.id,name:u.name})));
    }).catch(()=>{});
  }, [isManager]);

  const cells = useMemo(() => {
    const c: {day:number|null;dateStr:string|null}[] = [];
    for (let i=0;i<firstDayOffset;i++) c.push({day:null,dateStr:null});
    for (let d=1;d<=daysInMonth;d++) c.push({day:d,dateStr:fmtDate(year,month,d)});
    while (c.length%7!==0) c.push({day:null,dateStr:null});
    return c;
  }, [year,month,daysInMonth,firstDayOffset]);

  const total = Array.from(dayData.values()).reduce((s,d)=>s+d.totalHours,0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="上個月"><ChevronLeft className="h-4 w-4"/></button>
          <span className="text-sm font-medium min-w-[100px] text-center">{monthDisplay}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="下個月"><ChevronRight className="h-4 w-4"/></button>
          <button onClick={goToThisMonth} className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"><Calendar className="h-3 w-3 inline mr-1"/>本月</button>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground"/>
              <select aria-label="選擇成員" value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)} className="bg-background border border-border rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                <option value="">我的工時</option>
                {users.map(u=>(<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
          )}
          <span className="text-xs text-muted-foreground">月計：<span className={cn("font-medium ml-0.5",hourBadge(total))}>{total.toFixed(1)}h</span></span>
        </div>
      </div>
      <div className={cn("transition-opacity",loading&&"opacity-50")}>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d,i)=>(<div key={d} className={cn("text-center text-xs font-medium py-1.5",i>=5?"text-muted-foreground/60":"text-muted-foreground")}>{d}</div>))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell,idx)=>{
            if(cell.day===null) return <div key={`e-${idx}`} className="aspect-square"/>;
            const dd=cell.dateStr?dayData.get(cell.dateStr):null;
            const h=dd?.totalHours??0;
            const td=isToday(year,month,cell.day);
            const we=isWeekend(year,month,cell.day);
            return (
              <button key={cell.dateStr} onClick={()=>onDayClick(new Date(year,month,cell.day!))}
                className={cn("aspect-square rounded-lg border transition-all hover:ring-2 hover:ring-ring/30 flex flex-col items-center justify-center gap-0.5 p-1",hourColor(h),td&&"ring-2 ring-primary/50",we&&h<=0&&"bg-muted/10 border-border/30")}
                aria-label={`${cell.dateStr}: ${h}h`} title={`${cell.dateStr} — ${h.toFixed(1)}h（${dd?.entryCount??0} 筆）`}>
                <span className={cn("text-xs font-medium leading-none",td&&"text-primary font-bold",we&&h<=0&&"text-muted-foreground/40")}>{cell.day}</span>
                {h>0&&<span className={cn("text-[10px] font-semibold tabular-nums leading-none",hourBadge(h))}>{h.toFixed(1)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-muted/30"/><span>0h</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-500/15"/><span>≤8h</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-500/15"/><span>&gt;8h</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500/15"/><span>&gt;10h</span></div>
      </div>
    </div>
  );
}
