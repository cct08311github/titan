/**
 * Shared types for dashboard components.
 *
 * Keep shapes here when two or more dashboard surfaces need the same shape,
 * so they can't drift independently.
 */

export interface TimeSuggestion {
  taskId: string;
  title: string;
  estimatedHours: number | null;
  suggestion: string;
}
