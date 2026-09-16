import express from 'express';
import path from 'path';
import restaurantRoutes from './routes/restaurant.routes';
import menuItemRoutes from './routes/menuItem.routes';
import categoryRoutes from './routes/category.routes';
import uploadRoutes from './routes/upload.routes';
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/upload', uploadRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: err.message || 'Upload failed' });
});

export default app;