/*
This code defines Zod validation schemas for creating and searching rides. It ensures 
that ride details such as locations, coordinates, date, time, seats, price, and search 
inputs follow the required formats and valid ranges.
*/

const { z } = require('zod');

const place = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createRide = z.object({
  origin: place,
  destination: place,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour)'),
  seats: z.number().int().min(1).max(8),
  price: z.number().min(0),
  distanceKm: z.number().positive().optional(),
  durationMin: z.number().int().positive().optional(),
  routeGeometry: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
    .min(2, 'Route needs at least 2 points'),
});

const searchRides = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});


module.exports = { createRide, searchRides, };
