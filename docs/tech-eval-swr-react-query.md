# Tech Evaluation: SWR vs React Query vs useEffect

> Issue: #392
> Date: 2026-03-25
> Status: Evaluation
> **Decision: DEFERRED** — 現有 `useApi` hook 可滿足 v1.0 需求。SWR/React Query 待 Phase 2 功能擴展時再評估。

## 1. 背景

TITAN 目前的 client-side 資料取得模式有兩種：

1. **手動 `useEffect` + `useState`** — Dashboard 各子元件（`TodayTasksCard`, `KPIAchievementSection`, `ManagerDashboard`, `EngineerDashboard`）各自維護 `loading` / `error` / `data` 三組 state，手動呼叫 `fetch()`。
2. **`useApi` hook**（`lib/use-api.ts`）— 封裝了 fetch + abort + 401 redirect + 錯誤處理，回傳 `{ data, loading, error, refetch }`。

兩者共通問題：
- 沒有快取（每次掛載皆重新請求）
- 沒有重新驗證（stale-while-revalidate）
- 沒有 optimistic update 機制
- 沒有 deduplication（同時掛載兩個相同請求的元件會打兩次 API）
- 手動 `useEffect` 模式有大量重複樣板碼

## 2. 候選方案比較

| 面向 | 手動 useEffect (現況) | SWR (Vercel) | TanStack Query (React Query) |
|------|----------------------|--------------|------------------------------|
| Bundle size | 0 KB | ~4.2 KB gzip | ~11 KB gzip |
| 快取 | 無 | 內建 stale-while-revalidate | 內建，可配置 staleTime / gcTime |
| Request dedup | 無 | 自動 | 自動 |
| Window refocus revalidation | 無 | 預設開啟 | 預設開啟 |
| Optimistic update | 手動實作 | `mutate()` + rollback | `useMutation` + `onMutate` rollback |
| Pagination | 手動 | `useSWRInfinite` | `useInfiniteQuery` + `keepPreviousData` |
| Devtools | 無 | 無官方（社群版） | 官方 React Query Devtools |
| SSR 整合 | 不適用 | `SWRConfig fallback` | `HydrationBoundary` + `prefetchQuery` |
| Retry | 手動 | 內建，可配 | 內建，可配（預設 3 次指數退避） |
| Dependent queries | 手動 | 回傳 `null` key | `enabled` 參數 |
| TypeScript DX | 一般 | 良好 | 優秀（泛型推斷完整） |
| 維護者 | — | Vercel 團隊 | TanStack (Tanner Linsley) |
| 學習曲線 | 低（已知） | 低 | 中 |
| 與 Next.js 整合深度 | — | 高（同 Vercel 生態系） | 高（官方文件有 Next.js 範例） |

## 3. TITAN 需求對應分析

### 3.1 Dashboard 多重平行請求
Dashboard 頁面同時打 3-4 個 API（tasks、kpi、workload、weekly）。SWR 和 React Query 都會自動 dedup + 快取，但 React Query 的 `useQueries` 更適合動態數量的平行查詢。

### 3.2 Kanban 拖拉 Optimistic Update
看板拖拉任務狀態需要 optimistic update。React Query 的 `useMutation` + `onMutate` + `onError` rollback 模式比 SWR 的 `mutate` 更結構化。

### 3.3 銀行內網環境
Bundle size 差異（4 KB vs 11 KB）在銀行內網環境中影響極小。Devtools 在開發期更有價值。

### 3.4 既有 useApi hook 相容性
`useApi` 的 API signature（`{ data, loading, error, refetch }`）與 SWR/React Query 的回傳值高度相似，遷移成本低。

## 4. POC 範例 — Dashboard with SWR

```tsx
// lib/fetcher.ts
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    throw new Error(`API error ${res.status}`);
  }
  const json = await res.json();
  return json?.data !== undefined ? json.data : json;
};
```

