import express from "express";
import cors from "cors";
import { trackingRouter } from "./routes/tracking.js";

const app = express();

const port = Number(process.env.PORT) || 3000;

app.use(cors({
	origin: [
		"http://localhost:8000",
		"http://127.0.0.1:8000"
	]
}));

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok" });
});

app.use("/api", trackingRouter);

app.use((error, req, res, next) => {
	console.error(error);

	if (error instanceof SyntaxError && "body" in error)
		return res.status(400).json({ error: "Invalid JSON body" });

	return res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
	console.log(`Backend listening on http://localhost:${port}`);
});