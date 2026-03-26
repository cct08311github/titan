"use client";

import { useState, useEffect } from "react";
import { Users, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

interface MemberSummary {
  userId: string;
  name: string;
  role: string;
  avatar?: string | null;
  taskCount: number;
  overdueCount: number;
  weeklyHours: number;
}

interface TeamSummaryData {
  members: MemberSummary[];
  totalMembers: number;
}

export function TeamOverview() {
  const [data, setData] = useState<TeamSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics/team-summary");
      if (!res.ok) throw new Error("無法載入團隊資料");
      const body = await res.json();
      setData(extractData<TeamSummaryData>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <PageLoading message="載入團隊資料..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;
  if (!data || data.members.length === 0) {
    return (
      <PageEmpty
        icon={<Users className="h-8 w-8" />}
        title="尚無團隊成員資料"
        description="目前沒有活躍的團隊成員"
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          團隊成員摘要
          <span className="text-xs text-muted-foreground font-normal">({data.totalMembers} 人)</span>
        </h2>
        <div className="space-y-3">
          {data.members.map((member) => (
            <MemberSummaryCard key={member.userId} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberSummaryCard({ member }: { member: MemberSummary }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-accent/40 rounded-lg hover:bg-accent/60 transition-colors">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm text-muted-foreground font-medium">
        {member.avatar ? (
          <img src={member.avatar} alt={member.name} className="h-8 w-8 rounded-full" />
        ) : (
          member.name.charAt(0)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{member.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {member.role === "ADMIN" ? "管理員" : member.role === "MANAGER" ? "主管" : "工程師"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-center">
          <div className="text-sm font-semibold tabular-nums">{member.taskCount}</div>
          <div className="text-[10px] text-muted-foreground">進行中</div>
        </div>
        <div className="text-center">
          <div className={cn("text-sm font-semibold tabular-nums", member.overdueCount > 0 && "text-danger")}>
            {member.overdueCount}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            {member.overdueCount > 0 && <AlertTriangle className="h-2.5 w-2.5 text-danger" />}
            逾期
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold tabular-nums">{Number(member.weeklyHours).toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            本週 h
          </div>
        </div>
      </div>
    </div>
  );
}
