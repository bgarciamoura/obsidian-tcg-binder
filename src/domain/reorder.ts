/**
 * Moves the item at `from` to position `to`, returning a new array — the
 * splice semantics of a drag-and-drop reorder. Out-of-range indexes return
 * an unchanged copy.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
	const next = [...list]
	if (from < 0 || from >= list.length || to < 0 || to >= list.length) return next
	const [moved] = next.splice(from, 1)
	next.splice(to, 0, moved)
	return next
}
