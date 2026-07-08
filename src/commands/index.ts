import { getBranchActionCommandsDisposable } from "./branchActions";
import { getBranchCommandsDisposable } from "./branches";
import { getColumnCommandsDisposable } from "./columns";
import { getFilterCommandsDisposable } from "./filter";
import { getInputCommandsDisposable } from "./input";
import { getOpenChangeCommandsDisposable } from "./openChange";
import { getSwitchCommandsDisposable } from "./switch";

export function getCommandDisposables() {
	return [
		...getFilterCommandsDisposable(),
		...getSwitchCommandsDisposable(),
		...getBranchCommandsDisposable(),
		...getBranchActionCommandsDisposable(),
		...getColumnCommandsDisposable(),
		...getInputCommandsDisposable(),
		...getOpenChangeCommandsDisposable(),
	];
}
