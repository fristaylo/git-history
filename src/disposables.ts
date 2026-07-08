import { window } from "vscode";
import { injectable } from "inversify";

import { GitStatusFileDecorationProvider } from "./views/changes/gitStatusFileDecorationProvider";
import { EXTENSION_SCHEME } from "./constants";
import { HistoryWebviewViewProvider } from "./views/history/historyViewProvider";
import { getCommandDisposables } from "./commands";
import { ChangeTreeView } from "./views/changes/changeTreeView";
import { BranchTreeView } from "./views/branches/branchTreeView";

@injectable()
export class DisposableController {
	constructor(
		private webviewProvider: HistoryWebviewViewProvider,
		private changeTreeView: ChangeTreeView,
		private branchTreeView: BranchTreeView,
		private GitStatusFileDecorationProvider: GitStatusFileDecorationProvider
	) {}

	createDisposables() {
		return [
			...getCommandDisposables(),
			window.registerWebviewViewProvider(
				`${EXTENSION_SCHEME}.history`,
				this.webviewProvider,
				{ webviewOptions: { retainContextWhenHidden: true } }
			),
			window.registerFileDecorationProvider(
				this.GitStatusFileDecorationProvider
			),
		];
	}
}
