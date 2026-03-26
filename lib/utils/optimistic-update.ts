/**
 * Optimistic Update Helper — Issue #803 (K-1)
 *
 * Provides a generic pattern for optimistic UI updates with rollback on failure.
 * Used by kanban drag-and-drop and other real-time interactions.
 */

export interface OptimisticUpdateOptions<T> {
  /** Apply the optimistic change to local state */
  applyOptimistic: () => void;
  /** Execute the actual API call */
  serverAction: () => Promise<T>;
  /** Rollback the optimistic change on failure */
  rollback: () => void;
  /** Optional callback on success */
  onSuccess?: (result: T) => void;
  /** Optional callback on error */
  onError?: (error: unknown) => void;
}

/**
 * Execute an optimistic update: apply local change immediately,
 * then sync with server. On failure, rollback.
 */
export async function executeOptimisticUpdate<T>(
  options: OptimisticUpdateOptions<T>
): Promise<T | null> {
  const { applyOptimistic, serverAction, rollback, onSuccess, onError } = options;

  // Step 1: Apply optimistic change immediately
  applyOptimistic();

  try {
    // Step 2: Sync with server
    const result = await serverAction();
    onSuccess?.(result);
    return result;
  } catch (err) {
    // Step 3: Rollback on failure
    rollback();
    onError?.(err);
    return null;
  }
}

/**
 * Calculate a position value between two existing positions.
 * Used for inserting items between existing sorted items.
 *
 * Returns the midpoint between prevPosition and nextPosition.
 * If no prev (inserting at start), returns nextPosition - 1000.
 * If no next (inserting at end), returns prevPosition + 1000.
 */
export function calculatePosition(
  prevPosition: number | null,
  nextPosition: number | null
): number {
  if (prevPosition === null && nextPosition === null) {
    return 0;
  }
  if (prevPosition === null) {
    return (nextPosition ?? 0) - 1000;
  }
  if (nextPosition === null) {
    return prevPosition + 1000;
  }
  return (prevPosition + nextPosition) / 2;
}
