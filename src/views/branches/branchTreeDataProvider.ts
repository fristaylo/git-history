import { inject, injectable } from "inversify";
import {
	EventEmitter,
	ExtensionContext,
	TreeDataProvider,
	TreeItem,
} from "vscode";

import { GitService } from "../../git/service";
import { Branch, Ref, Repository } from "../../typings/scmExtension";

import {
	BranchItem,
	isHeadRef,
	LocalGroupItem,
	RemoteGroupItem,
	RemoteSectionItem,
	RepoItem,
	shortName,
} from "./items";

/**
 * Tree of local and remote branches, grouped by scope, mirroring the
 * "Branches" panel of the Git Branches Sidebar extension:
 *
 *   ▼ Local
 *       ★ main (current)  ↑2 ↓1
 *         feature/login   ↑3
 *   ▼ Remote
 *     ▼ origin
 *         main
 *
 * When multiple repositories are open they are grouped under repo nodes.
 */
@injectable()
export class BranchTreeDataProvider implements TreeDataProvider<TreeItem> {
	private readonly _onDidChangeTreeData = new EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private readonly remoteCache = new Map<Repository, Ref[]>();

	private static readonly HIDDEN_REPOS_KEY = "git-history.hiddenRepos";

	constructor(
		private git: GitService,
		@inject(Symbol.for("ExtensionContext"))
		private context: ExtensionContext
	) {
		this.git.onDidChangeGitState(() => this.refresh());
	}

	refresh() {
		this.remoteCache.clear();
		this._onDidChangeTreeData.fire();
	}

	private getHiddenRepoPaths(): Set<string> {
		return new Set(
			this.context.globalState.get<string[]>(
				BranchTreeDataProvider.HIDDEN_REPOS_KEY,
				[]
			)
		);
	}

	/** Repositories currently shown in the tree (not hidden by the user). */
	visibleRepos(): Repository[] {
		const hidden = this.getHiddenRepoPaths();
		return this.git
			.getGitRepositories()
			.filter((repo) => !hidden.has(repo.rootUri.fsPath));
	}

	hiddenRepoPaths(): string[] {
		return [...this.getHiddenRepoPaths()];
	}

	async hideRepo(fsPath: string) {
		const hidden = this.getHiddenRepoPaths();
		hidden.add(fsPath);
		await this.persistHiddenRepos(hidden);
	}

	async showRepo(fsPath: string) {
		const hidden = this.getHiddenRepoPaths();
		hidden.delete(fsPath);
		await this.persistHiddenRepos(hidden);
	}

	private async persistHiddenRepos(hidden: Set<string>) {
		await this.context.globalState.update(
			BranchTreeDataProvider.HIDDEN_REPOS_KEY,
			[...hidden]
		);
		this.refresh();
	}

	getTreeItem(element: TreeItem) {
		return element;
	}

	async getChildren(element?: TreeItem): Promise<TreeItem[]> {
		const repos = this.visibleRepos();

		if (!element) {
			if (repos.length === 0) {
				return [];
			}
			if (repos.length === 1) {
				return this.getRepoChildren(repos[0]);
			}
			return repos.map((repo) => new RepoItem(repo));
		}

		if (element instanceof RepoItem) {
			return this.getRepoChildren(element.repo);
		}
		if (element instanceof LocalGroupItem) {
			return this.getLocalBranches(element.repo);
		}
		if (element instanceof RemoteSectionItem) {
			return this.getRemoteGroups(element.repo);
		}
		if (element instanceof RemoteGroupItem) {
			return this.getRemoteBranches(element.repo, element.remoteName);
		}

		return [];
	}

	private getRepoChildren(repo: Repository): TreeItem[] {
		return [new LocalGroupItem(repo), new RemoteSectionItem(repo)];
	}

	private async getLocalBranches(repo: Repository): Promise<TreeItem[]> {
		const head = repo.state.HEAD;
		const headName = head?.name;
		const branches = await repo.getBranches({ remote: false });

		return branches
			.sort((a, b) => {
				if (a.name === headName) {
					return -1;
				}
				if (b.name === headName) {
					return 1;
				}
				return (a.name ?? "").localeCompare(b.name ?? "");
			})
			.map((ref) => {
				// The current branch carries live ahead/behind counts on
				// repo.state.HEAD (the same source as the status bar).
				if (ref.name === headName && head) {
					const enriched: Branch = {
						...ref,
						ahead: head.ahead,
						behind: head.behind,
					};
					return new BranchItem(enriched, repo, "localBranch");
				}
				return new BranchItem(ref, repo, "localBranch");
			});
	}

	private async getRemoteGroups(repo: Repository): Promise<TreeItem[]> {
		const branches = await repo.getBranches({ remote: true });
		const knownRemotes = repo.state.remotes.map((remote) => remote.name);

		const filtered = branches.filter((branch) => {
			if (isHeadRef(branch)) {
				return false;
			}
			if (branch.remote) {
				return true;
			}
			return knownRemotes.some((remote) =>
				(branch.name ?? "").startsWith(remote + "/")
			);
		});
		this.remoteCache.set(repo, filtered);

		const seen = new Set<string>();
		for (const branch of filtered) {
			const remote =
				branch.remote ??
				knownRemotes.find((remote) =>
					(branch.name ?? "").startsWith(remote + "/")
				);
			if (remote) {
				seen.add(remote);
			}
		}

		return knownRemotes
			.filter((remote) => seen.has(remote))
			.map((name) => new RemoteGroupItem(name, repo));
	}

	private async getRemoteBranches(
		repo: Repository,
		remoteName: string
	): Promise<TreeItem[]> {
		const cached =
			this.remoteCache.get(repo) ??
			(await repo.getBranches({ remote: true })).filter(
				(branch) => !isHeadRef(branch)
			);

		return cached
			.filter((branch) => {
				if (branch.remote) {
					return branch.remote === remoteName;
				}
				return (branch.name ?? "").startsWith(remoteName + "/");
			})
			.sort((a, b) =>
				shortName(a, remoteName).localeCompare(shortName(b, remoteName))
			)
			.map(
				(branch) =>
					new BranchItem(
						branch,
						repo,
						"remoteBranch",
						shortName(branch, remoteName)
					)
			);
	}
}
