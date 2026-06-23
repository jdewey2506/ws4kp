import assert from 'node:assert/strict';
import test from 'node:test';
// This focused test intentionally exercises the browser module from the parent package.
// eslint-disable-next-line import/no-relative-packages
import { getNextTravelCity, sortTravelCities } from '../server/scripts/modules/utils/travel-city-cycle.mjs';

const cities = [
	{ Name: 'Chicago', Latitude: 41.8781, Longitude: -87.6298 },
	{ Name: 'Atlanta', Latitude: 33.749, Longitude: -84.388 },
	{ Name: 'Boston', Latitude: 42.3601, Longitude: -71.0589 },
];

test('sorts travel cities alphabetically without mutating the source list', () => {
	assert.deepEqual(sortTravelCities(cities).map(({ Name }) => Name), ['Atlanta', 'Boston', 'Chicago']);
	assert.equal(cities[0].Name, 'Chicago');
});

test('selects the next alphabetical city and wraps after the final city', () => {
	assert.equal(getNextTravelCity(cities, { lat: 33.749, lon: -84.388 }).Name, 'Boston');
	assert.equal(getNextTravelCity(cities, { lat: 41.8781, lon: -87.6298 }).Name, 'Atlanta');
});

test('starts with the first alphabetical city when the current location is not a travel city', () => {
	assert.equal(getNextTravelCity(cities, { lat: 40.7128, lon: -74.006 }).Name, 'Atlanta');
});
