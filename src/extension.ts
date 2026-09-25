import { ExtensionContext, window, workspace } from "vscode";

import { container, initializeContainer } from "./container/inversify.config";
import { DisposableController } from "./disposables";
import { checkForUpdate } from "./update";

export function activate(context: ExtensionContext) {
	checkForUpdate(context).catch((e) => console.warn("Yummy GitHistory: update check failed", e));
	console.log('Congratulations, your extension "git-history" is now active!');

	if (!workspace.workspaceFolders?.length) {
		window.showWarningMessage(
			"Yummy GitHistory: open a folder with a git repository to view its history."
		);
	}

	context.globalState.update("changedFileTree", {});
	initializeContainer(context);
	const { subscriptions } = context;
	const disposableController = container.get(DisposableController);
	const disposables = disposableController.createDisposables();
	subscriptions.push(...disposables);
}

export function deactivate() {}
