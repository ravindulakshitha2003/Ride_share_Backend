/*
This code defines the ride controller that handles incoming API requests. 
It connects the routes to the service layer to publish rides, search available rides, 
and retrieve the logged-in driver's own rides, then sends the results as JSON responses.
*/

const service = require('./rides.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.publish = asyncHandler(async (req, res) => {
  const ride = await service.publishRide(req.user.id, req.body);
  res.status(201).json(ride);
});

exports.search = asyncHandler(async (req, res) => {
  res.json(await service.searchRides(req.query));
});

exports.mine = asyncHandler(async (req, res) => {
  res.json(await service.getMyRides(req.user.id));
});

exports.match = asyncHandler(async (req, res) => {
  res.json(await service.matchRides(req.query));
});