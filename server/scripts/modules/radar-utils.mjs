import { TILE_SIZE, TILE_FULL_SIZE } from './radar-constants.mjs';

// limit a value to within a range
const coerce = (low, value, high) => Math.max(Math.min(value, high), low);

const getXYFromLatitudeLongitudeMap = (pos) => {
	// source values for conversion
	// px		py		lon						lat
	// 589	466		-122.3615246	47.63177832
	// 5288	3638	-80.18297384	25.77018996

	// map position is calculated as a regresion from the above values (=/- a manual adjustment factor)
	// then shifted by half of the tile size (to center the map)
	// then they are limited to values between 0 and the width or height of the map
	const y = coerce(0, (-145.095 * pos.latitude + 7377.117) - 27 - (TILE_SIZE.y / 2), TILE_FULL_SIZE.y - (TILE_SIZE.y));
	const x = coerce(0, (111.407 * pos.longitude + 14220.972) + 4 - (TILE_SIZE.x / 2), TILE_FULL_SIZE.x - (TILE_SIZE.x));

	return { x, y };
};

const LOW_ECHO_COLORS = new Set([
	'49,210,22',
	'0,142,0',
	'20,90,15',
	'10,40,10',
]);

const LOW_ECHO_CLUSTER_MIN_PIXELS = 12;

const isVisibleRadarPixel = (imageData, pixelIndex) => imageData[pixelIndex + 3] > 0;

const isLowEchoPixel = (imageData, pixelIndex) => LOW_ECHO_COLORS.has(`${imageData[pixelIndex]},${imageData[pixelIndex + 1]},${imageData[pixelIndex + 2]}`);

const isNearBlackPixel = (R, G, B) => R <= 12 && G <= 12 && B <= 12;

const clearRadarPixel = (imageData, pixelIndex) => {
	imageData[pixelIndex] = 0;
	imageData[pixelIndex + 1] = 0;
	imageData[pixelIndex + 2] = 0;
	imageData[pixelIndex + 3] = 0;
};

const inspectLowEchoNeighbor = (pixels, visited, stack, width, height, x, y) => {
	if (x < 0 || x >= width || y < 0 || y >= height) return false;

	const pixel = y * width + x;
	const pixelIndex = pixel * 4;
	if (!isVisibleRadarPixel(pixels, pixelIndex)) return false;
	if (!isLowEchoPixel(pixels, pixelIndex)) return true;

	if (!visited[pixel]) {
		visited[pixel] = 1;
		stack.push(pixel);
	}
	return false;
};

const inspectLowEchoCluster = (pixels, visited, width, height, start) => {
	const stack = [start];
	const cluster = [];
	let hasStrongerNeighbor = false;
	visited[start] = 1;

	while (stack.length > 0) {
		const current = stack.pop();
		const currentX = current % width;
		const currentY = Math.floor(current / width);
		cluster.push(current);

		for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
			for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
				const shouldInspect = offsetX !== 0 || offsetY !== 0;
				if (shouldInspect) {
					hasStrongerNeighbor = inspectLowEchoNeighbor(
						pixels,
						visited,
						stack,
						width,
						height,
						currentX + offsetX,
						currentY + offsetY,
					) || hasStrongerNeighbor;
				}
			}
		}
	}

	return { cluster, hasStrongerNeighbor };
};

const removeSmallLowEchoClusters = (RadarImageData, width, height) => {
	const visited = new Uint8Array(width * height);
	const pixels = RadarImageData.data;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const start = y * width + x;
			const startPixelIndex = start * 4;
			const shouldInspect = !visited[start]
				&& isVisibleRadarPixel(pixels, startPixelIndex)
				&& isLowEchoPixel(pixels, startPixelIndex);

			if (shouldInspect) {
				const { cluster, hasStrongerNeighbor } = inspectLowEchoCluster(pixels, visited, width, height, start);
				if (cluster.length < LOW_ECHO_CLUSTER_MIN_PIXELS && !hasStrongerNeighbor) {
					cluster.forEach((pixel) => clearRadarPixel(pixels, pixel * 4));
				}
			}
		}
	}
};
const getXYFromLatitudeLongitudeDoppler = (pos, offsetX, offsetY) => {
	const imgHeight = 6000;
	const imgWidth = 2800;

	// map position is calculated as a regresion
	// then shifted by half of the tile size (to center the map)
	// then they are limited to values between 0 and the width or height of the map

	const y = coerce(0, (51 - pos.latitude) * 61.4481 - offsetY, imgHeight);
	const x = coerce(0, ((-129.138 - pos.longitude) * 42.1768) * -1 - offsetX, imgWidth);

	return { x: x * 2, y: y * 2 };
};

