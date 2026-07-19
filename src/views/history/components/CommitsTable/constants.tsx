import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import type { ReactNode } from "react";

import { CommitIndex, type ICommit } from "../../../../git/commit";
import GitGraph from "../GitGraph/GitGraph";

import CommitMessage from "./CommitMessage";

type FillRemainWidth = "fill";

export interface IHeader {
	prop: "graph" | "description" | "hash" | "author" | "date";
	label: string;
	width: number | FillRemainWidth;
	minWidth: number;
	filterable?: boolean;
	locatable?: boolean;
	filterLogOption?: string;
	transformer: (commit: ICommit) => ReactNode | string;
}

export const HEADERS: IHeader[] = [
	{
		prop: "graph",
		label: "Graph",
		width: 60,
		minWidth: 60,
		transformer: (commit) => (
			<GitGraph data={commit[CommitIndex.GRAPH_SLICE]} />
		),
	},
	{
		prop: "description",
		label: "Description",
		width: "fill",
		minWidth: 160,
		filterable: true,
		filterLogOption: "keyword",
		transformer: (commit) => <CommitMessage commit={commit} />,
	},
	{
		prop: "hash",
		label: "Hash",
		width: 75,
		minWidth: 75,
		locatable: true,
		transformer: (commit) => (
			<>
				<span>{commit[CommitIndex.HASH].slice(0, 6)}</span>
				<VSCodeButton
					data-button
					appearance="icon"
					onClick={() =>
						navigator.clipboard.writeText(commit[CommitIndex.HASH])
					}
					title="Copy Hash"
				>
					<span className="codicon codicon-copy" />
				</VSCodeButton>
			</>
		),
	},
	{
		prop: "author",
		label: "Author",
		width: 90,
		minWidth: 60,
		filterable: true,
		filterLogOption: "authors",
		transformer: (commit) => commit[CommitIndex.AUTHOR_NAME],
	},
	{
		prop: "date",
		label: "Date/Time",
		width: 100,
		minWidth: 100,
		transformer: (commit) => commit[CommitIndex.COMMIT_DATE],
	},
];
