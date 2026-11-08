/*
This code configures the main Express application. 
It enables CORS(Cross-Origin Resource Sharing) and JSON parsing, provides a health-check endpoint, registers the 
ride API routes, and sets up centralized 404 and error-handling middleware.
*/

const express = require('express');
const cors = require('cors');
const ridesRoutes = require('./modules/rides/rides.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'rideshare_service' }));
app.use('/api/rides', ridesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;