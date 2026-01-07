import { useState, useCallback, useMemo } from "react";

/**
 * Hook for managing selection state that persists across filtering
 */
export function useSelectionState<T extends { id: string }>(
  items: T[],
  initialSelection: Set<string> = new Set()
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection);

  // Toggle single item selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  // Deselect all
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    const allSelected = items.every((item) => selectedIds.has(item.id));
    if (allSelected) {
      // Deselect all visible items
      const visibleIds = new Set(items.map((item) => item.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all visible items
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }, [items, selectedIds]);

  // Check if item is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  // Get selected items
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  // Check if all visible items are selected
  const allSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  // Check if some (but not all) visible items are selected
  const someSelected = useMemo(
    () =>
      items.length > 0 &&
      items.some((item) => selectedIds.has(item.id)) &&
      !allSelected,
    [items, selectedIds, allSelected]
  );

  return {
    selectedIds,
    selectedItems,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSelectAll,
    isSelected,
    allSelected,
    someSelected,
    setSelectedIds,
  };
}
