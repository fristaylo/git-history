import { commands, Tab, TabInputText, TabInputTextDiff, window } from "vscode";

import { getDiffUriPair } from "../git/utils";
import { FileNode } from "../git/changes/tree";

export const OPEN_CHANGE_COMMAND = "git-history.changes.openChange";

// VS Code's TreeView API has no native double-click event: a tree item's
// `command` fires on every single click. We detect a double click by tracking
// two clicks on the same file within this time window (in milliseconds).
const DOUBLE_CLICK_THRESHOLD = 500;

type ChangeUris = ReturnType<typeof getDiffUriPair>;

type LastClick = {
	path: string;
	time: number;
	changeUris: ChangeUris;
	opened: Thenable<unknown>;
};

export function getOpenChangeCommandsDisposable() {
	let lastClick: LastClick | undefined;

	return [
		commands.registerCommand(OPEN_CHANGE_COMMAND, async (node: FileNode) => {
			const { path } = node.uri;
			const now = Date.now();

			const isDoubleClick =
				lastClick?.path === path &&
				now - lastClick.time < DOUBLE_CLICK_THRESHOLD;

			if (isDoubleClick) {
				const previous = lastClick!;
				lastClick = undefined;

				// Wait for the change view (opened by the first click) to appear,
				// then close it so the file opens in its place instead of adding
				// a second tab.
				await previous.opened;
				await closeChangeTab(previous.changeUris);

				return openFile(node);
			}

			const changeUris = getDiffUriPair(node);
			const opened = openChange(changeUris);
			lastClick = { path, time: now, changeUris, opened };

			return opened;
		}),
	];
}

function openChange(changeUris: ChangeUris) {
	if (changeUris.length === 1) {
		return commands.executeCommand("vscode.open", changeUris[0]);
	}

	if (changeUris.length === 2) {
		return commands.executeCommand("vscode.diff", ...changeUris);
	}

	return Promise.resolve();
}

function openFile(node: FileNode) {
	return commands.executeCommand("vscode.open", node.uri, { preview: false });
}

async function closeChangeTab(changeUris: ChangeUris) {
	const tab = findChangeTab(changeUris);
	if (tab) {
		await window.tabGroups.close(tab, true);
	}
}

function findChangeTab(changeUris: ChangeUris): Tab | undefined {
	for (const group of window.tabGroups.all) {
		for (const tab of group.tabs) {
			const { input } = tab;

			if (
				changeUris.length === 2 &&
				input instanceof TabInputTextDiff &&
				input.original.toString() === changeUris[0]?.toString() &&
				input.modified.toString() === changeUris[1]?.toString()
			) {
				return tab;
			}

			if (
				changeUris.length === 1 &&
				input instanceof TabInputText &&
				input.uri.toString() === changeUris[0]?.toString()
			) {
				return tab;
			}
		}
	}
}
