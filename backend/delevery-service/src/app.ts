import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors"; // Import cors properly
import crypto from "crypto";
import deliveryRoutes from "./routes/deliveryRoutes";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Configure CORS middleware FIRST
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware order is critical
app.use(cors(corsOptions)); // Apply CORS before routes
app.use(express.json());

// Routes
app.use("/api/delivery", deliveryRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("MongoDB Connected"))
  .catch((error) => console.log(error));

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("Delivery Panel API is running!");
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = crypto.randomUUID();
  console.error(`[${correlationId}] ${req.method} ${req.originalUrl} -`, err.stack || err.message);
  res.status(500).json({ error: "Internal server error", correlationId });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
