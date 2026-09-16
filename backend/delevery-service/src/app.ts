import express, { Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors"; // Import cors properly
import deliveryRoutes from "./routes/deliveryRoutes";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Configure CORS middleware FIRST
const corsOptions = {
  origin: ['http://localhost:8000', 'http://127.0.0.1:8000'],
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
