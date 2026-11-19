import express from 'express';
import cors from 'cors';

import routeMatchingRoutes from './modules/routeMatching/routeMatching.routes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/authMiddleware.js';

const app = express();


app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));


app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Share-Ride Route Publishing API is running'
    });
});

app.use('/api/v1/route-matching', authenticateToken ,routeMatchingRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;