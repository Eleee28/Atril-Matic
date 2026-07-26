import { beforeEach, describe, expect, it, vi, } from "vitest";

import { uploadPdf, getConversionStatus, downloadMusicXml, extractMusicXmlFromMxl } from "./audiforge";

global.fetch = vi.fn();

describe("uploadPdf", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uploads the pdf and returns the conversion id", async () => {
		fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: "conversion-123",
			}),
		});

		const file = new File(["pdf"], "score.pdf");

		const id = await uploadPdf(file);

		expect(id).toBe("conversion-123");

		expect(fetch).toHaveBeenCalledWith(
			"/api/upload", 
			expect.objectContaining({
				method: "POST",
			}),
		);
	});

	it("throws when upload fails", async () => {
		fetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => "Upload failed",
		});

		const file = new File([], "score.pdf");

		await expect(uploadPdf(file)).rejects.toThrow("Upload failed");
	});

	it("throws when id not returned", async () => {
		fetch.mockResolvedValue({
			ok: true,
			json: async () => ({}),
		});

		const file = new File([], "score.pdf");

		await expect(uploadPdf(file)).rejects.toThrow("Audiforge did not return a conversion ID");
	});
});

describe("getConversionStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the status object", async () => {
		fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				status: "processing",
			}),
		});

		const status = await getConversionStatus("abc");

		expect(status.status).toBe("processing");

		expect(fetch).toHaveBeenCalledWith(
			"/api/status/abc", 
		);
	});

	it("encodes the conversion id", async () => {
		fetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				status: "processing",
			}),
		});

		const status = await getConversionStatus("a b");

		expect(status.status).toBe("processing");

		expect(fetch).toHaveBeenCalledWith(
			"/api/status/a%20b", 
		);
	});

	it("throws when audiforge returns error", async () => {
		fetch.mockResolvedValue({
			ok: false,
			status: 404,
			text: async () => "Not found",
		});

		await expect(getConversionStatus("abc")).rejects.toThrow("Not found");
	});
});

describe("downloadMusicXml", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		global.JSZip = {
			loadAsync: vi.fn(),
		};
	});

	it("throws when download fails", async () => {
		fetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: async () => "Download failed",
		});

		await expect(downloadMusicXml("123")).rejects.toThrow("Download failed");
	});

	it("throws when the zip contains no mxl file", async () => {
		fetch.mockResolvedValue({
			ok: true,
			blob: async () => new Blob(),
		});

		JSZip.loadAsync.mockResolvedValue({
			files: {
				"test.txt": {
					dir: false,
					name: "test.txt",
				},
			},
		});

		await expect(downloadMusicXml("123")).rejects.toThrow("MXL file not found");
	});
});

describe("extractMusicXmlFromMxl", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		global.JSZip = {
			loadAsync: vi.fn(),
		};
	});

	it("throws when META-INF/container.xml is missing", async () => {
		JSZip.loadAsync.mockResolvedValue({
			file: vi.fn(() => null),
		});

		await expect(extractMusicXmlFromMxl(new Blob())).rejects.toThrow("MXL file does not contain META-INF/container.xml");
	});

	it("throws when parsererror exists", async () => {
		const container = { 
			async: vi.fn().mockResolvedValue("<xml/>") 
		};

		JSZip.loadAsync.mockResolvedValue({
			file: vi.fn(() => container),
		});

		global.DOMParser = class {
			parseFromString() {
				return {
					querySelector: vi.fn(),
				};
			}
		};

		vi.spyOn(document, "querySelector").mockReturnValue({});

		await expect(extractMusicXmlFromMxl(new Blob())).rejects.toThrow("Couldn't read container.xml");
	});
});