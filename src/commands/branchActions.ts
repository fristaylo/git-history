import { execFile } from "child_process";
import { promisify } from "util";

import {
	commands,
	ProgressLocation,
	Uri,
	window,
	workspace,
} from "vscode";

import { container } from "../container/inversify.config";
import { GitService } from "../git/service";
import { Ref, Repository } from "../typings/scmExtension";
import { BranchTreeDataProvider } from "../views/branches/branchTreeDataProvider";
import { SWITCH_TO_REF_COMMAND } from "../views/branches/constants";

const execFileAsync = promisify(execFile);

const NS = "git-history.branches";

export const BRANCH_ACTION_COMMANDS = {
	OPEN_HISTORY: `${NS}.openHistory`,
	UPDATE: `${NS}.update`,
	CHECKOUT: `${NS}.checkout`,
	MERGE: `${NS}.merge`,
	REBASE: `${NS}.rebase`,
	CHECKOUT_AND_REBASE: `${NS}.checkoutAndRebase`,
	CHERRY_PICK: `${NS}.cherryPick`,
	RENAME: `${NS}.rename`,
	PUSH: `${NS}.push`,
	SET_UPSTREAM: `${NS}.setUpstream`,
	CREATE_FROM: `${NS}.createFrom`,
	DELETE_LOCAL: `${NS}.deleteLocal`,
	COMPARE_WITH_CURRENT: `${NS}.compareWithCurrent`,
	CHECKOUT_REMOTE: `${NS}.checkoutRemote`,
	PULL: `${NS}.pull`,
	PULL_INTO_CURRENT: `${NS}.pullIntoCurrent`,
	DELETE_REMOTE: `${NS}.deleteRemote`,
	CREATE_BRANCH: `${NS}.createBranch`,
	FETCH_ALL: `${NS}.fetchAll`,
	STASH: `${NS}.stash`,
	STASH_POP: `${NS}.stashPop`,
	STASH_APPLY: `${NS}.stashApply`,
	STASH_DROP: `${NS}.stashDrop`,
} as const;

/** Tree item shape the context-menu commands receive. */
interface RefItem {
	ref: Ref;
	repo: Repository;
}

interface GroupItem {
	repo: Repository;
}

function gitService() {
	return container.get(GitService);
}

function getGitPath(): string {
	return workspace.getConfiguration("git").get<string>("path") || "git";
}

function refreshViews() {
	container.get(BranchTreeDataProvider).refresh();
}

async function runGit(repo: Repository, args: string[]) {
	const result = await execFileAsync(getGitPath(), args, {
		cwd: repo.rootUri.fsPath,
	});
	await commands.executeCommand("git.refresh");
	return result;
}

function parseRemoteBranch(
	repo: Repository,
	ref: Ref
): { remote: string; branch: string } {
	const fullName = ref.name ?? "";
	if (ref.remote) {
		const branch = fullName.startsWith(ref.remote + "/")
			? fullName.slice(ref.remote.length + 1)
			: fullName;
		return { remote: ref.remote, branch };
	}
	const remotes = [...repo.state.remotes].sort(
		(a, b) => b.name.length - a.name.length
	);
	for (const remote of remotes) {
		if (fullName.startsWith(remote.name + "/")) {
			return {
				remote: remote.name,
				branch: fullName.slice(remote.name.length + 1),
			};
		}
	}
	const idx = fullName.indexOf("/");
	if (idx !== -1) {
		return { remote: fullName.slice(0, idx), branch: fullName.slice(idx + 1) };
	}
	const firstRemote = repo.state.remotes[0]?.name ?? "origin";
	return { remote: firstRemote, branch: fullName };
}

async function pickRepo(repos: Repository[]): Promise<Repository | undefined> {
	if (repos.length <= 1) {
		return repos[0];
	}
	const picked = await window.showQuickPick(
		repos.map((repo) => ({
			label: repo.rootUri.path.split("/").pop() ?? "",
			repo,
		})),
		{ placeHolder: "Select repository" }
	);
	return picked?.repo;
}

