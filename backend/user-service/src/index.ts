import app from "./app";
import connectDB from "./config/db";
import dotenv from "dotenv";

dotenv.config();
connectDB();

const configuredPort = process.env.PORT;
const PORT = configuredPort && /^(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/.test(configuredPort)
  ? Number(configuredPort)
  : 5000;

app.listen(PORT, () => {
  console.log("Server running");
});
