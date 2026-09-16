import express from 'express';
import restaurantRoutes from './routes/restaurant.routes';
import menuItemRoutes from './routes/menuItem.routes';
import categoryRoutes from './routes/category.routes';
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/restaurants', restaurantRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/menu-items', menuItemRoutes);

export default app;