import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'identity-service',
    uptime: process.uptime(),
  });
});

// Reads the token if one is sent and attaches the user to the request
app.use((req, res, next) => {
  const tokenString = req.header('Authorization');
  if (!tokenString) return next();

  const token = tokenString.replace('Bearer ', ''); // remove the "Bearer " prefix
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
});



// Connect to MongoDB
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
} catch (err) {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
}

// Start app
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Identity service running on port ${PORT}`);
});