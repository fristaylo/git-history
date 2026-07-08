import {
	TreeDataProvider,
	TreeItem,
	ThemeIcon,
	ExtensionContext,
	TreeItemCollapsibleState,
	Uri,
	EventEmitter,
	Command,
} from "vscode";
import { inject, injectable } from "inversify";

import { compareFileTreeNode, rebuildUri } from "../../git/utils";
import { EXTENSION_SCHEME } from "../../constants";
import { OPEN_CHANGE_COMMAND } from "../../commands/openChange";
import {
	FileNode,
	FolderNode,
	PathCollection,
	PathType,
} from "../../git/changes/tree";

@injectable()
export class ChangeTreeDataProvider implements TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(
		@inject(Symbol.for("ExtensionContext")) private context: ExtensionContext
	) {}

	getTreeItem(element: Path) {
		return element;
	}

	getChildren(element?: Path) {
		return Promise.resolve(
			Object.entries(
				element
					? (element.children as PathCollection)!
					: rebuildUri(
							this.context.globalState.get<PathCollection>(
								"changedFileTree"
							)
						)!
			)
				.sort(compareFileTreeNode)
				.map(([name, props]) => new Path(name, props))
		);
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}
}

class Path extends TreeItem {
	children?: PathCollection = (this.props as FolderNode).children;
	iconPath = ThemeIcon[this.props.type];
	resourceUri = this.getResourceUri();
	collapsibleState = this.getCollapsibleState();
	readonly command?: Command = this.getCommand();

	constructor(
		public label: string,
		public props: FolderNode | FileNode
	) {
		super(label);
	}

	private getResourceUri() {
		if (this.props.type === PathType.FILE) {
			const { uri } = this.props;
			return uri.with({
				scheme: EXTENSION_SCHEME,
				query: JSON.stringify({ status: this.props.status }),
			});
		}

		if (this.props.type === PathType.FOLDER) {
			return Uri.file(this.label);
		}
	}

	private getCollapsibleState() {
		const { type } = this.props;
		const STATE_MAP = {
			[PathType.FOLDER]: TreeItemCollapsibleState.Expanded,
			[PathType.FILE]: TreeItemCollapsibleState.None,
		};

		return STATE_MAP[type];
	}

	private getCommand() {
		if (this.props.type === PathType.FILE) {
			// Single click opens the change (diff); a double click on the same
			// file opens the actual file in the workspace. Both are handled by
			// OPEN_CHANGE_COMMAND, which distinguishes them by click timing.
			return {
				title: "Open Change",
				command: OPEN_CHANGE_COMMAND,
				arguments: [this.props],
			};
		}
	}
}
