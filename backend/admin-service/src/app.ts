import express from "express";
//import adminRoutes from "./routes/admin.routes";
import emailRoutes from "./routes/email";
import dotenv from "dotenv";

const cors = require('cors');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

//app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);

// Start the server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
