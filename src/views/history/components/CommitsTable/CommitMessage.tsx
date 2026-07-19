import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import { type FC, createContext, useContext } from "react";

import {
	CommitIndex,
	type ICommit,
	splitMessage,
} from "../../../../git/commit";
import { CommitGraphSliceIndex } from "../../../../git/types";
import GitTag from "../GitTag/GitTag";

import style from "./CommitsTable.module.scss";

interface IExpandContext {
	isExpanded: (hash: string) => boolean;
	toggle: (hash: string) => void;
}

export const ExpandContext = createContext<IExpandContext>({
	isExpanded: () => false,
	toggle: () => {},
});

interface Props {
	commit: ICommit;
}

const CommitMessage: FC<Props> = ({ commit }) => {
	const { isExpanded, toggle } = useContext(ExpandContext);

	const hash = commit[CommitIndex.HASH];
	const message = commit[CommitIndex.MESSAGE];
	const { subject, body } = splitMessage(message);
	const expanded = isExpanded(hash);

	return (
		<>
			<span className={style.message}>
				{commit[CommitIndex.REF_NAMES].map((refName) => (
					<GitTag
						key={refName}
						refName={refName}
						color={
							commit[CommitIndex.GRAPH_SLICE][
								CommitGraphSliceIndex.COMMIT_COLOR
							]
						}
					/>
				))}
				<span className={style.subject} title={subject}>
					{subject}
				</span>
				{body && (
					<VSCodeButton
						data-button
						data-comment
						appearance="icon"
						title={body}
						className={
							expanded ? style["comment-active"] : undefined
						}
						onClick={() => toggle(hash)}
					>
						<span className="codicon codicon-comment" />
					</VSCodeButton>
				)}
			</span>
			<VSCodeButton
				data-button
				appearance="icon"
				onClick={() => navigator.clipboard.writeText(message)}
				title="Copy Message"
			>
				<span className="codicon codicon-copy" />
			</VSCodeButton>
		</>
	);
};

export default CommitMessage;