async function confirm(message: string, confirmLabel: string) {
	const result = await window.showWarningMessage(
		message,
		{ modal: true },
		confirmLabel
	);
	return result === confirmLabel;
}

function errorText(e: unknown): string {
	const err = e as { stderr?: string; message?: string };
	return String(err?.stderr ?? err?.message ?? e).trim();
}

async function withProgress<T>(
	title: string,
	fn: () => Promise<T>
): Promise<T | undefined> {
	return window.withProgress(
		{ location: ProgressLocation.Notification, title },
		async () => {
			try {
				const result = await fn();
				refreshViews();
				return result;
			} catch (e) {
				window.showErrorMessage(errorText(e));
				return undefined;
			}
		}
	);
}

async function getStashList(repo: Repository) {
	const { stdout } = await execFileAsync(
		getGitPath(),
		["stash", "list", "--format=%gd: %s"],
		{ cwd: repo.rootUri.fsPath }
	);
	return stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line, i) => ({ label: line, index: i }));
}

export function getBranchActionCommandsDisposable() {
	const C = BRANCH_ACTION_COMMANDS;

	const reg = (id: string, fn: (...args: any[]) => any) =>
		commands.registerCommand(id, fn);

	return [
		// View History — scope the History view to this reference.
		reg(C.OPEN_HISTORY, (item?: RefItem) => {
			if (!item) {
				return;
			}
			return commands.executeCommand(
				SWITCH_TO_REF_COMMAND,
				item.ref.name,
				item.repo.rootUri.fsPath
			);
		}),

		reg(C.UPDATE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const isCurrent = item.repo.state.HEAD?.name === item.ref.name;
			if (isCurrent) {
				if (!item.repo.state.HEAD?.upstream) {
					window.showErrorMessage(
						`"${item.ref.name}" has no upstream configured. Use Set Upstream first.`
					);
					return;
				}
				await withProgress(`Updating ${item.ref.name}...`, () =>
					item.repo.pull()
				);
				return;
			}
			let upstreamRef: string;
			try {
				const { stdout } = await execFileAsync(
					getGitPath(),
					[
						"rev-parse",
						"--abbrev-ref",
						`${item.ref.name}@{upstream}`,
					],
					{ cwd: item.repo.rootUri.fsPath }
				);
				upstreamRef = stdout.trim();
			} catch {
				window.showErrorMessage(
					`"${item.ref.name}" has no upstream configured. Use Set Upstream first.`
				);
				return;
			}
			const slashIdx = upstreamRef.indexOf("/");
			const remote = upstreamRef.slice(0, slashIdx);
			const remoteBranch = upstreamRef.slice(slashIdx + 1);
			await withProgress(`Updating ${item.ref.name}...`, () =>
				runGit(item.repo, [
					"fetch",
					remote,
					`${remoteBranch}:${item.ref.name}`,
				])
			);
		}),

		reg(C.CHECKOUT, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			await withProgress(`Checking out ${item.ref.name}...`, () =>
				item.repo.checkout(item.ref.name!)
			);
		}),

		reg(C.MERGE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const strategies = [
				{
					label: "Merge",
					description: "Create a merge commit",
					value: "merge",
				},
				{
					label: "Squash and Merge",
					description: "Squash all commits into one staged change",
					value: "squash",
				},
				{
					label: "No Fast-Forward",
					description: "Always create a merge commit (--no-ff)",
					value: "no-ff",
				},
			];
			const strategy = await window.showQuickPick(strategies, {
				placeHolder: `Merge "${item.ref.name}" into current branch — select strategy`,
			});
			if (!strategy) {
				return;
			}
			const ok = await confirm(
				`${strategy.label} "${item.ref.name}" into current branch?`,
				strategy.label
			);
			if (!ok) {
				return;
			}
			await withProgress(`Merging ${item.ref.name}...`, async () => {
				if (strategy.value === "squash") {
					await runGit(item.repo, ["merge", "--squash", item.ref.name!]);
					window.showInformationMessage(
						`"${item.ref.name}" squashed and staged. Commit to complete the merge.`
					);
				} else if (strategy.value === "no-ff") {
					await runGit(item.repo, [
						"merge",
						"--no-ff",
						"--no-edit",
						item.ref.name!,
					]);
				} else {
					await item.repo.merge(item.ref.name!);
				}
			});
		}),

		reg(C.REBASE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const ok = await confirm(
				`Rebase current branch onto "${item.ref.name}"? This rewrites history.`,
				"Rebase"
			);
			if (!ok) {
				return;
			}
			await withProgress(`Rebasing onto ${item.ref.name}...`, () =>
				runGit(item.repo, ["rebase", item.ref.name!])
			);
		}),

		reg(C.CHECKOUT_AND_REBASE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const currentBranch = item.repo.state.HEAD?.name;
			if (!currentBranch) {
				window.showErrorMessage("No current branch.");
				return;
			}
			const ok = await confirm(
				`Checkout "${item.ref.name}" and rebase it onto "${currentBranch}"? This rewrites history.`,
				"Checkout and Rebase"
			);
			if (!ok) {
				return;
			}
			await withProgress(
				`Rebasing ${item.ref.name} onto ${currentBranch}...`,
				async () => {
					await item.repo.checkout(item.ref.name!);
					try {
						await runGit(item.repo, ["rebase", currentBranch]);
					} catch (e) {
						const msg = errorText(e);
						if (/conflict/i.test(msg)) {
							window.showWarningMessage(
								'Rebase has conflicts. Resolve them, then run "git rebase --continue". To cancel: "git rebase --abort".'
							);
						} else {
							throw e;
						}
					}
				}
			);
		}),

		reg(C.CHERRY_PICK, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const commit = item.ref.commit;
			if (!commit) {
				window.showErrorMessage("No commit hash available for this ref.");
				return;
			}
			const label = item.ref.name ?? commit.substring(0, 8);
			const ok = await confirm(
				`Cherry-pick tip commit of "${label}" (${commit.substring(
					0,
					8
				)}) into current branch?`,
				"Cherry-pick"
			);
			if (!ok) {
				return;
			}
			await withProgress(
				`Cherry-picking ${commit.substring(0, 8)}...`,
				() => runGit(item.repo, ["cherry-pick", commit])
			);
		}),

		reg(C.RENAME, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const newName = await window.showInputBox({
				prompt: "New branch name",
				value: item.ref.name,
				validateInput: (v) =>
					v.trim() ? undefined : "Branch name cannot be empty",
			});
			if (!newName || newName === item.ref.name) {
				return;
			}
			await withProgress(`Renaming branch...`, () =>
				runGit(item.repo, [
					"branch",
					"-m",
					item.ref.name!,
					newName.trim(),
				])
			);
		}),

		reg(C.PUSH, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			let remoteName = item.ref.remote;
			if (!remoteName) {
				const remotes = item.repo.state.remotes;
				if (remotes.length === 0) {
					window.showErrorMessage("No remotes configured.");
					return;
				}
				if (remotes.length === 1) {
					remoteName = remotes[0].name;
				} else {
					const picked = await window.showQuickPick(
						remotes.map((r) => ({
							label: r.name,
							description: r.pushUrl ?? r.fetchUrl,
						})),
						{ placeHolder: "Select remote to push to" }
					);
					if (!picked) {
						return;
					}
					remoteName = picked.label;
				}
			}
			await withProgress(
				`Pushing ${item.ref.name} to ${remoteName}...`,
				() => item.repo.push(remoteName, item.ref.name, true)
			);
		}),

		reg(C.SET_UPSTREAM, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const remotes = item.repo.state.remotes;
			if (remotes.length === 0) {
				window.showErrorMessage("No remotes configured.");
				return;
			}
			const pickedRemote = await window.showQuickPick(
				remotes.map((r) => ({ label: r.name, description: r.fetchUrl })),
				{ placeHolder: "Select remote to track" }
			);
			if (!pickedRemote) {
				return;
			}
			const remoteBranchName = await window.showInputBox({
				prompt: `Remote branch name on "${pickedRemote.label}"`,
				value: item.ref.name,
				validateInput: (v) =>
					v.trim() ? undefined : "Branch name cannot be empty",
			});
			if (!remoteBranchName) {
				return;
			}
			const upstream = `${pickedRemote.label}/${remoteBranchName.trim()}`;
			await withProgress(`Setting upstream to ${upstream}...`, () =>
				runGit(item.repo, [
					"branch",
					`--set-upstream-to=${upstream}`,
					item.ref.name!,
				])
			);
		}),

		reg(C.CREATE_FROM, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const newName = await window.showInputBox({
				prompt: `New branch name (from ${item.ref.name})`,
				validateInput: (v) =>
					v.trim() ? undefined : "Branch name cannot be empty",
			});
			if (!newName) {
				return;
			}
			await withProgress(`Creating branch ${newName}...`, () =>
				item.repo.createBranch(newName.trim(), true, item.ref.name)
			);
		}),

		reg(C.DELETE_LOCAL, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const ok = await confirm(
				`Delete local branch "${item.ref.name}"?`,
				"Delete"
			);
			if (!ok) {
				return;
			}
			let notFullyMerged = false;
			await window.withProgress(
				{
					location: ProgressLocation.Notification,
					title: `Deleting branch ${item.ref.name}...`,
				},
				async () => {
					try {
						await item.repo.deleteBranch(item.ref.name!, false);
						refreshViews();
					} catch (e) {
						const msg = errorText(e);
						if (msg.includes("not fully merged")) {
							notFullyMerged = true;
						} else {
							window.showErrorMessage(msg);
						}
					}
				}
			);
			if (notFullyMerged) {
				const force = await confirm(
					`"${item.ref.name}" is not fully merged. Force delete?`,
					"Force Delete"
				);
				if (!force) {
					return;
				}
				await withProgress(
					`Force deleting branch ${item.ref.name}...`,
					() => item.repo.deleteBranch(item.ref.name!, true)
				);
			}
		}),

		reg(C.COMPARE_WITH_CURRENT, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const head = item.repo.state.HEAD?.name;
			if (!head) {
				window.showErrorMessage("No current branch.");
				return;
			}
			let diffLines: string[];
			try {
				const { stdout } = await execFileAsync(
					getGitPath(),
					["diff", `${head}...${item.ref.name}`, "--name-status"],
					{ cwd: item.repo.rootUri.fsPath }
				);
				diffLines = stdout.trim().split("\n").filter(Boolean);
			} catch (e) {
				window.showErrorMessage(errorText(e));
				return;
			}
			if (diffLines.length === 0) {
				window.showInformationMessage(
					`No differences between "${head}" and "${item.ref.name}".`
				);
				return;
			}
			const statusLabels: Record<string, string> = {
				A: "Added",
				M: "Modified",
				D: "Deleted",
				R: "Renamed",
				C: "Copied",
			};
			const entries = diffLines.map((line) => {
				const parts = line.split("\t");
				const statusCode = parts[0][0];
				const isRenameOrCopy = statusCode === "R" || statusCode === "C";
				const rightPath = isRenameOrCopy ? parts[2] : parts[1];
				return {
					label: rightPath,
					description: statusLabels[statusCode] ?? parts[0],
					filePath: rightPath,
					leftRef: statusCode === "A" ? "" : head,
					rightRef: statusCode === "D" ? "" : item.ref.name!,
				};
			});
			const picked = await window.showQuickPick(entries, {
				placeHolder: `${entries.length} file(s) changed  ·  ${head}  ↔  ${item.ref.name}`,
				matchOnDescription: true,
			});
			if (!picked) {
				return;
			}
			const absUri = Uri.joinPath(item.repo.rootUri, picked.filePath);
			const emptyUri = absUri.with({
				scheme: "git",
				query: JSON.stringify({ path: absUri.fsPath, ref: "~" }),
			});
			const leftUri = picked.leftRef
				? gitService().toGitUri(absUri, picked.leftRef)!
				: emptyUri;
			const rightUri = picked.rightRef
				? gitService().toGitUri(absUri, picked.rightRef)!
				: emptyUri;
			await commands.executeCommand(
				"vscode.diff",
				leftUri,
				rightUri,
				`${picked.filePath}  (${head} ↔ ${item.ref.name})`
			);
		}),

		reg(C.CHECKOUT_REMOTE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const { remote, branch } = parseRemoteBranch(item.repo, item.ref);
			const localName = await window.showInputBox({
				prompt: "Local branch name",
				value: branch,
				validateInput: (v) =>
					v.trim() ? undefined : "Branch name cannot be empty",
			});
			if (!localName) {
				return;
			}
			await withProgress(`Checking out ${item.ref.name}...`, () =>
				runGit(item.repo, [
					"checkout",
					"-b",
					localName.trim(),
					`${remote}/${branch}`,
				])
			);
		}),

		reg(C.PULL, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const { remote, branch } = parseRemoteBranch(item.repo, item.ref);
			await withProgress(`Fetching ${branch} from ${remote}...`, () =>
				item.repo.fetch(remote, branch)
			);
		}),

		reg(C.PULL_INTO_CURRENT, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const { remote, branch } = parseRemoteBranch(item.repo, item.ref);
			const currentBranch = item.repo.state.HEAD?.name;
			if (!currentBranch) {
				window.showErrorMessage("No current branch.");
				return;
			}
			const strategies = [
				{
					label: "Merge",
					description: `Fetch and merge ${remote}/${branch} into ${currentBranch}`,
					value: "merge",
				},
				{
					label: "Rebase",
					description: `Fetch then rebase ${currentBranch} onto ${remote}/${branch}`,
					value: "rebase",
				},
			];
			const strategy = await window.showQuickPick(strategies, {
				placeHolder: `Pull ${remote}/${branch} into "${currentBranch}"`,
			});
			if (!strategy) {
				return;
			}
			await withProgress(
				`Pulling ${branch} into ${currentBranch}...`,
				async () => {
					await runGit(item.repo, ["fetch", remote, branch]);
					if (strategy.value === "merge") {
						await item.repo.merge(`${remote}/${branch}`);
					} else {
						try {
							await runGit(item.repo, [
								"rebase",
								`${remote}/${branch}`,
							]);
						} catch (e) {
							const msg = errorText(e);
							if (/conflict/i.test(msg)) {
								window.showWarningMessage(
									'Rebase has conflicts. Resolve them, then run "git rebase --continue". To cancel: "git rebase --abort".'
								);
							} else {
								throw e;
							}
						}
					}
				}
			);
		}),

		reg(C.DELETE_REMOTE, async (item?: RefItem) => {
			if (!item) {
				return;
			}
			const { remote, branch } = parseRemoteBranch(item.repo, item.ref);
			const ok = await confirm(
				`Delete remote branch "${branch}" on "${remote}"?`,
				"Delete"
			);
			if (!ok) {
				return;
			}
			let alreadyGone = false;
			await window.withProgress(
				{
					location: ProgressLocation.Notification,
					title: `Deleting remote branch ${branch}...`,
				},
				async () => {
					try {
						await runGit(item.repo, [
							"push",
							remote,
							"--delete",
							branch,
						]);
						refreshViews();
					} catch (e) {
						const msg = errorText(e);
						if (msg.includes("remote ref does not exist")) {
							alreadyGone = true;
						} else {
							window.showErrorMessage(msg);
						}
					}
				}
			);
			if (alreadyGone) {
				const action = await window.showWarningMessage(
					`"${branch}" no longer exists on "${remote}". Prune stale local tracking ref?`,
					"Prune",
					"Cancel"
				);
				if (action === "Prune") {
					await withProgress(`Pruning ${remote}...`, () =>
						runGit(item.repo, ["fetch", remote, "--prune"])
					);
				}
			}
		}),

		reg(C.CREATE_BRANCH, async (item?: GroupItem) => {
			const repo =
				item?.repo ??
				(await pickRepo(gitService().getGitRepositories()));
			if (!repo) {
				return;
			}
			const name = await window.showInputBox({
				prompt: "New branch name (from current HEAD)",
				validateInput: (v) =>
					v.trim() ? undefined : "Branch name cannot be empty",
			});
			if (!name) {
				return;
			}
			await withProgress(`Creating branch ${name}...`, () =>
				repo.createBranch(name.trim(), true)
			);
		}),

		reg(C.FETCH_ALL, async () => {
			const repos = gitService().getGitRepositories();
			await withProgress("Fetching all remotes...", async () => {
				const results = await Promise.allSettled(
					repos.map((r) => r.fetch())
				);
				results.forEach((r, i) => {
					if (r.status === "rejected") {
						const name =
							repos[i].rootUri.path.split("/").pop() ?? "unknown";
						window.showErrorMessage(
							`Fetch failed (${name}): ${errorText(r.reason)}`
						);
					}
				});
			});
		}),

		reg(C.STASH, async (item?: GroupItem) => {
			const repo =
				item?.repo ??
				(await pickRepo(gitService().getGitRepositories()));
			if (!repo) {
				return;
			}
			const message = await window.showInputBox({
				prompt: "Stash message (leave empty for default)",
			});
			if (message === undefined) {
				return;
			}
			const args = message.trim()
				? ["stash", "push", "--include-untracked", "-m", message.trim()]
				: ["stash", "push", "--include-untracked"];
			await withProgress("Stashing changes...", () => runGit(repo, args));
		}),

		reg(C.STASH_POP, async (item?: GroupItem) => {
			const repo =
				item?.repo ??
				(await pickRepo(gitService().getGitRepositories()));
			if (!repo) {
				return;
			}
			await withProgress("Popping latest stash...", async () => {
				try {
					await runGit(repo, ["stash", "pop"]);
				} catch (e) {
					const msg = errorText(e);
					if (/conflict/i.test(msg)) {
						window.showWarningMessage(
							"Stash applied with conflicts. Resolve conflicts before continuing."
						);
					} else {
						throw e;
					}
				}
			});
		}),

		reg(C.STASH_APPLY, async (item?: GroupItem) => {
			const repo =
				item?.repo ??
				(await pickRepo(gitService().getGitRepositories()));
			if (!repo) {
				return;
			}
			let stashes: { label: string; index: number }[];
			try {
				stashes = await getStashList(repo);
			} catch (e) {
				window.showErrorMessage(errorText(e));
				return;
			}
			if (stashes.length === 0) {
				window.showInformationMessage("No stashes found.");
				return;
			}
			const picked = await window.showQuickPick(
				stashes.map((s) => s.label),
				{ placeHolder: "Select stash to apply" }
			);
			if (!picked) {
				return;
			}
			const idx = stashes.find((s) => s.label === picked)?.index ?? 0;
			await withProgress(`Applying stash@{${idx}}...`, async () => {
				try {
					await runGit(repo, ["stash", "apply", `stash@{${idx}}`]);
				} catch (e) {
					const msg = errorText(e);
					if (/conflict/i.test(msg)) {
						window.showWarningMessage(
							"Stash applied with conflicts. Resolve conflicts before continuing."
						);
					} else {
						throw e;
					}
				}
			});
		}),

		reg(C.STASH_DROP, async (item?: GroupItem) => {
			const repo =
				item?.repo ??
				(await pickRepo(gitService().getGitRepositories()));
			if (!repo) {
				return;
			}
			let stashes: { label: string; index: number }[];
			try {
				stashes = await getStashList(repo);
			} catch (e) {
				window.showErrorMessage(errorText(e));
				return;
			}
			if (stashes.length === 0) {
				window.showInformationMessage("No stashes found.");
				return;
			}
			const picked = await window.showQuickPick(
				stashes.map((s) => s.label),
				{ placeHolder: "Select stash to drop" }
			);
			if (!picked) {
				return;
			}
			const idx = stashes.find((s) => s.label === picked)?.index ?? 0;
			const ok = await confirm(`Drop stash@{${idx}}?`, "Drop");
			if (!ok) {
				return;
			}
			await withProgress(`Dropping stash@{${idx}}...`, () =>
				runGit(repo, ["stash", "drop", `stash@{${idx}}`])
			);
		}),
	];
}
