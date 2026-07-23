export interface SetProgress {
	owned: number
	total: number
	percent: number
}

/**
 * Completion of a set counting a card as owned if ANY variant is owned.
 * (Parallel/master-set counting modes need a per-set card+variant index —
 * planned for a later phase.)
 */
export function computeSetProgress(ownedUnique: number, total: number): SetProgress {
	if (total <= 0) {
		return { owned: ownedUnique, total: 0, percent: 0 }
	}
	const percent = Math.min(100, Math.floor((ownedUnique / total) * 100))
	return { owned: ownedUnique, total, percent }
}
