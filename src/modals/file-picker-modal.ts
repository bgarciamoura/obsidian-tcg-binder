import { App, FuzzySuggestModal, TFile } from 'obsidian'

/** Fuzzy picker over a fixed list of files (e.g. "which deck?"). */
export class FilePickerModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private readonly files: TFile[],
		placeholder: string,
		private readonly onPick: (file: TFile) => void,
	) {
		super(app)
		this.setPlaceholder(placeholder)
	}

	getItems(): TFile[] {
		return this.files
	}

	getItemText(file: TFile): string {
		return file.basename
	}

	onChooseItem(file: TFile): void {
		this.onPick(file)
	}
}
