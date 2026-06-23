const COORDINATE_TOLERANCE = 0.001;

const sortTravelCities = (cities) => [...cities].sort((a, b) => a.Name.localeCompare(b.Name));

const getNextTravelCity = (cities, currentLatLon) => {
	if (!Array.isArray(cities) || cities.length === 0) return null;

	const sortedCities = sortTravelCities(cities);
	const currentIndex = sortedCities.findIndex((city) => (
		Math.abs(city.Latitude - currentLatLon.lat) < COORDINATE_TOLERANCE
		&& Math.abs(city.Longitude - currentLatLon.lon) < COORDINATE_TOLERANCE
	));

	return sortedCities[(currentIndex + 1) % sortedCities.length];
};

export { getNextTravelCity, sortTravelCities };
