import { commands, window } from "vscode";

import { container } from "../container/inversify.config";
import { Source } from "../views/history/data/source";

export const TOGGLE_COLUMNS_COMMAND = "git-history.history.toggleColumns";

/** Columns that can be shown / hidden from the "Toggle Columns" picker. */
export const COLUMN_DEFS: { prop: string; label: string }[] = [
	{ prop: "graph", label: "Graph" },
	{ prop: "description", label: "Description" },
	{ prop: "hash", label: "Hash" },
	{ prop: "author", label: "Author" },
	{ prop: "date", label: "Date/Time" },
];

export function getColumnCommandsDisposable() {
	const source = container.get(Source);

	return [
		commands.registerCommand(TOGGLE_COLUMNS_COMMAND, async () => {
			const hidden = new Set(source.getHiddenColumns());

			const picked = await window.showQuickPick(
				COLUMN_DEFS.map((def) => ({
					label: def.label,
					prop: def.prop,
					picked: !hidden.has(def.prop),
				})),
				{
					canPickMany: true,
					title: "Toggle Columns",
					placeHolder: "Checked columns are visible",
				}
			);

			// Cancelled (Esc) — leave the columns as they were.
			if (!picked) {
				return;
			}

			const visible = new Set(picked.map((item) => item.prop));
			await source.setHiddenColumns(
				COLUMN_DEFS.filter((def) => !visible.has(def.prop)).map(
					(def) => def.prop
				)
			);
		}),
	];
}
