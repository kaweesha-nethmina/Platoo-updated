import express, { Request, Response, NextFunction } from "express";
import emailRoutes from "./routes/email";
import dotenv from "dotenv";
import crypto from "crypto";

const cors = require('cors');
dotenv.config();

const app = express();
app.use(express.json());

const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use("/api/email", emailRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = crypto.randomUUID();
  console.error(`[${correlationId}] ${req.method} ${req.originalUrl} -`, err.stack || err.message);
  res.status(500).json({ error: "Internal server error", correlationId });
});

// Start the server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
