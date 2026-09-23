import app from "./app";
import connectDB from "./config/db";
import dotenv from "dotenv";

dotenv.config();

const configuredPort = process.env.PORT;
const PORT_PATTERN = /^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;
const port = configuredPort && PORT_PATTERN.test(configuredPort) ? Number(configuredPort) : 5000;

connectDB();
app.listen(port);