```tsx
// app/(app)/dashboard/page.tsx (改寫片段)
"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

function TodayTasksCard() {
  const { data: tasks, error, isLoading, mutate } = useSWR<Task[]>(
    "/api/tasks?assignee=me&status=TODO,IN_PROGRESS",
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  if (isLoading) return <PageLoading message="載入待辦..." className="py-8" />;
  if (error) return <PageError message={error.message} onRetry={() => mutate()} className="py-8" />;
  if (!tasks?.length) return <PageEmpty ... />;

  // render tasks...
}

function ManagerDashboard() {
  const { data: workload, isLoading: wlLoading } = useSWR<WorkloadData>("/api/reports/workload", fetcher);
  const { data: weekly, isLoading: wrLoading } = useSWR<WeeklyData>("/api/reports/weekly", fetcher);

  if (wlLoading || wrLoading) return <PageLoading />;
  // render...
}
```

## 5. POC 範例 — Dashboard with React Query

```tsx
// lib/query-client.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30 秒內不重新請求
      retry: 1,                    // 銀行環境避免過多重試
      refetchOnWindowFocus: true,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

```tsx
// app/(app)/dashboard/page.tsx (改寫片段)
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";

function TodayTasksCard() {
  const { data: tasks, error, isLoading, refetch } = useQuery<Task[]>({
    queryKey: ["tasks", "me", "TODO,IN_PROGRESS"],
    queryFn: () => fetcher("/api/tasks?assignee=me&status=TODO,IN_PROGRESS"),
  });

  if (isLoading) return <PageLoading message="載入待辦..." className="py-8" />;
  if (error) return <PageError message={error.message} onRetry={() => refetch()} className="py-8" />;
  if (!tasks?.length) return <PageEmpty ... />;
  // render tasks...
}

function ManagerDashboard() {
  const { data: workload, isLoading: wlLoading } = useQuery({
    queryKey: ["reports", "workload"],
    queryFn: () => fetcher("/api/reports/workload"),
  });
  const { data: weekly, isLoading: wrLoading } = useQuery({
    queryKey: ["reports", "weekly"],
    queryFn: () => fetcher("/api/reports/weekly"),
  });

  if (wlLoading || wrLoading) return <PageLoading />;
  // render...
}
```

## 6. 建議

**推薦: SWR**

理由：
1. **與 TITAN 技術棧一致** — TITAN 使用 Next.js (Vercel)，SWR 同為 Vercel 維護，整合最自然
2. **Bundle 更小** — 4.2 KB vs 11 KB，銀行合規審查時依賴越少越好
3. **API 簡潔** — `useSWR(key, fetcher)` 一行即可，學習成本最低
4. **覆蓋 TITAN 需求** — Dashboard 快取、dedup、revalidation 是核心需求；Kanban optimistic update 用 `mutate` 即可
5. **既有 `useApi` hook 可漸進遷移** — 不需一次全改，新元件用 SWR，舊元件逐步替換

若未來需要更複雜的 mutation 管理（離線佇列、分頁預取等），可再評估遷移至 React Query。

## 7. 遷移計畫

### Phase 1 — 基礎建設（1 天）
1. `npm install swr`
2. 建立 `lib/fetcher.ts`（統一 fetch wrapper，含 401 redirect、API 解包邏輯）
3. 在 `app/(app)/layout.tsx` 加入 `<SWRConfig>` 全域設定

### Phase 2 — Dashboard 遷移（1 天）
1. 改寫 `TodayTasksCard` → `useSWR`
2. 改寫 `KPIAchievementSection` → `useSWR`
3. 改寫 `ManagerDashboard` → `useSWR` (workload + weekly)
4. 改寫 `EngineerDashboard` → `useSWR`

### Phase 3 — 全域遷移（2-3 天）
1. 將所有 `useApi` 呼叫點改為 `useSWR`
2. 將手動 `useEffect` fetch 改為 `useSWR`
3. 確認所有頁面正常後，移除 `lib/use-api.ts`

### Phase 4 — 進階功能（視需求）
1. Kanban optimistic update with `mutate`
2. `useSWRInfinite` for paginated lists
3. `SWRConfig fallback` for SSR pre-fetch

## 8. 風險與緩解

| 風險 | 緩解 |
|------|------|
| SWR 自動 revalidate 對銀行 API 造成額外負載 | 設定 `dedupingInterval: 5000`、`revalidateOnFocus: false`（可選） |
| 團隊不熟悉 SWR API | SWR API 極簡，1-2 小時即可上手 |
| 與既有 `useApi` 並存期間的一致性 | Phase 3 統一後移除，過渡期兩者行為相似不衝突 |
