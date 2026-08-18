import type { TFile } from 'obsidian'
import { functionalKey } from '../domain/text-match'
import type { CardMeta } from './card-notes'
import type TcgBinderPlugin from '../main'

/** Quantities keyed by functional name (when the card note is known) and by id. */
export interface QtyMaps {
	byName: Map<string, number>
	byId: Map<string, number>
}

export interface OwnershipMaps {
	/** Copies in every non-wishlist collection. */
	inCollections: QtyMaps
	/** Copies used by OTHER decks ("reserve deck copies" setting; empty when off). */
	reserved: QtyMaps
}

/**
 * Ownership is aggregated by card NAME across every collection: in the game,
 * any printing of the same name is functionally the same card, so owning
 * "Switch" from SVI satisfies a deck line for "Switch" from MEG. Falls back
 * to id matching for cards whose note lacks a resolvable name. Owned and
 * reserved stay separate so callers can EXPLAIN the math to the user.
 */
export function buildOwnershipMaps(
	plugin: TcgBinderPlugin,
	cardIndex: Map<string, CardMeta>,
	excludeDeckPath: string,
): OwnershipMaps {
	const tally = (maps: QtyMaps, id: string, qty: number) => {
		maps.byId.set(id, (maps.byId.get(id) ?? 0) + qty)
		const meta = cardIndex.get(id)
		if (meta) {
			const key = functionalKey(meta.nameEn, meta.name, id)
			maps.byName.set(key, (maps.byName.get(key) ?? 0) + qty)
		}
	}
	const inCollections: QtyMaps = { byName: new Map(), byId: new Map() }
	const reserved: QtyMaps = { byName: new Map(), byId: new Map() }
	for (const collection of plugin.store.listFiles('collection')) {
		if (plugin.store.getRole(collection) === 'wishlist') continue
		for (const entry of plugin.collections.readEntries(collection)) {
			tally(inCollections, entry.id, entry.qty)
		}
	}
	if (plugin.settings.reserveDeckCopies) {
		for (const deck of plugin.store.listFiles('deck')) {
			if (deck.path === excludeDeckPath) continue
			// A deck that is still just a list holds no physical copies.
			if (!plugin.decks.readAssembled(deck)) continue
			for (const entry of plugin.decks.readEntries(deck)) {
				tally(reserved, entry.id, entry.qty)
			}
		}
	}
	return { inCollections, reserved }
}

/**
 * How many cards of a deck the collection cannot cover — the same math as
 * the deck view's missing list, reduced to one number for the dashboard.
 */
export function countMissingCards(
	plugin: TcgBinderPlugin,
	deck: TFile,
	cardIndex: Map<string, CardMeta>,
): number {
	const owned = buildOwnershipMaps(plugin, cardIndex, deck.path)
	// Deck lines of the same name share one owned pool — aggregate first.
	const needed = new Map<string, { id: string; qty: number }>()
	for (const entry of plugin.decks.readEntries(deck)) {
		const meta = cardIndex.get(entry.id)
		const key = functionalKey(meta?.nameEn ?? null, meta?.name ?? null, entry.id)
		const current = needed.get(key)
		if (current) current.qty += entry.qty
		else needed.set(key, { id: entry.id, qty: entry.qty })
	}
	let missing = 0
	for (const [key, line] of needed) {
		const ownedQty = owned.inCollections.byName.get(key) ?? owned.inCollections.byId.get(line.id) ?? 0
		const reservedQty = owned.reserved.byName.get(key) ?? owned.reserved.byId.get(line.id) ?? 0
		// Clamp: reserved copies can push availability negative, but a deck
		// can never miss more copies than it needs.
		missing += Math.max(0, line.qty - Math.max(0, ownedQty - reservedQty))
	}
	return missing
}
