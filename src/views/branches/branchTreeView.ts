import { TreeView, window } from "vscode";
import { injectable } from "inversify";

import { EXTENSION_SCHEME } from "../../constants";

import { BranchTreeDataProvider } from "./branchTreeDataProvider";

@injectable()
export class BranchTreeView {
	private readonly branchesViewer: TreeView<any>;

	constructor(private branchTreeDataProvider: BranchTreeDataProvider) {
		this.branchesViewer = window.createTreeView(
			`${EXTENSION_SCHEME}.branches`,
			{
				treeDataProvider: this.branchTreeDataProvider,
			}
		);
	}

	// NOTE: The Tags view (TagTreeDataProvider) is intentionally not created
	// for now — see git-history.tags being omitted from package.json. Restore
	// the createTreeView(`${EXTENSION_SCHEME}.tags`, ...) call to bring it back.
}
