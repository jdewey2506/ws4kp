import STATUS from './status.mjs';
import { DateTime } from '../vendor/auto/luxon.mjs';
import { safeJson } from './utils/fetch.mjs';
import WeatherDisplay from './weatherdisplay.mjs';
import { registerDisplay, timeZone } from './navigation.mjs';

const FAA_WEATHERCAMS_API = 'https://weathercams.faa.gov/api';
const FAA_HEADERS = {
	Prefer: 'blue',
};
const IMAGE_MAX_AGE_MINUTES = 90;
const MAX_CAMERA_DISTANCE_MILES = 75;
const EARTH_RADIUS_MILES = 3958.8;

class WeatherCams extends WeatherDisplay {
	constructor(navId, elemId) {
		super(navId, elemId, 'Weather Camera', false);

		this.okToDrawCurrentConditions = false;
		this.refreshTime = 600_000;
		this.timing.delay = 1;
		this.loadId = 0;
	}

	async getData(weatherParameters, refresh) {
		if (!super.getData(weatherParameters, refresh)) return;

		this.loadId += 1;
		const { loadId } = this;

		if (!refresh && this.elem) this.hideCanvas();

		if (!window.WS4KP_SERVER_AVAILABLE) {
			if (!this.isCurrentLoad(loadId)) return;
			this.data = undefined;
			this.timing.totalScreens = 0;
			this.calcNavTiming();
			this.clearCanvas();
			this.setStatus(STATUS.noData);
			return;
		}

		const cameras = await this.getNearbyCameras();
		const cameraWithImage = await this.getFirstCameraWithCurrentImage(cameras);

		if (!this.isCurrentLoad(loadId)) return;

		if (!cameraWithImage) {
			this.data = undefined;
			this.timing.totalScreens = 0;
			this.calcNavTiming();
			this.clearCanvas();
			this.setStatus(STATUS.noData);
			return;
		}

		this.data = cameraWithImage;
		this.timing.totalScreens = 1;
		this.calcNavTiming();
		this.setStatus(STATUS.loaded);
	}

	isCurrentLoad(loadId) {
		return loadId === this.loadId;
	}

	async getNearbyCameras() {
		const bounds = getBounds(this.weatherParameters.latitude, this.weatherParameters.longitude, MAX_CAMERA_DISTANCE_MILES);
		const data = await safeJson(`${FAA_WEATHERCAMS_API}/cameras`, {
			data: {
				bounds,
			},
			headers: FAA_HEADERS,
			retryCount: 1,
			stillWaiting: () => this.stillWaiting(),
		});

		if (!data?.success || !Array.isArray(data.payload)) return [];

		const now = Date.now();
		return data.payload
			.filter((camera) => cameraIsAvailable(camera, now))
			.map((camera) => ({
				...camera,
				distance: milesBetween(
					this.weatherParameters.latitude,
					this.weatherParameters.longitude,
					camera.latitude,
					camera.longitude,
				),
			}))
			.filter((camera) => camera.distance <= MAX_CAMERA_DISTANCE_MILES)
			.sort((a, b) => a.distance - b.distance);
	}

	async getFirstCameraWithCurrentImage(cameras, index = 0) {
		const camera = cameras[index];
		if (!camera || index >= 10) return null;

		const imageData = await safeJson(`${FAA_WEATHERCAMS_API}/cameras/${camera.cameraId}/images/last/1`, {
			headers: FAA_HEADERS,
			retryCount: 1,
			stillWaiting: () => this.stillWaiting(),
		});

		const image = imageData?.payload?.[0];
		if (image?.imageUri && !imageIsExpired(image.imageDatetime)) {
			return {
				...camera,
				imageUri: image.imageUri,
				imageDatetime: image.imageDatetime,
			};
		}

		return this.getFirstCameraWithCurrentImage(cameras, index + 1);
	}

	async drawCanvas() {
		super.drawCanvas();

		const image = this.elem.querySelector('.camera-image img');
		image.src = this.data.imageUri;

		this.elem.querySelector('.camera-location').textContent = formatCameraLocation(this.data, this.weatherParameters);
		this.elem.querySelector('.camera-direction').textContent = formatCameraDirection(this.data);
		this.elem.querySelector('.camera-time').textContent = formatCameraTime(this.data.imageDatetime);

		this.finishDraw();
	}

	clearCanvas() {
		const image = this.elem?.querySelector('.camera-image img');
		if (image) image.removeAttribute('src');
		this.elem?.querySelectorAll('.camera-location, .camera-direction, .camera-time')
			.forEach((elem) => { elem.textContent = ''; });
	}
}

const getBounds = (latitude, longitude, radiusMiles) => {
	const latDelta = radiusMiles / 69;
	const lonDelta = radiusMiles / Math.max(10, Math.cos(latitude * Math.PI / 180) * 69);
	const south = clamp(latitude - latDelta, -90, 90);
	const north = clamp(latitude + latDelta, -90, 90);
	const west = clamp(longitude - lonDelta, -180, 180);
	const east = clamp(longitude + lonDelta, -180, 180);

	return `${round(south)},${round(west)}|${round(north)},${round(east)}`;
};

const cameraIsAvailable = (camera, now) => (
	camera?.cameraId
	&& camera.latitude
	&& camera.longitude
	&& camera.cameraLastSuccess
	&& !camera.cameraInMaintenance
	&& !camera.cameraOutOfOrder
	&& !imageIsExpired(camera.cameraLastSuccess, now)
);

const imageIsExpired = (imageDatetime, now = Date.now()) => {
	const imageTime = Date.parse(imageDatetime);
	if (!Number.isFinite(imageTime)) return true;
	return (now - imageTime) / 60_000 > IMAGE_MAX_AGE_MINUTES;
};

const milesBetween = (lat1, lon1, lat2, lon2) => {
	const lat1Radians = toRadians(lat1);
	const lat2Radians = toRadians(lat2);
	const latDelta = toRadians(lat2 - lat1);
	const lonDelta = toRadians(lon2 - lon1);
	const a = Math.sin(latDelta / 2) ** 2
		+ Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(lonDelta / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_MILES * c;
};

const toRadians = (degrees) => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => value.toFixed(4);

const formatCameraLocation = (camera, weatherParameters) => {
	const city = weatherParameters.city ? `${weatherParameters.city}, ${weatherParameters.state}` : 'Nearby Camera';
	const distance = Math.round(camera.distance);
	return `${city} - ${distance} MI`;
};

const formatCameraDirection = (camera) => {
	const direction = camera.cameraDirection ? camera.cameraDirection.replace(/([a-z])([A-Z])/g, '$1 $2') : 'View';
	return `${direction.toUpperCase()} VIEW`;
};

const formatCameraTime = (imageDatetime) => {
	const time = DateTime.fromISO(imageDatetime, { zone: 'UTC' }).setZone(timeZone());
	return `IMAGE ${time.toLocaleString(DateTime.TIME_SIMPLE).toUpperCase()}`;
};

registerDisplay(new WeatherCams(12, 'weather-cams'));
