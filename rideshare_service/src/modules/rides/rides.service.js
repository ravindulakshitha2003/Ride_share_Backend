/*
This code contains the business logic for ride management. 
It validates departure dates and times using Sri Lankan time, publishes new rides, 
searches rides by route and date, and retrieves rides belonging to a specific driver.
*/

const repo = require('./rides.repository');
const AppError = require('../../utils/AppError');

const SL_OFFSET = '+05:30'; // Sri Lanka time

exports.publishRide = async (driverId, data) => {
  const departureAt = new Date(`${data.date}T${data.time}:00${SL_OFFSET}`);
  if (isNaN(departureAt)) throw new AppError('Invalid date or time', 400);
  if (departureAt <= new Date()) throw new AppError('Departure must be in the future', 400);

  return repo.insert({ ...data, driverId, departureAt });
};

exports.searchRides = ({ from, to, date }) => {
  const dayStart = new Date(`${date}T00:00:00${SL_OFFSET}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return repo.search({ from, to, dayStart, dayEnd });
};

exports.getMyRides = (driverId) => repo.findByDriver(driverId);

exports.matchRides = (q) => {
  const from = new Date(`${q.date}T00:00:00${SL_OFFSET}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return repo.match({
    pickup: { lat: q.pickupLat, lng: q.pickupLng },
    dropoff: { lat: q.dropoffLat, lng: q.dropoffLng },
    from, to,
    radius: q.radius,
    minGap: 0.02,   // minimum gap on the 0-1 ruler
    limit: 10,
  });
};