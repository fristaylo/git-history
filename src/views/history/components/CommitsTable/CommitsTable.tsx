import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import {
	type FC,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useMeasure } from "react-use";

import type { IBatchedCommits } from "../../../../git/types";

import { ChannelContext } from "../../data/channel";
import PickableList from "../PickableList/PickableList";

import { type ICommit, parseCommit } from "../../../../git/commit";

import { useBatchCommits } from "./useBatchCommits";
import { resetColumnSizes, useColumnResize } from "./useColumnResize";

import { HEADERS } from "./constants";

import style from "./CommitsTable.module.scss";

const CommitsTableInner: FC = () => {
	const channel = useContext(ChannelContext)!;

	const [measureRef, { width: totalWidth }] = useMeasure<HTMLDivElement>();

	const { commits, commitsCount, options, setBatchedCommits } =
		useBatchCommits();

	function diff(sortedRefs: string[]) {
		channel.viewChanges(sortedRefs);
	}

	const subscribeSwitcher = useCallback(() => {
		channel.subscribeSwitcher((batchedCommits: IBatchedCommits) =>
			setBatchedCommits(batchedCommits)
		);
	}, [channel, setBatchedCommits]);

	const onSelectReference = useCallback(
		() => channel.switchReference(),
		[channel]
	);

	const onFilter = useCallback(
		(prop: string) => {
			switch (prop) {
				case "description":
					channel.filterMessage((batchedCommits: IBatchedCommits) =>
						setBatchedCommits(batchedCommits)
					);
					break;
				case "author":
					channel.filterAuthor((batchedCommits: IBatchedCommits) =>
						setBatchedCommits(batchedCommits)
					);
					break;
			}
		},
		[channel, setBatchedCommits]
	);

	const [locationIndex, setLocationIndex] = useState<number>();
	const onLocate = useCallback(
		async (prop: string) => {
			switch (prop) {
				case "hash":
					const hash = await channel.inputHash();
					if (!hash) {
						return;
					}

					const index = commits.findIndex((commit) =>
						commit.startsWith(hash || "")
					);

					if (index === -1) {
						channel.showWarningMessage("No commit matched!");
					}

					setLocationIndex(index);

					setTimeout(() => {
						setLocationIndex(undefined);
					}, 1500);
					break;
			}
		},
		[channel, commits]
	);

	const [mergeBaseHash, setMergeBaseHash] = useState<string>("");

	useEffect(() => {
		channel.getMergeBase().then(setMergeBaseHash);
	}, [channel, options.ref]);

	const divergeIndex = useMemo(() => {
		if (!mergeBaseHash) {
			return undefined;
		}
		const index = commits.findIndex((commit) =>
			commit.startsWith(mergeBaseHash)
		);
		return index === -1 ? undefined : index;
	}, [commits, mergeBaseHash]);

	// Column visibility is owned by the extension and toggled from the native
	// "Toggle Columns" menu in the view title; we just render what it sends.
	const [hiddenProps, setHiddenProps] = useState<Set<string>>(new Set());

	const headers = useMemo(
		() => HEADERS.filter((header) => !hiddenProps.has(header.prop)),
		[hiddenProps]
	);

	const [resetToken, setResetToken] = useState(0);
	const { columns } = useColumnResize(headers, totalWidth, resetToken);

	const contentWidth = Math.max(
		columns.reduce((acc, column) => acc + column.size, 0),
		totalWidth
	);

	const headerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		subscribeSwitcher();

		channel.subscribeColumns((hiddenColumns: string[]) =>
			setHiddenProps(new Set(hiddenColumns))
		);

		channel.autoRefreshLog();
	}, [channel, subscribeSwitcher]);

	return (
		<>
			<VSCodeButton
				appearance="secondary"
				onClick={() => {
					resetColumnSizes();
					setResetToken((token) => token + 1);
				}}
			>
				Reset sizes
			</VSCodeButton>
			<div className={style["header-viewport"]}>
				<div
					ref={headerRef}
					className={style["commit-headers"]}
					style={{ width: `${contentWidth}px` }}
				>
					{columns.map(
						(
							{
								prop,
								label,
								filterable,
								locatable,
								filterLogOption,
								hasDivider,
								size,
								dragBind,
							},
							index
						) => (
							<div
								key={prop}
								className={style["header-item"]}
								style={{
									width: `${size}px`,
								}}
							>
								{hasDivider && (
									<div
										{...dragBind(index)}
										className={style.divider}
									/>
								)}
								{prop === "graph" ? (
									<VSCodeButton
										className={style["ref-button"]}
										data-button
										appearance="icon"
										title={`Select Branch/Reference · ${
											options.ref || "All"
										}`}
										aria-label="All"
										onClick={() => onSelectReference()}
									>
										<span className="codicon codicon-git-branch" />
										<span className={style.text}>
											{options.ref || "All"}
										</span>
									</VSCodeButton>
								) : filterable || locatable ? (
									<VSCodeButton
										className={`${style["header-action"]}${
											filterable &&
											options[
												filterLogOption as
													| "authors"
													| "keyword"
											]?.length
												? ` ${style.active}`
												: ""
										}`}
										appearance="icon"
										title={label}
										onClick={() =>
											filterable
												? onFilter(prop)
												: onLocate(prop)
										}
									>
										<span className={style.text}>
											{label}
										</span>
									</VSCodeButton>
								) : (
									<span className={style["header-label"]}>
										{label}
									</span>
								)}
							</div>
						)
					)}
				</div>
			</div>
			<div className={style["commits-area"]}>
				<PickableList
					list={commits}
					keyLength={40}
					locationIndex={locationIndex}
					divergeIndex={divergeIndex}
					viewportRef={(el) => {
						if (el) {
							measureRef(el);
						}
					}}
					contentWidth={contentWidth}
					onHScroll={(scrollLeft) => {
						if (headerRef.current) {
							headerRef.current.style.transform = `translateX(${-scrollLeft}px)`;
						}
					}}
					itemPipe={parseCommit}
					itemRender={(commit: ICommit) => (
						<div className={style.commit}>
							{columns.map(({ prop, size, transformer }) => (
								<span
									style={{
										width: `${size}px`,
									}}
									data-prop={prop}
									key={prop}
								>
									{transformer(commit)}
								</span>
							))}
						</div>
					)}
					size={commitsCount}
					onPick={(ids) => diff(ids)}
				/>
			</div>
		</>
	);
};

const CommitsTable: FC = () => {
	return (
		<div className={style.container}>
			<CommitsTableInner />
		</div>
	);
};

export default CommitsTable;
