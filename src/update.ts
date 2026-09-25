import { commands, ExtensionContext, ExtensionMode, Uri, window, workspace } from "vscode";

const LATEST = "https://api.github.com/repos/fristaylo/git-history/releases/latest";

// ponytail: every open window checks on its own; add a globalState throttle if that gets noisy
export async function checkForUpdate(context: ExtensionContext) {
	if (context.extensionMode !== ExtensionMode.Production) return;
	const res = await fetch(LATEST);
	if (!res.ok) return;
	const rel = (await res.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
	const latest = rel.tag_name.replace(/^v/, "");
	if (latest.localeCompare(context.extension.packageJSON.version, undefined, { numeric: true }) <= 0) return;
	const asset = rel.assets.find((a) => a.name.endsWith(".vsix"));
	if (!asset) return;

	const vsix = Uri.joinPath(context.globalStorageUri, asset.name);
	await workspace.fs.createDirectory(context.globalStorageUri);
	await workspace.fs.writeFile(vsix, new Uint8Array(await (await fetch(asset.browser_download_url)).arrayBuffer()));
	await commands.executeCommand("workbench.extensions.installExtension", vsix);
	const pick = await window.showInformationMessage(`Yummy GitHistory updated to ${latest}.`, "Reload Window");
	if (pick) commands.executeCommand("workbench.action.reloadWindow");
}
