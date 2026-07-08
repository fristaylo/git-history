import { IRoughCommit } from "./commit";

export interface GitOptions {
	repo?: string;
}

export interface LogOptions extends GitOptions {
	ref?: string;
	authors?: string[];
	keyword?: string;
	maxLength?: number;
	count?: number;
	skip?: number;
}

export type ICommitGraphSlice = [number, string, (number | string)[]];

export type ICommitGraphLine = [number, number, string];

export enum CommitGraphSliceIndex {
	COMMIT_INDEX,
	COMMIT_COLOR,
	LINES,
}

export interface BatchedCommits {
	totalCount: number;
	batchNumber: number;
	commits: IRoughCommit[];
	options: LogOptions;
}

export type IBatchedCommits = [
	number,
	number,
	string,
	string,
	string,
	number,
	...string[],
];
