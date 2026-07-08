import path from "path";

import { Uri } from "vscode";

import { Status } from "./status";

import type { ChangeItem } from "./tree";

export interface Change {
	readonly uri: Uri;
	readonly originalUri: Uri;
	readonly renameUri: Uri | undefined;
	readonly status: Status;
}

export function parseGitChanges(repoPath: string, gitResult: string) {
	const entries = gitResult.split("\x00");
	let index = 0;
	const result: Change[] = [];

	entriesLoop: while (index < entries.length - 1) {
		const change = entries[index++];
		const resourcePath = entries[index++];
		if (!change || !resourcePath) {
			break;
		}

		const originalUri = Uri.file(
			path.isAbsolute(resourcePath)
				? resourcePath
				: path.join(repoPath, resourcePath)
		);
		let status: Status = Status.UNTRACKED;

		switch (change[0]) {
			case "M":
				status = Status.MODIFIED;
				break;

			case "A":
				status = Status.INDEX_ADDED;
				break;

			case "D":
				status = Status.DELETED;
				break;

			case "R":
				if (index >= entries.length) {
					break;
				}

				const newPath = entries[index++];
				if (!newPath) {
					break;
				}

				const uri = Uri.file(
					path.isAbsolute(newPath)
						? newPath
						: path.join(repoPath, newPath)
				);
				result.push({
					uri,
					renameUri: uri,
					originalUri,
					status: Status.INDEX_RENAMED,
				});

				continue;

			default:
				break entriesLoop;
		}

		result.push({
			status,
			originalUri,
			uri: originalUri,
			renameUri: originalUri,
		});
	}

	return result;
}

export function getChangePair(
	originalChangeStack: ChangeItem[] = [],
	changeStack: ChangeItem[]
) {
	const originalChangeItem = originalChangeStack.find(({ change }) => change);

	return [
		originalChangeItem || changeStack[0],
		changeStack[changeStack.length - 1],
	];
}