const removeDopplerRadarImageNoise = (RadarContext) => {
	// Validate canvas context and dimensions before calling getImageData
	if (!RadarContext || !RadarContext.canvas) {
		console.error('Invalid radar context provided to removeDopplerRadarImageNoise');
		return;
	}

	const { canvas } = RadarContext;
	if (canvas.width <= 0 || canvas.height <= 0) {
		console.error(`Invalid canvas dimensions in removeDopplerRadarImageNoise: ${canvas.width}x${canvas.height}`);
		return;
	}

	try {
		const RadarImageData = RadarContext.getImageData(0, 0, canvas.width, canvas.height);

		// examine every pixel,
		// change any old rgb to the new-rgb
		for (let i = 0; i < RadarImageData.data.length; i += 4) {
			// i + 0 = red
			// i + 1 = green
			// i + 2 = blue
			// i + 3 = alpha (0 = transparent, 255 = opaque)
			let R = RadarImageData.data[i];
			let G = RadarImageData.data[i + 1];
			let B = RadarImageData.data[i + 2];
			let A = RadarImageData.data[i + 3];

			// is this pixel the old rgb?
			if (isNearBlackPixel(R, G, B)
				|| (R === 0 && G === 236 && B === 236)
				|| (R === 1 && G === 160 && B === 246)
				|| (R === 0 && G === 0 && B === 246)) {
				// change to your new rgb

				// Transparent
				R = 0;
				G = 0;
				B = 0;
				A = 0;
			} else if ((R === 0 && G === 255 && B === 0)) {
				// Light Green 1
				R = 49;
				G = 210;
				B = 22;
				A = 255;
			} else if ((R === 0 && G === 200 && B === 0)) {
				// Light Green 2
				R = 0;
				G = 142;
				B = 0;
				A = 255;
			} else if ((R === 0 && G === 144 && B === 0)) {
				// Dark Green 1
				R = 20;
				G = 90;
				B = 15;
				A = 255;
			} else if ((R === 255 && G === 255 && B === 0)) {
				// Dark Green 2
				R = 10;
				G = 40;
				B = 10;
				A = 255;
			} else if ((R === 231 && G === 192 && B === 0)) {
				// Yellow
				R = 196;
				G = 179;
				B = 70;
				A = 255;
			} else if ((R === 255 && G === 144 && B === 0)) {
				// Orange
				R = 190;
				G = 72;
				B = 19;
				A = 255;
			} else if ((R === 214 && G === 0 && B === 0)
				|| (R === 255 && G === 0 && B === 0)) {
				// Red
				R = 171;
				G = 14;
				B = 14;
				A = 255;
			} else if ((R === 192 && G === 0 && B === 0)
				|| (R === 255 && G === 0 && B === 255)) {
				// Brown
				R = 115;
				G = 31;
				B = 4;
				A = 255;
			}

			RadarImageData.data[i] = R;
			RadarImageData.data[i + 1] = G;
			RadarImageData.data[i + 2] = B;
			RadarImageData.data[i + 3] = A;
		}

		removeSmallLowEchoClusters(RadarImageData, canvas.width, canvas.height);
		RadarContext.putImageData(RadarImageData, 0, 0);
	} catch (error) {
		console.error(`Error in removeDopplerRadarImageNoise: ${error.message}. Canvas size: ${canvas.width}x${canvas.height}`);
		// Don't re-throw the error, just log it and continue processing
	}
};

export {
	getXYFromLatitudeLongitudeDoppler,
	getXYFromLatitudeLongitudeMap,
	removeDopplerRadarImageNoise,
};
