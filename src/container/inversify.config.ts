import "reflect-metadata";
import { ExtensionContext } from "vscode";
import { Container } from "inversify";

import { GitService } from "../git/service";
import { GitGraph } from "../git/graph";
import { ChangeTreeDataProvider } from "../views/changes/changeTreeDataProvider";
import { Source } from "../views/history/data/source";
import { DisposableController } from "../disposables";
import { GitStatusFileDecorationProvider } from "../views/changes/gitStatusFileDecorationProvider";
import { HistoryWebviewViewProvider } from "../views/history/historyViewProvider";

import { ChangeTreeView } from "../views/changes/changeTreeView";
import { BranchTreeDataProvider } from "../views/branches/branchTreeDataProvider";
import { TagTreeDataProvider } from "../views/branches/tagTreeDataProvider";
import { BranchTreeView } from "../views/branches/branchTreeView";

const container = new Container();

function initializeContainer(context: ExtensionContext) {
	container
		.bind<ExtensionContext>(Symbol.for("ExtensionContext"))
		.toConstantValue(context);

	container.bind<Source>(Source).toSelf().inSingletonScope();
	container.bind<GitService>(GitService).toSelf().inSingletonScope();
	container.bind<GitGraph>(GitGraph).toSelf().inSingletonScope();
	container
		.bind<HistoryWebviewViewProvider>(HistoryWebviewViewProvider)
		.toSelf()
		.inSingletonScope();
	container
		.bind<ChangeTreeDataProvider>(ChangeTreeDataProvider)
		.toSelf()
		.inSingletonScope();
	container.bind<ChangeTreeView>(ChangeTreeView).toSelf().inSingletonScope();
	container
		.bind<BranchTreeDataProvider>(BranchTreeDataProvider)
		.toSelf()
		.inSingletonScope();
	container
		.bind<TagTreeDataProvider>(TagTreeDataProvider)
		.toSelf()
		.inSingletonScope();
	container.bind<BranchTreeView>(BranchTreeView).toSelf().inSingletonScope();
	container
		.bind<GitStatusFileDecorationProvider>(GitStatusFileDecorationProvider)
		.toSelf()
		.inSingletonScope();
	container
		.bind<DisposableController>(DisposableController)
		.toSelf()
		.inSingletonScope();
}

export { container, initializeContainer };
