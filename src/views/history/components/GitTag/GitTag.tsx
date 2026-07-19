import type { FC } from "react";

import style from "./GitTag.module.scss";

interface Props {
	refName: string;
	color: string;
}

const TAG_PREFIX = "tag: ";
const HEAD_PREFIX = "HEAD -> ";

const GitTag: FC<Props> = ({ refName, color }) => {
	if (refName === "HEAD" || refName.endsWith("/HEAD")) {
		return null;
	}

	const isTag = refName.startsWith(TAG_PREFIX);
	const isCurrent = refName.startsWith(HEAD_PREFIX);
	const isRemote = !isTag && !isCurrent && refName.includes("/");

	let label = refName;
	if (isTag) {
		label = refName.slice(TAG_PREFIX.length);
	} else if (isCurrent) {
		label = refName.slice(HEAD_PREFIX.length);
	}

	let icon = "git-branch";
	if (isTag) {
		icon = "tag";
	} else if (isCurrent || isRemote) {
		icon = "star-full";
	}

	const iconColor = isCurrent
		? "var(--vscode-charts-yellow)"
		: isRemote
			? "#fff"
			: undefined;

	return (
		<div
			className={style["tag-container"]}
			style={{
				backgroundColor: `${color}70`,
			}}
		>
			<span
				className={`codicon codicon-${icon} ${style.icon}`}
				style={iconColor ? { color: iconColor } : undefined}
			/>
			{label}
		</div>
	);
};

export default GitTag;
