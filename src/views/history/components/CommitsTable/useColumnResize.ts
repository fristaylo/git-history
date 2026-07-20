import { useDrag } from "@use-gesture/react";
import { sum } from "lodash";
import { useEffect, useMemo, useState } from "react";
import type { IHeader } from "./constants";

const SIZES_STORAGE_KEY = "culumn-size";
const AUTO_HIDE_ORDER = ["hash", "graph"];

export function useColumnResize(
	columns: IHeader[],
	totalWidth = 0
): {
	columns: (IHeader & {
		hasDivider: boolean;
		size: number;
		dragBind: ReturnType<typeof useDrag>;
	})[];
} {
	const visible = useMemo(
		() => pickVisibleColumns(columns, totalWidth),
		[columns, totalWidth]
	);
	const sizes = useMemo(
		() => getSizes(visible, totalWidth),
		[visible, totalWidth]
	);
	const [dragStartSizes, setDragStartSizes] = useState(sizes);
	const [realtimeSizes, setRealTimeSizes] = useState(sizes);

	useEffect(() => {
		setRealTimeSizes(sizes);
	}, [sizes]);

	const dragBind = useDrag(({ type, movement: [mx], args: [index] }) => {
		if (type === "pointerdown") {
			setDragStartSizes(realtimeSizes);
			return;
		}

		const newSizes = [...dragStartSizes];
		newSizes[index] = newSizes[index] - mx;
		newSizes[index - 1] = newSizes[index - 1] + mx;

		const isExceedSize =
			newSizes[index] < 8 ||
			newSizes[index - 1] < 8;

		if (!isExceedSize) {
			setRealTimeSizes(newSizes);
		}

		if (type === "pointerup") {
			saveColumnSizes(visible, isExceedSize ? realtimeSizes : newSizes, [
				index - 1,
				index,
			]);
		}
	});

	return {
		columns: visible.map((column, index) => ({
			...column,
			hasDivider: index !== 0,
			size: realtimeSizes[index],
			dragBind,
		})),
	};
}

function fixedWidth(column: IHeader, storedSizes: Record<string, number>) {
	if (column.width === "fill") {
		return 0;
	}
	return Math.max(storedSizes[column.prop] ?? column.width, column.minWidth);
}

function pickVisibleColumns(columns: IHeader[], totalWidth: number): IHeader[] {
	if (!totalWidth) {
		return columns;
	}

	const storedSizes = loadStoredSizes();
	const fill = columns.find((c) => c.width === "fill");
	let visible = columns;

	for (const prop of AUTO_HIDE_ORDER) {
		const fixed = sum(visible.map((c) => fixedWidth(c, storedSizes)));
		if (!fill || totalWidth - fixed >= fill.minWidth) {
			break;
		}
		visible = visible.filter((c) => c.prop !== prop);
	}

	return visible;
}

function getSizes(columns: IHeader[], totalWidth: number) {
	const storedSizes = loadStoredSizes();
	let fillIndex = -1;
	const sizes = columns.map((column, index) => {
		if (column.width === "fill") {
			fillIndex = index;
			return 0;
		}
		return fixedWidth(column, storedSizes);
	});

	if (fillIndex !== -1) {
		sizes[fillIndex] = Math.max(
			totalWidth - sum(sizes),
			columns[fillIndex].minWidth
		);
	}

	return sizes;
}

function loadStoredSizes(): Record<string, number> {
	try {
		const raw = localStorage.getItem(SIZES_STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveColumnSizes(
	columns: IHeader[],
	sizes: number[],
	changed: number[]
) {
	const storedSizes = loadStoredSizes();
	for (const index of changed) {
		const column = columns[index];
		if (column && column.width !== "fill") {
			storedSizes[column.prop] = Math.round(sizes[index]);
		}
	}

	try {
		localStorage.setItem(SIZES_STORAGE_KEY, JSON.stringify(storedSizes));
	} catch {
		return;
	}
}
