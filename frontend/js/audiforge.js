const AUDIFORGE_API_URL = "/api";

const SLEEP_INTERVAL_MS = 2000;
const CONVERSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function convertPdfToMusicXml(pdfFile) {
	const conversionId = await uploadPdf(pdfFile);

	await waitForConversion(conversionId);

	return downloadMusicXml(conversionId);
}

async function uploadPdf(pdfFile) {
	const formData = new FormData();
	formData.append("file", pdfFile);

	const response = await fetch(`${AUDIFORGE_API_URL}/upload`, {
		method: "POST",
		body: formData,
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || `PDF upload failed with status ${response.status}`);
	}

	const result = await response.json();
	if (!result.id) {
		throw new Error("Audiforge did not return a conversion ID");
	}

	return result.id;
}

async function waitForConversion(conversionId) {
	const startTime = Date.now();

	while (true) {
		if (Date.now() - startTime > CONVERSION_TIMEOUT_MS) {
			throw new Error("The PDF conversion timed out");
		}

		const status = await getConversionStatus(conversionId);
		console.log("Audiforge status: ", status);

		if (status.status == "completed")
			return;

		if (status.status == "error")
			throw new Error(status.message || "Audiforge could not convert the PDF");

		await sleep(SLEEP_INTERVAL_MS);
	}
}

async function getConversionStatus(conversionId) {
	const response = await fetch(`${AUDIFORGE_API_URL}/status/${encodeURIComponent(conversionId)}`);

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || `Could not get conversion status: ${response.status}`);
	}

	return response.json();
}

async function downloadMusicXml(conversionId) {
	const response = await fetch(`${AUDIFORGE_API_URL}/download/${encodeURIComponent(conversionId)}`);

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || `Could not download converted score: ${response.status}`);
	}

	const zipBlob = await response.blob();
	const zip = await JSZip.loadAsync(zipBlob);

	const mxlFile = Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().endsWith(".mxl"));

	if (!mxlFile) 
		throw new Error("MXL file not found");

	const mxlBlob = await mxlFile.async("blob");
	return extractMusicXmlFromMxl(mxlBlob);
}

async function extractMusicXmlFromMxl(mxlBlob) {
	const mxlZip = await JSZip.loadAsync(mxlBlob);

	const containerFile = mxlZip.file("META-INF/container.xml");
	if (!containerFile)
		throw new Error("MXL file does not contain META-INF/container.xml");

	const containerXml = await containerFile.async("text");
	
	const parser = new DOMParser();
	const xmlDocument = parser.parseFromString(containerXml, "application/xml");

	const parserError = document.querySelector("parsererror");
	if (parserError)
		throw new Error("Couldn't read container.xml");

	const rootFilePath = xmlDocument.querySelector("rootfile")?.getAttribute("full-path");
	if (!rootFilePath)
		throw new Error("container.xml does not indicate score xml file");

	const musicXmlFile = mxlZip.file(rootFilePath);
	if (!musicXmlFile)
		throw new Error(`${rootFilePath} not found inside MXL`);

	return musicXmlFile.async("text");
}

function sleep(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}