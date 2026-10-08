import assert from 'node:assert/strict';
import { countryNear } from '../src/lib/locationCountry.ts';

const maseru = { lat: -29.3151, lon: 27.4869 };
assert.equal(countryNear([{ lat: -29.31, lon: 27.48, country_code: 'LS' }, { lat: -29.1, lon: 26.2, country_code: 'ZA' }], maseru.lat, maseru.lon), 'LS');
assert.equal(countryNear([{ lat: '-29.3152', lon: '27.4870', country_code: 'LS' }], maseru.lat, maseru.lon), 'LS', 'string coords');
assert.equal(countryNear([{ lat: -26.2, lon: 28.04, country_code: 'ZA' }], maseru.lat, maseru.lon), undefined, 'too far away');
assert.equal(countryNear([{ lat: -29.3151, lon: 27.4869 }], maseru.lat, maseru.lon), undefined, 'no country');
assert.equal(countryNear([], maseru.lat, maseru.lon), undefined);
assert.equal(countryNear(null, maseru.lat, maseru.lon), undefined);
console.log('locationCountry: 6 cases passed');
