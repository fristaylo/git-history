import { useDrag } from "@use-gesture/react";
import { useEffect, useMemo, useState } from "react";
import { sum } from "lodash";

import { IHeader } from "./constants";

const MIN_COLUMN_WIDTH = 8;
const SIZES_STORAGE_KEY = "git-history.columnSizes";

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
	const sizes = useMemo(
		() => getSizes(columns, totalWidth),
		[columns, totalWidth]
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
			newSizes[index] < MIN_COLUMN_WIDTH ||
			newSizes[index - 1] < MIN_COLUMN_WIDTH;

		if (!isExceedSize) {
			setRealTimeSizes(newSizes);
		}

		if (type === "pointerup") {
			saveColumnSizes(columns, isExceedSize ? realtimeSizes : newSizes);
		}
	});

	return {
		columns: columns.map((column, index) => ({
			...column,
			hasDivider: index !== 0,
			size: realtimeSizes[index],
			dragBind,
		})),
	};
}

function getSizes(columns: IHeader[], totalWidth: number) {
	const storedSizes = loadStoredSizes();
	let fillIndex = -1;
	const sizes = columns.map(({ width, prop }, index) => {
		if (width === "fill") {
			fillIndex = index;
			return 0;
		}
		return storedSizes[prop] ?? width;
	});

	if (fillIndex !== -1) {
		sizes[fillIndex] = totalWidth - sum(sizes);
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

function saveColumnSizes(columns: IHeader[], sizes: number[]) {
	const storedSizes = loadStoredSizes();
	columns.forEach((column, index) => {
		if (column.width !== "fill") {
			storedSizes[column.prop] = Math.round(sizes[index]);
		}
	});

	try {
		localStorage.setItem(SIZES_STORAGE_KEY, JSON.stringify(storedSizes));
	} catch {
		return;
	}
}
