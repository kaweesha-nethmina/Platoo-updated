import app from './app';
import connectDB from './utils/db';
import dotenv from 'dotenv';
const cors = require("cors");

dotenv.config();
app.use(cors());

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});