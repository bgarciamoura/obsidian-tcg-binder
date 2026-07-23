import { ItemView, WorkspaceLeaf } from 'obsidian'
import { createRoot, Root } from 'react-dom/client'
import { AppContext } from '../context'
import { BinderRoot } from '../components/BinderRoot'
import { t } from '../i18n'
import type TcgBinderPlugin from '../main'

export const BINDER_VIEW_TYPE = 'tcg-binder-view'

/** Obsidian view that hosts the React tree. */
export class BinderView extends ItemView {
	private root: Root | null = null

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: TcgBinderPlugin,
	) {
		super(leaf)
	}

	getViewType(): string {
		return BINDER_VIEW_TYPE
	}

	getDisplayText(): string {
		return t('view.title')
	}

	getIcon(): string {
		return 'layers'
	}

	onOpen(): Promise<void> {
		this.render()
		return Promise.resolve()
	}

	onClose(): Promise<void> {
		this.root?.unmount()
		this.root = null
		return Promise.resolve()
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement
		container.empty()
		container.addClass('tcgb-view-container')
		this.root?.unmount()
		this.root = createRoot(container)
		this.root.render(
			<AppContext.Provider value={this.app}>
				<BinderRoot plugin={this.plugin} />
			</AppContext.Provider>,
		)
	}
}
