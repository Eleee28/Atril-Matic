import { describe, expect, it, vi } from "vitest";

const {
	mockStats,
	mockTime,
	mockOsmd,
} = vi.hoisted(() => {
	return {
		mockStats: {
			currentPosition: 0,
			totalPositions: 3,
		},
		mockTime: {
			playTimeout: null,
		},
		mockOsmd: {
			cursor: {
				iterator: {
					EndReached: false,
				},
				next: vi.fn(),
				previous: vi.fn(),
			},
		},
	};
});

vi.mock("./script.js", () => ({
	elements: {
		scoreDiv: {
			querySelector: vi.fn(),
		},
	},
	osmd: mockOsmd,
	stats: mockStats,
	time: mockTime,
}));

vi.mock("./statistics.js", () => ({
	updateStatistics: vi.fn(),
}));

vi.mock("./player.js", () => ({
	startPlay: vi.fn(),
	stopPlay: vi.fn(),
}));

import { moveCursorNext, moveCursorPrevious } from "./cursor";
import { updateStatistics } from "./statistics";

describe("moveCursorNext", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockStats.currentPosition = 0;
		mockStats.totalPositions = 3;

		mockOsmd.cursor.iterator.EndReached = false;
	});

	it("moves cursor forward", () => {
		const result = moveCursorNext();

		expect(result).toBe(true);

		expect(mockOsmd.cursor.next).toHaveBeenCalled();

		expect(mockStats.currentPosition).toBe(1);

		expect(updateStatistics).toHaveBeenCalled();
	});

	it("does not move when end is reached", () => {
		mockOsmd.cursor.iterator.EndReached = true;

		const result = moveCursorNext();

		expect(result).toBe(false);

		expect(mockOsmd.cursor.next).not.toHaveBeenCalled();
	});

	it("does not exceed total positions", () => {
		mockStats.currentPosition = 2;

		moveCursorNext();

		expect(mockStats.currentPosition).toBe(2);
	});
});

describe("moveCursorPrevious", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockStats.currentPosition = 2;
	});

	it("moves cursor backwards", () => {
		const result = moveCursorPrevious();

		expect(result).toBe(true);

		expect(mockOsmd.cursor.previous).toHaveBeenCalled();

		expect(mockStats.currentPosition).toBe(1);

		expect(updateStatistics).toHaveBeenCalled();
	});

	it("does not move before position zero", () => {
		mockStats.currentPosition = 0;

		const result = moveCursorPrevious();

		expect(result).toBe(false);

		expect(mockOsmd.cursor.previous).not.toHaveBeenCalled();
	});
});