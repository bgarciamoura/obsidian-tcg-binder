/**
 * Distributes `available` owned copies over decklist lines in order,
 * returning how many copies of each line are covered. Same-name lines
 * share one pool (any printing satisfies the deck), so earlier lines
 * absorb the pool first and later ones show as missing.
 */
export function coverLines(lines: { qty: number }[], available: number): number[] {
	let remaining = Math.max(0, available)
	return lines.map((line) => {
		const covered = Math.min(line.qty, remaining)
		remaining -= covered
		return covered
	})
}
