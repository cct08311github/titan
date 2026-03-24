"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocNode = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  version: number;
  updatedAt: string;
  _count?: { children: number };
};

function buildTree(docs: DocNode[]): (DocNode & { children: (DocNode & { children: DocNode[] })[] })[] {
  const map = new Map<string, DocNode & { children: DocNode[] }>();
  for (const d of docs) map.set(d.id, { ...d, children: [] });
  const roots: (DocNode & { children: DocNode[] })[] = [];
  for (const d of docs) {
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId)!.children.push(map.get(d.id)!);
    } else {
      roots.push(map.get(d.id)!);
    }
  }
  return roots as (DocNode & { children: (DocNode & { children: DocNode[] })[] })[];
}

type TreeNodeProps = {
  node: DocNode & { children: (DocNode & { children: DocNode[] })[] };
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChild: (parentId: string) => void;
  onDelete: (id: string) => void;
};

function TreeNode({ node, depth, selectedId, onSelect, onNewChild, onDelete }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors",
          isSelected
            ? "bg-zinc-700 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand toggle */}
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {hasChildren
            ? expanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />
            : <span className="w-3" />}
        </button>

        {/* Icon */}
        <span className="flex-shrink-0">
          {hasChildren
            ? expanded
              ? <FolderOpen className="h-3.5 w-3.5 text-yellow-500/70" />
              : <Folder className="h-3.5 w-3.5 text-yellow-500/70" />
            : <FileText className="h-3.5 w-3.5 text-zinc-500" />}
        </span>

        {/* Title */}
        <span className="flex-1 truncate">{node.title}</span>

        {/* Actions — visible on hover */}
        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            title="新增子文件"
            className="p-0.5 rounded hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200"
            onClick={(e) => { e.stopPropagation(); onNewChild(node.id); }}
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            title="刪除"
            className="p-0.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child as DocNode & { children: (DocNode & { children: DocNode[] })[] }}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onNewChild={onNewChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type DocumentTreeProps = {
  docs: DocNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewDoc: (parentId: string | null) => void;
  onDelete: (id: string) => void;
};

export function DocumentTree({ docs, selectedId, onSelect, onNewDoc, onDelete }: DocumentTreeProps) {
  const tree = buildTree(docs);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">文件</span>
        <button
          title="新增根文件"
          onClick={() => onNewDoc(null)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-zinc-600">
            尚無文件<br />點擊 + 新增
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              onNewChild={(parentId) => onNewDoc(parentId)}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
