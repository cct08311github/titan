"use client";

import { DeliverableList } from "../deliverable-list";

interface TaskDeliverableSectionProps {
  deliverables: {
    id: string;
    title: string;
    type: "DOCUMENT" | "SYSTEM" | "REPORT" | "APPROVAL";
    status: "NOT_STARTED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED";
    attachmentUrl?: string | null;
  }[];
  taskId: string;
}

export function TaskDeliverableSection({ deliverables, taskId }: TaskDeliverableSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">交付項</h3>
      <div className="bg-muted/30 rounded-xl p-3">
        <DeliverableList deliverables={deliverables} taskId={taskId} />
      </div>
    </div>
  );
}
