import assert from 'node:assert/strict';
import { savedRouteMatches } from '../src/lib/savedRoute.ts';

const req = { origin_lat: -28.758133, origin_lon: 28.53757, dest_lat: -29.85, dest_lon: 31.03, vehicle_type: 'Tri-axle', vehicle_type_id: 7, stops: [] };
const now = { pickup: { lat: -28.758133, lon: 28.53757 }, delivery: { lat: -29.85, lon: 31.03 }, truckId: 7, truckName: 'Tri-axle', stops: [] };
assert.equal(savedRouteMatches(req, now), true, 'unchanged inputs keep the saved route');
assert.equal(savedRouteMatches(req, { ...now, truckId: '7' }), true, 'id as string');
assert.equal(savedRouteMatches(req, { ...now, delivery: { lat: -29.86, lon: 31.03 } }), false, 'delivery moved');
assert.equal(savedRouteMatches(req, { ...now, truckId: 8 }), false, 'other truck');
assert.equal(savedRouteMatches(req, { ...now, stops: [{ lat: -29.1, lon: 30 }] }), false, 'a stop added');
assert.equal(savedRouteMatches({ ...req, stops: [{ lat: -29.1, lon: 30 }] }, { ...now, stops: [{ lat: -29.1, lon: 30 }] }), true, 'same stop');
assert.equal(savedRouteMatches(req, { ...now, pickup: null }), false, 'collection not resolved yet');
assert.equal(savedRouteMatches(null, now), false);
console.log('savedRoute: 8 cases passed');
