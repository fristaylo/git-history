import { execFile } from "child_process";
import { promisify } from "util";

import { injectable } from "inversify";
import {
	EventEmitter,
	TreeDataProvider,
	TreeItem,
	workspace,
} from "vscode";

import { GitService } from "../../git/service";
import { Repository } from "../../typings/scmExtension";

import { BranchItem, RepoItem } from "./items";
import { TagSyncStatus } from "./constants";

const execFileAsync = promisify(execFile);

function getGitPath(): string {
	return workspace.getConfiguration("git").get<string>("path") || "git";
}

interface TagSync {
	localCommits: Map<string, string>;
	remoteCommits: Map<string, string> | null;
}

/**
 * Tags panel — lists local tags alphabetically. A sync status badge (fetched in
 * the background after the view opens) shows whether each tag is published to
 * the remote, mirroring the Git Branches Sidebar extension.
 */
@injectable()
export class TagTreeDataProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly syncCache = new Map<Repository, TagSync>();
	private readonly fetching = new Set<Repository>();

	constructor(private git: GitService) {
		this.git.onDidChangeGitState(() => this.refresh());
	}

	refresh() {
		this.syncCache.clear();
		this._onDidChangeTreeData.fire();
		for (const repo of this.git.getGitRepositories()) {
			this.refreshTagSync(repo);
		}
	}

	getTreeItem(element: TreeItem) {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		const repos = this.git.getGitRepositories();

		if (!element) {
			if (repos.length === 0) {
				return [];
			}
			if (repos.length === 1) {
				return this.getTagsForRepo(repos[0]);
			}
			return repos.map((repo) => new RepoItem(repo));
		}

		if (element instanceof RepoItem) {
			return this.getTagsForRepo(element.repo);
		}

		return [];
	}

	private async getTagsForRepo(repo: Repository): Promise<TreeItem[]> {
		const refs = await repo.getRefs({ pattern: "refs/tags/*" });
		const sync = this.syncCache.get(repo);

		return refs
			.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
			.map((ref) => {
				let syncStatus: TagSyncStatus;
				if (sync) {
					const localCommit = sync.localCommits.get(ref.name ?? "");
					const remoteCommit = sync.remoteCommits?.get(ref.name ?? "");
					if (sync.remoteCommits === null) {
						syncStatus = undefined;
					} else if (remoteCommit === undefined) {
						syncStatus = "unpublished";
					} else if (localCommit === remoteCommit) {
						syncStatus = "synced";
					} else {
						syncStatus = "conflict";
					}
				}
				return new BranchItem(ref, repo, "tag", undefined, syncStatus);
			});
	}

	private async refreshTagSync(repo: Repository) {
		if (this.fetching.has(repo)) {
			return;
		}
		this.fetching.add(repo);

		// Never let git prompt for credentials — that would hang the fetch.
		const options = {
			cwd: repo.rootUri.fsPath,
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		};

		try {
			const localCommits = new Map<string, string>();
			try {
				const { stdout } = await execFileAsync(
					getGitPath(),
					[
						"for-each-ref",
						"--format=%(refname:short)|%(*objectname)|%(objectname)",
						"refs/tags/",
					],
					options
				);
				for (const line of stdout.trim().split("\n").filter(Boolean)) {
					const [name, peeled, obj] = line.split("|");
					localCommits.set(name, peeled || obj);
				}
			} catch {
				// no tags / not a repo — leave localCommits empty
			}

			let remoteCommits: Map<string, string> | null = null;
			const remoteName = repo.state.remotes[0]?.name;
			if (remoteName) {
				try {
					const { stdout } = await execFileAsync(
						getGitPath(),
						["ls-remote", "--tags", remoteName],
						options
					);
					remoteCommits = new Map<string, string>();
					for (const line of stdout
						.trim()
						.split("\n")
						.filter(Boolean)) {
						const [commit, ref] = line.split("\t");
						if (!ref) {
							continue;
						}
						if (ref.endsWith("^{}")) {
							remoteCommits.set(
								ref.slice("refs/tags/".length, -3),
								commit
							);
						} else {
							const name = ref.slice("refs/tags/".length);
							if (!remoteCommits.has(name)) {
								remoteCommits.set(name, commit);
							}
						}
					}
				} catch {
					// remote unreachable — leave remoteCommits null (no badges)
				}
			}

			this.syncCache.set(repo, { localCommits, remoteCommits });
			this._onDidChangeTreeData.fire();
		} finally {
			this.fetching.delete(repo);
		}
	}
}
