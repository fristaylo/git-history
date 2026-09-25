import { commands, window } from "vscode";

import { EXTENSION_SCHEME } from "../constants";
import { container } from "../container/inversify.config";
import { GitService } from "../git/service";
import { Source } from "../views/history/data/source";
import state from "../views/history/data/state";
import { BranchTreeDataProvider } from "../views/branches/branchTreeDataProvider";
import {
	HIDE_REPOSITORY_COMMAND,
	REFRESH_BRANCHES_COMMAND,
	SHOW_HIDDEN_REPOSITORY_COMMAND,
	SWITCH_TO_REF_COMMAND,
} from "../views/branches/constants";

interface RepoItemArg {
	repo: { rootUri: { fsPath: string; path: string } };
}

export function getBranchCommandsDisposable() {
	const source = container.get(Source);
	const branchProvider = container.get(BranchTreeDataProvider);

	return [
		// Scope the History view to the clicked branch / tag so only its
		// commits are shown (equivalent to `git log <ref>`).
		commands.registerCommand(
			SWITCH_TO_REF_COMMAND,
			async (ref?: string, repoPath?: string) => {
				state.followHead = false;
				state.logOptions = {
					repo: repoPath || state.logOptions.repo,
					ref: ref || "",
				};

				const switchSubscriber = source.getSwitchSubscriber();
				if (switchSubscriber) {
					source.getCommits(switchSubscriber, state.logOptions);
					return;
				}

				// The History view has not been opened yet. Reveal it — when its
				// webview mounts it reads state.logOptions (set above) and loads
				// this reference.
				await commands.executeCommand(
					`${EXTENSION_SCHEME}.history.focus`
				);
			}
		),
		commands.registerCommand(REFRESH_BRANCHES_COMMAND, () => {
			branchProvider.refresh();
		}),
		// Hide a repository from the Branches view. Invoked from the repo row
		// (item present) or the panel overflow menu (pick one).
		commands.registerCommand(
			HIDE_REPOSITORY_COMMAND,
			async (item?: RepoItemArg) => {
				if (item) {
					await branchProvider.hideRepo(item.repo.rootUri.fsPath);
					return;
				}

				const hidden = new Set(branchProvider.hiddenRepoPaths());
				const visible = container
					.get(GitService)
					.getGitRepositories()
					.filter((repo) => !hidden.has(repo.rootUri.fsPath));
				if (visible.length === 0) {
					return;
				}
				const picked = await window.showQuickPick(
					visible.map((repo) => ({
						label: repo.rootUri.path.split("/").pop() ?? "",
						description: repo.rootUri.fsPath,
						fsPath: repo.rootUri.fsPath,
					})),
					{ placeHolder: "Hide repository from Branches view" }
				);
				if (picked) {
					await branchProvider.hideRepo(picked.fsPath);
				}
			}
		),
		// Restore a previously hidden repository.
		commands.registerCommand(SHOW_HIDDEN_REPOSITORY_COMMAND, async () => {
			const hiddenPaths = branchProvider.hiddenRepoPaths();
			if (hiddenPaths.length === 0) {
				window.showInformationMessage("No hidden repositories.");
				return;
			}
			const picked = await window.showQuickPick(
				hiddenPaths.map((fsPath) => ({
					label: fsPath.split(/[\\/]/).pop() ?? fsPath,
					description: fsPath,
					fsPath,
				})),
				{ placeHolder: "Show hidden repository" }
			);
			if (picked) {
				await branchProvider.showRepo(picked.fsPath);
			}
		}),
	];
}
