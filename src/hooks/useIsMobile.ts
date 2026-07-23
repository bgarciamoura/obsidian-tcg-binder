import { Platform } from 'obsidian'

/**
 * Mobile detection for layout decisions (dropdowns must become bottom sheets
 * on mobile — Obsidian hides view content when an input inside it gets focus).
 */
export function useIsMobile(): boolean {
	return Platform.isMobile
}
