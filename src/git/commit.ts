import type { ICommitGraphSlice } from "./types";

export type ICommit = [
	string,
	string[],
	string,
	string[],
	string,
	string,
	string,
	string,
	ICommitGraphSlice?,
];

export type IRoughCommit = [string, string[], string];

export enum CommitIndex {
	HASH = 0,
	REF_NAMES = 1,
	MESSAGE = 2,
	PARENTS = 3,
	COMMIT_DATE = 4,
	AUTHOR_EMAIL = 5,
	AUTHOR_NAME = 6,
	AUTHOR_DATE = 7,
	GRAPH_SLICE = 8,
}

export const REFS_SEPARATOR = ", ";

export function splitMessage(message: string): {
	subject: string;
	body: string;
} {
	const newLine = message.indexOf("\n");
	if (newLine === -1) {
		return { subject: message, body: "" };
	}
	return {
		subject: message.slice(0, newLine),
		body: message.slice(newLine + 1).trim(),
	};
}

export function parseCommits(data: string) {
	const commitRegex =
		/([0-9a-f]{40})\n(.*)\n(.*)\n(.*)\n(.*)\n(.*)\n(.*)(?:\n([^]*?))?(?:\x00)/gm;

	const commits: IRoughCommit[] = [];

	let commitData;
	let ref;
	let parents;
	let match;

	do {
		match = commitRegex.exec(data);
		if (match === null) {
			break;
		}

		[commitData, ref, , , , , , parents] = match;

		const commit: IRoughCommit = [
			` ${ref}`.substr(1),
			parents ? parents.split(" ") : [],
			commitData,
		];

		commits.push(commit);
	} while (true);

	return commits;
}

export function parseCommit(commitData: string): ICommit {
	const commitRegex =
		/([0-9a-f]{40})\n(.*)\n(.*)\n(.*)\n(.*)\n(.*)\n(.*)(?:\n([^]*?))?(?:\x00)(.*)\n(.*)\n(.*)/g;

	let ref;
	let refNames;
	let authorName;
	let authorEmail;
	let authorDate;
	let commitDate;
	let parents;
	let message;
	let commitPosition;
	let commitColor;
	let stringifiedLines;
	let match;

	match = commitRegex.exec(commitData)!;

	[
		,
		ref,
		refNames,
		authorName,
		authorEmail,
		authorDate,
		commitDate,
		parents,
		message,
		commitPosition,
		commitColor,
		stringifiedLines,
	] = match;

	if (message[message.length - 1] === "\n") {
		message = message.substr(0, message.length - 1);
	}

	return [
		` ${ref}`.substr(1),
		refNames ? refNames.split(REFS_SEPARATOR) : [],
		` ${message}`.substr(1),
		parents ? parents.split(" ") : [],
		formatDateTime(Number(authorDate) * 1000),
		` ${authorEmail}`.substr(1),
		` ${authorName}`.substr(1),
		formatDateTime(Number(commitDate) * 1000),
		[Number(commitPosition), commitColor, JSON.parse(stringifiedLines)],
	];
}

function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, "0");

	const day = pad(date.getDate());
	const month = pad(date.getMonth() + 1);
	const year = pad(date.getFullYear() % 100);
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());

	return `${day}.${month}.${year}, ${hours}:${minutes}`;
}
