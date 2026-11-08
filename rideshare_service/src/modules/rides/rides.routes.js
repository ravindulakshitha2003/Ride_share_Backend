/*
This code defines the ride API routes using Express Router. 
It connects endpoints for publishing rides, searching rides, and retrieving the 
logged-in driver's rides, while applying authentication and input validation where required.
*/

const router = require('express').Router();
const auth = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const schemas = require('./rides.validation');
const controller = require('./rides.controller');

router.post('/', auth, validate(schemas.createRide), controller.publish);
router.get('/', validate(schemas.searchRides, 'query'), controller.search);
router.get('/mine', auth, controller.mine);
router.get('/match', validate(schemas.matchRides, 'query'), controller.match);

module.exports = router;