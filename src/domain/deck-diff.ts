/** One decklist line for diffing purposes — printing-specific by card id. */
export interface DiffLine {
	id: string
	qty: number
}

/** A per-printing change between two decklists ("+2" / "-1"). */
export interface DeckChange {
	id: string
	/** Positive: copies added going from `from` to `to`. Negative: removed. */
	delta: number
}

/**
 * The per-printing changes that turn decklist `from` into decklist `to`,
 * in `to`-then-`from` first-seen order. Lines with equal quantities are
 * omitted; an empty result means the lists are identical.
 */
export function diffDecklists(from: DiffLine[], to: DiffLine[]): DeckChange[] {
	const qtyBy = (lines: DiffLine[]) => {
		const map = new Map<string, number>()
		for (const line of lines) map.set(line.id, (map.get(line.id) ?? 0) + line.qty)
		return map
	}
	const before = qtyBy(from)
	const after = qtyBy(to)

	const changes: DeckChange[] = []
	for (const [id, qty] of after) {
		const delta = qty - (before.get(id) ?? 0)
		if (delta !== 0) changes.push({ id, delta })
	}
	for (const [id, qty] of before) {
		if (!after.has(id)) changes.push({ id, delta: -qty })
	}
	return changes
}
