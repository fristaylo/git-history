import { ExtensionContext, TreeView, window } from "vscode";
import { inject, injectable } from "inversify";

import { EXTENSION_SCHEME } from "../../constants";

import { ChangeTreeDataProvider } from "./changeTreeDataProvider";

@injectable()
export class ChangeTreeView {
	private changesViewer: TreeView<any>;

	constructor(
		@inject(Symbol.for("ExtensionContext")) private context: ExtensionContext,
		private changeTreeDataProvider: ChangeTreeDataProvider
	) {
		this.changesViewer = window.createTreeView(
			`${EXTENSION_SCHEME}.changes`,
			{
				treeDataProvider: this.changeTreeDataProvider,
			}
		);
	}
}
