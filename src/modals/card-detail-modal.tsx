import { App, Modal } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import { AppContext } from '../context'
import { CardDetail } from '../components/CardDetail'
import type { CardMeta } from '../services/card-notes'
import type TcgBinderPlugin from '../main'

/**
 * Card viewer: big scan + card text, with prev/next navigation over the list
 * the user was looking at (respecting its filters/grouping). Arrow keys work
 * via the modal's own keyboard scope, so they never leak to the editor.
 */
export class CardDetailModal extends Modal {
	private root: Root | null = null
	/** Set by the React tree once mounted — routes scope keys into state. */
	private navigate: ((delta: number) => void) | null = null

	constructor(
		app: App,
		private readonly plugin: TcgBinderPlugin,
		private readonly metas: CardMeta[],
		private readonly startIndex: number,
	) {
		super(app)
	}

	onOpen(): void {
		this.modalEl.addClass('tcgb-detail-modal')
		this.scope.register([], 'ArrowLeft', () => {
			this.navigate?.(-1)
			return false
		})
		this.scope.register([], 'ArrowRight', () => {
			this.navigate?.(1)
			return false
		})

		this.root = createRoot(this.contentEl)
		this.root.render(
			<AppContext.Provider value={this.app}>
				<CardDetail
					plugin={this.plugin}
					metas={this.metas}
					startIndex={this.startIndex}
					registerNavigate={(navigate) => {
						this.navigate = navigate
					}}
					onOpenNote={(meta) => {
						this.close()
						void this.app.workspace.getLeaf(true).openFile(meta.file)
					}}
				/>
			</AppContext.Provider>,
		)
	}

	onClose(): void {
		this.root?.unmount()
		this.root = null
		this.contentEl.empty()
	}
}
