import {
	ThemeColor,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
} from "vscode";

import { Branch, Ref, Repository } from "../../typings/scmExtension";

import { SWITCH_TO_REF_COMMAND, TagSyncStatus } from "./constants";

type BranchContextValue = "localBranch" | "remoteBranch" | "tag";

/**
 * A single branch / tag row. Clicking it switches the History view so that only
 * this reference's commits are shown. Icons mirror the Git Branches Sidebar
 * extension one-to-one.
 */
export class BranchItem extends TreeItem {
	constructor(
		public readonly ref: Ref,
		public readonly repo: Repository,
		itemContextValue: BranchContextValue,
		displayLabel?: string,
		tagSyncStatus?: TagSyncStatus
	) {
		const label = displayLabel ?? ref.name ?? "(unknown)";
		super(label, TreeItemCollapsibleState.None);

		this.tooltip = ref.commit
			? `${ref.name} @ ${ref.commit.substring(0, 8)}`
			: (ref.name ?? label);

		const isHead =
			itemContextValue === "localBranch" &&
			repo.state.HEAD?.name === ref.name;
		this.contextValue = isHead ? "localBranchCurrent" : itemContextValue;

		let syncDesc = "";
		if (itemContextValue === "localBranch") {
			const branch = ref as Branch;
			const ahead = branch.ahead ?? 0;
			const behind = branch.behind ?? 0;
			if (ahead > 0 && behind > 0) {
				syncDesc = `↑${ahead} ↓${behind}`;
			} else if (ahead > 0) {
				syncDesc = `↑${ahead}`;
			} else if (behind > 0) {
				syncDesc = `↓${behind}`;
			}
		}

		if (isHead) {
			this.iconPath = new ThemeIcon(
				"star-full",
				new ThemeColor("charts.yellow")
			);
			this.description = syncDesc ? `current ${syncDesc}` : "current";
		} else if (itemContextValue === "tag") {
			if (tagSyncStatus === "unpublished") {
				this.iconPath = new ThemeIcon(
					"tag",
					new ThemeColor("charts.yellow")
				);
				this.description = "↑ not pushed";
				this.tooltip = `${ref.name} — local only, not pushed to remote`;
			} else if (tagSyncStatus === "conflict") {
				this.iconPath = new ThemeIcon(
					"tag",
					new ThemeColor("errorForeground")
				);
				this.description = "⚠ conflict";
				this.tooltip = `${ref.name} — conflicts with remote (different commits)`;
			} else {
				this.iconPath = new ThemeIcon("tag");
			}
		} else {
			this.iconPath = new ThemeIcon("git-branch");
			if (syncDesc) {
				this.description = syncDesc;
			}
		}

		// Single click scopes the History view to this reference.
		if (ref.name) {
			this.command = {
				title: "Show History",
				command: SWITCH_TO_REF_COMMAND,
				arguments: [ref.name, repo.rootUri.fsPath],
			};
		}
	}
}

export class LocalGroupItem extends TreeItem {
	constructor(public readonly repo: Repository) {
		super("Local", TreeItemCollapsibleState.Expanded);
		this.contextValue = "localGroup";
		this.iconPath = new ThemeIcon("folder-opened");
	}
}

export class RemoteSectionItem extends TreeItem {
	constructor(public readonly repo: Repository) {
		super("Remote", TreeItemCollapsibleState.Expanded);
		this.contextValue = "remoteSection";
		this.iconPath = new ThemeIcon("folder-opened");
	}
}

export class RemoteGroupItem extends TreeItem {
	constructor(
		public readonly remoteName: string,
		public readonly repo: Repository
	) {
		super(remoteName, TreeItemCollapsibleState.Expanded);
		this.iconPath = new ThemeIcon("cloud");
		this.contextValue = "remoteGroup";
	}
}

export class RepoItem extends TreeItem {
	constructor(public readonly repo: Repository) {
		const name = repo.rootUri.path.split("/").pop() ?? repo.rootUri.path;
		super(name, TreeItemCollapsibleState.Expanded);
		this.iconPath = new ThemeIcon("repo");
		this.contextValue = "repository";
	}
}

export function isHeadRef(ref: Ref): boolean {
	const name = ref.name ?? "";
	return name === "HEAD" || name.endsWith("/HEAD");
}

export function shortName(ref: Ref, remoteName: string): string {
	const name = ref.name ?? "";
	return name.startsWith(remoteName + "/")
		? name.slice(remoteName.length + 1)
		: name;
}
