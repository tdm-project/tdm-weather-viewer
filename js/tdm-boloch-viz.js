////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
//
// UTILS

L.Control.Layers.include({
	getActiveOverlays: function () {

		// Create array for holding active layers
		let active = [];

		// Iterate all layers in control
		this._layers.forEach(function (obj) {

			// Check if it's an overlay and added to the map
			if (obj.overlay && this._map.hasLayer(obj.layer)) {

				// Push layer to active array
				active.push(obj.layer);
			}
		});

		// Return array
		return active;
	},
	getOverlayByName: function (name) {
		let result = null;
		// Iterate all layers in control
		this._layers.forEach(function (obj) {
			// Check if it's an overlay and added to the map
			if (obj.overlay && obj.name === name) {
				result = obj.layer;
			}
		});

		// Return array
		return result;
	},
	isActiveOverlayByName: function (name) {
		let l = this.getOverlayByName(name);
		return (l && this._map.hasLayer(l));
	}
});


async function loadResources(url) {

	let result = [];
	await fetch(url)
		.then(response => response.text())
		.then(src => { result = JSON.parse(src); })
		.catch(() => {
			console.log(`FAIL parsing JSON ${url}`);
			return null;
		});

	return result;
}

async function getGeoTiff(url) {
	let tiffInfo = null;
	const response = await fetch(url);
	const arrayBuffer = await response.arrayBuffer();
	const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
	let image = await tiff.getImage();
	let rasters = await image.readRasters();

	let tiffWidth = image.getWidth();
	let tiffHeight = image.getHeight();
	let tiepoint = image.getTiePoints()[0];
	let pixelScale = image.getFileDirectory().ModelPixelScale;
	let geoTransform = [tiepoint.x, pixelScale[0], 0, tiepoint.y, 0, -1 * pixelScale[1]];
	let invGeoTransform = [-geoTransform[0] / geoTransform[1], 1 / geoTransform[1], 0, -geoTransform[3] / geoTransform[5], 0, 1 / geoTransform[5]];
	let imageBounds = [[geoTransform[3], geoTransform[0]], [geoTransform[3] + tiffHeight * geoTransform[5], geoTransform[0] + tiffWidth * geoTransform[1]]];
	tiffInfo = {
		width: tiffWidth,
		height: tiffHeight,
		bounds: imageBounds,
		data: rasters
	}
	return tiffInfo;
}

function median(value, min, max) {
	const tmp = Math.min(value, max);
	return Math.max(tmp, min);
}

function dispatchEvent(names, map) {
	for (let n in names)
		for (let i in map._layers) {
			const l = map._layers[i];
			if (l.emit)
				l.emit(names[n]);
		}
}

function metresPerPixel(map) {
	return 40075016.686 * Math.abs(Math.cos(map.getCenter().lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
}

function setLensPosition(map, latlng) {
	const point = map.latLngToContainerPoint(latlng);
	const size = map.getSize();
	lens_v[0] = point.x;
	lens_v[1] = (size.y - 1) - point.y;
}

function setLensAlpha(a) {
	lens_v[3] = median(a, 0.0, 1.0);
}

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////
//
// GLOBAL VARIABLES

const initLat = 40;
const initLng = 9;
let mapStuff = null;
let timestep_description = [];
let current_idx = -1;
let is_updating_mutex = new Mutex();

const base_satellite_name = 'Satellite';

const wind_layer_name = '10m Wind';
const wind_layer_zindex = 450;

const tcloud_layer_name = 'Total Cloud';
const tcloud_layer_zindex = 420;


let prev_zoom = 0;
let lens_pass = false;
const lens_init_alpha = 0.2;
const lens_delta = 1.05;
const lens_v = [0, 0, 0, 1.0];
const lens_min_radius = 20;
const lens_init_radius = 90;
const lens_max_radius = 180;
let lens_marker = null;


const tprec_layer_name = 'Total Prec';
const tprec_layer_zindex = 430;

const temp_layer_name = 'Temperature';
const temp_layer_zindex = 430;

const radar_layer_name = 'Radar';
const radar_layer_zindex = 440;

const layer_order = [base_satellite_name,
	tcloud_layer_name,
	tprec_layer_name,
	temp_layer_name,
	wind_layer_name,
	radar_layer_name];


function compare_layers(A, B, nameA, nameB) {
	let indexA = layer_order.indexOf(nameA);
	let indexB = layer_order.indexOf(nameB);
	if (indexA < indexB) return -1;
	if (indexA > indexB) return 1;
	return 0;
}

let windLegend = null;
const wind_min_speed = 0;
const wind_max_speed = 20; // 30 m/s right value
const wind_scale = chroma.scale(['#3288bd',
	'#66c2a5',
	'#abdda4',
	'#e6f598',
	'#fee08b',
	'#fdae61',
	'#f46d43',
	'#d53e4f']).domain([wind_min_speed, wind_max_speed]);

const tcloud_min = 0;
const tcloud_max = 100;
const tcloud_scale = chroma.scale(['rgba(0,0,0,0.0)', // 0
	'rgba(0,0,0,0.0)', // 0.2
	'rgba(25,25,25,0.2)', // 0.4
	'rgba(50,50,50,0.6)', // 0.6
	'rgba(100,100,100,0.8)', // 0.8
	'rgba(255,255,255,1.0)'  // 1.0
]).domain([tcloud_min, tcloud_max]);
const tcloud_opacity = 0.6;


let tprecLegend = null;
const tprec_min = 0;
const tprec_max = 6.4;
const tprec_domain = [0, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4];
const tprec_scale = chroma.scale(['rgba(30,60,255,0.0)',
	'rgba(160,255,255,1.0)',
	'rgba(160,255,255,1.0)',
	'rgba(0,210,140,1.0)',
	'rgba(0,220,0,1.0)',
	'rgba(160,230,50,1.0)',
	'rgba(230,175,45,1.0)',
	'rgba(240,130,40,1.0)']).domain(tprec_domain);
const tprec_opacity = 0.6;

let tempLegend = null;
const temp_min = -20;
const temp_max = 40;
const temp_domain = [-20, -10, 0.0, 10.0, 20.0, 30.0, 40.0];
const temp_scale = chroma.scale(['#9589d3ff',
	'#7ec9c4ff',
	'#5e90c5ff',
	'#78921c80',
	'#dcb00680',
	'#ec5f14ff',
	'#8a2a0aff']).domain(temp_domain);

const temp_opacity = 0.9;

let radarLegend = null;
const radar_min = 0;
const radar_max = 6.4;
const radar_domain = [0, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4];
const radar_scale = chroma.scale(['rgba(30,60,255,0.0)',
	'rgba(160,255,255,0.0)',
	'rgba(160,255,255,1.0)',
	'rgba(0,210,140,1.0)',
	'rgba(0,220,0,1.0)',
	'rgba(160,230,50,1.0)',
	'rgba(230,175,45,1.0)',
	'rgba(240,130,40,1.0)']).domain(radar_domain);
const radar_opacity = 0.6;

////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////

function initBaseMap() {

	let Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles: ESRI &mdash; Data: NCEP NOAA, IISAC CNR Bologna, CRS4, UNICA'
	});

	let baseLayers = {
		'Satellite': Esri_WorldImagery,
	};

	let map = L.map('map', {
		layers: [Esri_WorldImagery],
		zoomControl: true,
		enableHighAccuracy: true
	});

	let layerControl = L.control.layers(
		baseLayers,          // base layers
		null,                // overlay layers
		{
			autoZIndex: false,
			sortLayers: true,
			sortFunction: compare_layers,
		} // sort layers by name
	);
	layerControl.addTo(map);

	map.setView([initLat, initLng], 7);

	prev_zoom = map.getZoom();
	//dispatchEvent(['drag', 'dragstart', 'dragend', 'mousedown', 'mouseup', 'mousemove'], map);

	map.createPane("lensMarker");
	map.getPane("lensMarker").style.zIndex = 5000;

	//Lens initialization
	const start_point = map.latLngToLayerPoint([initLat, initLng]);
	lens_v[0] = start_point.x;
	lens_v[1] = start_point.y;
	lens_v[2] = lens_init_radius;
	lens_v[3] = lens_init_alpha;
	///

	lens_marker = L.circleMarker([initLat, initLng],
		{
			pane: 'lensMarker', radius: lens_init_radius, color: '#ff0000', draggable: true,
			fillOpacity: 0, weight: 3
		});

	lens_marker.on('mousedown', () => {
		map.dragging.disable();
		map.on('mousemove', (e) => {
			lens_marker.setLatLng(e.latlng);
			setLensPosition(map, lens_marker.getLatLng());
			dispatchEvent(['update'], map);
		});
	});

	lens_marker.on('mouseover', (e) => {
		map.scrollWheelZoom.disable();
	});
	lens_marker.on('mouseout', (e) => {
		map.scrollWheelZoom.enable();
	});

	map.on('moveend', (e) => {
		setLensPosition(map, lens_marker.getLatLng());
		dispatchEvent(['update'], map);
	});

	map.on('zoomend', (e) => {
		const r = lens_marker.getRadius();
		const z = map.getZoom();
		const nr = r * Math.pow(2, (z - prev_zoom));
		prev_zoom = z;
		lens_marker.setRadius(nr);
		lens_v[2] = lens_marker.getRadius();
		setLensPosition(map, lens_marker.getLatLng());
		dispatchEvent(['update'], map);
	});

	L.DomEvent.on(map.getContainer(), 'wheel', (e) => {
		setLensPosition(map, lens_marker.getLatLng());
		let r = (e.deltaY > 0) ? lens_v[2] * lens_delta : lens_v[2] / lens_delta;
		//r = median(r, lens_min_radius, lens_max_radius);
		lens_v[2] = r;
		lens_marker.setRadius(r);
		dispatchEvent(['update'], map);
	});

	lens_marker.on('mouseup', () => {
		map.removeEventListener('mousemove');
		map.dragging.enable();
	});

	const checkbox = document.getElementById('lensEnable');
	checkbox.checked = false;
	const lensAlphaSlider = document.getElementById('lensAlpha');
	lensAlphaSlider.disabled = true;
	lensAlphaSlider.value = median(lens_init_alpha * 100, 0, 100);
	checkbox.addEventListener('change', (e) => {
		if (e.currentTarget.checked) {
			lensAlphaSlider.disabled = false;
			lens_pass = true;
			lens_marker.addTo(map);
		} else {
			lens_pass = false;
			lensAlphaSlider.disabled = true;
			if (map.hasLayer(lens_marker)) {
				map.removeLayer(lens_marker);
			}
		}
		dispatchEvent(['update'], map);
	});

	lensAlphaSlider.addEventListener('input', (e) => {
		const v = lensAlphaSlider.value / 100;
		setLensAlpha(v);
		dispatchEvent(['update'], map);
	});

	map.on('overlayadd', function (e) {
		l = layerControl.getOverlayByName(radar_layer_name);
		switch (e.name) {
			case wind_layer_name:
				e.layer._canvasLayer._canvas.style.zIndex = wind_layer_zindex;
				break;
			case tcloud_layer_name:
				e.layer._canvas.style.zIndex = tcloud_layer_zindex;
				break;
			case tprec_layer_name:
				e.layer._canvas.style.zIndex = tprec_layer_zindex;
				break;
			case temp_layer_name:
				e.layer._canvas.style.zIndex = temp_layer_zindex;
				break;
			case radar_layer_name:
				e.layer._canvas.style.zIndex = radar_layer_zindex;
				break;
			default:
		};
	});

	return {
		map: map,
		layerControl: layerControl
	};
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupWindLayer(wind_url) {
	let map = mapStuff.map;
	let layerControl = mapStuff.layerControl;

	let wind_is_active = layerControl.isActiveOverlayByName(wind_layer_name);
	if (windLegend) mapStuff.map.removeControl(windLegend);
	let l = layerControl.getOverlayByName(wind_layer_name);
	if (l) {
		layerControl.removeLayer(l);
		l.removeFrom(map);
	} else {
		wind_is_active = true;
	}
	return new Promise(async function (resolve, reject) {
		if (wind_url) {
			const wind_info = await getGeoTiff(wind_url);
			//await sleep(10000);
			if (wind_info) {
				let cscale = [];
				for (let i = wind_min_speed; i <= wind_max_speed; i++) {
					cscale.push(wind_scale(i).hex());
				}

				let velocityLayer = L.velocityLayer({
					displayValues: true,
					displayOptions: {
						velocityType: '10m Wind',
						position: 'bottomleft',//REQUIRED !
						emptyString: 'No velocity data',//REQUIRED !
						angleConvention: 'bearingCW',//REQUIRED !
						displayPosition: 'bottomleft',
						displayEmptyString: 'No velocity data',
						speedUnit: 'm/s'
					},
					width: wind_info.width,
					height: wind_info.height,
					geobounds: wind_info.bounds,
					data: wind_info.data,
					minVelocity: wind_min_speed,          // used to align color scale
					maxVelocity: wind_max_speed,          // used to align color scale
					velocityScale: 0.005,        // modifier for particle animations, arbitrarily defaults to 0.005
					colorScale: cscale,         // define your own function of hex/rgb colors
					particleAge: 16,            // default 64
					particleMultiplier: 1 / 200,  // default 1/300 (particles/pixels);
					lineWidth: 2,                // default 1
				});
				layerControl.addOverlay(velocityLayer, wind_layer_name);
				if (wind_is_active) {
					velocityLayer.addTo(map);
					velocityLayer._canvasLayer._canvas.style.zIndex = wind_layer_zindex;
				}
				resolve("OK");
			} else {
				reject(Error("CANNOT LOAD " + wind_url));
			}
		} else {
			resolve("OK");
		}
	});
}

async function setupTcloudLayer(tcloud_url) {
	let map = mapStuff.map;
	let layerControl = mapStuff.layerControl;

	let tcloud_is_active = layerControl.isActiveOverlayByName(tcloud_layer_name);
	l = layerControl.getOverlayByName(tcloud_layer_name);
	if (l) {
		layerControl.removeLayer(l);
		l.removeFrom(map);
	} else {
		tcloud_is_active = true;
	}

	return new Promise(async function (resolve, reject) {
		if (tcloud_url) {
			const tcloud_info = await getGeoTiff(tcloud_url);
			if (tcloud_info) {
				const tcloudLayer = new TDMBasicGeotiffLayer("TDM_TCLOUD", {
					width: tcloud_info.width,
					height: tcloud_info.height,
					geobounds: tcloud_info.bounds,
					channels: tcloud_info.data,
					colorscale: tcloud_scale,
					opacity: tcloud_opacity,
					min_value: tcloud_min,
					max_value: tcloud_max,
				}, lens_pass, lens_v);
				layerControl.addOverlay(tcloudLayer, tcloud_layer_name);

				tcloudLayer.addEvent('update', () => {
					tcloudLayer.setLensPass(lens_pass);
					tcloudLayer.needRedraw();
				});

				if (tcloud_is_active) {
					tcloudLayer.addTo(map);
					tcloudLayer._canvas.style.zIndex = tcloud_layer_zindex;
				}
				resolve("OK");
			} else {
				reject(Error("CANNOT LOAD " + tcloud_url));
			}
		} else {
			resolve("OK");
		}
	});
}

async function setupTprecLayer(tprec_url) {
	let map = mapStuff.map;
	let layerControl = mapStuff.layerControl;

	let tprec_is_active = layerControl.isActiveOverlayByName(tprec_layer_name);
	if (tprecLegend) mapStuff.map.removeControl(tprecLegend);
	l = layerControl.getOverlayByName(tprec_layer_name);
	if (l) {
		layerControl.removeLayer(l);
		l.removeFrom(map);
	} else {
		tprec_is_active = true;
	}

	return new Promise(async function (resolve, reject) {
		if (tprec_url) {
			const tprec_info = await getGeoTiff(tprec_url);
			if (tprec_info) {
				const tprecLayer = new TDMBasicGeotiffLayer("TDM_TPREC", {
					width: tprec_info.width,
					height: tprec_info.height,
					geobounds: tprec_info.bounds,
					channels: tprec_info.data,
					colorscale: tprec_scale,
					opacity: tprec_opacity,
					min_value: tprec_min,
					max_value: tprec_max
				}, lens_pass, lens_v);
				layerControl.addOverlay(tprecLayer, tprec_layer_name);

				tprecLayer.addEvent('update', () => {
					tprecLayer.setLensPass(lens_pass);
					tprecLayer.needRedraw();
				});

				if (tprec_is_active) {
					tprecLayer.addTo(map);
					tprecLayer._canvas.style.zIndex = tprec_layer_zindex;
				}
				resolve("OK");
			} else {
				reject(Error("CANNOT LOAD " + tprec_url));
			}
		} else {
			resolve("OK");
		}
	});
}

async function setupTempLayer(temp_url) {
	let map = mapStuff.map;
	let layerControl = mapStuff.layerControl;

	let temp_is_active = layerControl.isActiveOverlayByName(temp_layer_name);
	if (tempLegend) mapStuff.map.removeControl(tempLegend);
	l = layerControl.getOverlayByName(temp_layer_name);
	if (l) {
		layerControl.removeLayer(l);
		l.removeFrom(map);
	} else {
		temp_is_active = true;
	}

	return new Promise(async function (resolve, reject) {
		if (temp_url) {
			const temp_info = await getGeoTiff(temp_url);
			if (temp_info) {
				tempLayer = new TDMBasicGeotiffLayer("TDM_TEMP", {
					width: temp_info.width,
					height: temp_info.height,
					geobounds: temp_info.bounds,
					channels: temp_info.data,
					colorscale: temp_scale,
					opacity: temp_opacity,
					min_value: temp_min,
					max_value: temp_max
				}, lens_pass, lens_v);
				layerControl.addOverlay(tempLayer, temp_layer_name);

				tempLayer.addEvent('update', () => {
					tempLayer.setLensPass(lens_pass);
					tempLayer.needRedraw();
				});

				if (temp_is_active) {
					tempLayer.addTo(map);
					tempLayer._canvas.style.zIndex = temp_layer_zindex;
				}
				resolve("OK");
			} else {
				reject(Error("CANNOT LOAD " + temp_url));
			}
		} else {
			resolve("OK");
		}
	});
}

async function setupRadarLayer(radar_url) {
	let map = mapStuff.map;
	let layerControl = mapStuff.layerControl;

	let radar_is_active = layerControl.isActiveOverlayByName(radar_layer_name);
	if (radarLegend) mapStuff.map.removeControl(radarLegend);
	l = layerControl.getOverlayByName(radar_layer_name);
	if (l) {
		layerControl.removeLayer(l);
		l.removeFrom(map);
	} else {
		radar_is_active = true;
	}

	return new Promise(async function (resolve, reject) {
		if (radar_url) {
			const radar_info = await getGeoTiff(radar_url);
			if (radar_info) {
				const radarLayer = new TDMBasicGeotiffLayer("TDM_RADAR", {
					width: radar_info.width,
					height: radar_info.height,
					geobounds: radar_info.bounds,
					channels: radar_info.data,
					colorscale: radar_scale,
					opacity: radar_opacity,
					min_value: radar_min,
					max_value: radar_max
				}, lens_pass, lens_v);
				layerControl.addOverlay(radarLayer, radar_layer_name);

				radarLayer.addEvent('update', () => {
					radarLayer.setLensPass(lens_pass);
					radarLayer.needRedraw();
				});

				if (radar_is_active) {
					radarLayer.addTo(map);
					radarLayer._canvas.style.zIndex = radar_layer_zindex;
				}
				resolve("OK");
			} else {
				reject(Error("CANNOT LOAD " + radar_url));
			}
		} else {
			resolve("OK");
		}
	});
}

async function setupLayers() {
	if (current_idx >= 0) {
		let p1 = setupTcloudLayer(timestep_description[current_idx].tcloud_url);
		let p2 = setupTprecLayer(timestep_description[current_idx].tprec_url);
		let p3 = setupTempLayer(timestep_description[current_idx].temp_url);
		let p4 = setupWindLayer(timestep_description[current_idx].wind_url);
		let p5 = setupRadarLayer(timestep_description[current_idx].radar_url);
		await Promise.all([p1, p2, p3, p4, p5]);
	}
}

// Legends
function createLegendDomain(map, domain, scale, descr) {
	let legend = L.control({ position: 'bottomright' });
	legend.onAdd = function (map) {
		let div = L.DomUtil.create('div', 'metric-legend');
		let width_descr = 25;
		let width = (100 - width_descr) / (domain.length);
		div.innerHTML += '<span style="width: ' + width_descr + '%; background: '
			+ scale(domain[0]).hex() + '">' + descr + '</span>';

		domain.forEach(function (d, i) {
			let v = d;
			let vl = v;
			let vr = v;
			if (i > 0) {
				vl = domain[i - 1];
			} else if (i < domain.length) {
				let vr = domain[i + 1];
			}
			div.innerHTML +=
				'<span style="width: ' + width + '%; background: linear-gradient(to right, ' +
				scale(vl).hex() + ', ' +
				scale(v).hex() + ', ' +
				scale(vr).hex() + '">' + v.toFixed(1) + '</span>';
		});
		return div;
	};
	return legend;
}

function createLegend(map, vmin, vmax, scale, nsteps, descr) {

	let legend = L.control({ position: 'bottomright' });
	legend.onAdd = function (map) {
		let fvmin = parseFloat(vmin);
		let fvmax = parseFloat(vmax);

		let div = L.DomUtil.create('div', 'metric-legend');

		let delta = (fvmax - fvmin) / nsteps;
		let width_descr = 25;
		let width = (100 - width_descr) / (nsteps + 1);

		div.innerHTML += '<span style="width: ' + width_descr + '%; background: '
			+ scale(fvmin).hex() + '">' + descr + '</span>';

		for (let i = 0; i <= nsteps; i++) {
			let v = fvmin + delta * i;
			let vl = v - delta * 0.5;
			let vr = v + delta * 0.5;
			div.innerHTML +=
				'<span class="tick" style="width: ' + width + '%; background: linear-gradient(to right, ' +
				scale(vl).hex() + ', ' +
				scale(v).hex() + ', ' +
				scale(vr).hex() + '">' + v.toFixed(1) + '</span>';
		}
		return div;
	};
	return legend;
}

function createWindLegend() {
	let map = mapStuff.map;

	windLegend = createLegend(map, wind_min_speed, wind_max_speed, wind_scale, 5, "wind [m/s]");

	mapStuff.map.on('overlayadd', function (eventLayer) {
		if (eventLayer.name === wind_layer_name) {
			mapStuff.map.addControl(windLegend);
		}
	});

	mapStuff.map.on('overlayremove', function (eventLayer) {
		if (eventLayer.name === wind_layer_name) {
			mapStuff.map.removeControl(windLegend);
		}
	});
}

function createTprecLegend() {
	let map = mapStuff.map;

	tprecLegend = createLegendDomain(map, tprec_domain, tprec_scale, "prec [mm/h]");

	mapStuff.map.on('overlayadd', function (eventLayer) {
		if (eventLayer.name === tprec_layer_name) {
			mapStuff.map.addControl(tprecLegend);
		}
	});

	mapStuff.map.on('overlayremove', function (eventLayer) {
		if (eventLayer.name === tprec_layer_name) {
			mapStuff.map.removeControl(tprecLegend);
		}
	});

}

function createTempLegend() {
	let map = mapStuff.map;

	tempLegend = createLegendDomain(map, temp_domain, temp_scale, "T [°C]");

	mapStuff.map.on('overlayadd', function (eventLayer) {
		if (eventLayer.name === temp_layer_name) {
			mapStuff.map.addControl(tempLegend);
		}
	});

	mapStuff.map.on('overlayremove', function (eventLayer) {
		if (eventLayer.name === temp_layer_name) {
			mapStuff.map.removeControl(tempLegend);
		}
	});

}

function createRadarLegend() {
	let map = mapStuff.map;

	radarLegend = createLegendDomain(map, radar_domain, radar_scale, "radar [mm/h]");

	mapStuff.map.on('overlayadd', function (eventLayer) {
		if (eventLayer.name === radar_layer_name) {
			mapStuff.map.addControl(radarLegend);
		}
	});

	mapStuff.map.on('overlayremove', function (eventLayer) {
		if (eventLayer.name === radar_layer_name) {
			mapStuff.map.removeControl(radarLegend);
		}
	});
}


/////////////////////////////////////////////////////
// Event Handler

function fromEpochToString(epoch) {
	let date = new Date(epoch);

	YYYY = date.getFullYear();
	MM = date.getMonth() + 1;
	DD = date.getDate();
	let hh = date.getHours();
	let mm = date.getMinutes();
	MMf = ("00" + MM).slice(-2);
	DDf = ("00" + DD).slice(-2);
	hhf = ("00" + hh).slice(-2);
	mmf = ("00" + mm).slice(-2);

	let date_txt = DDf + "/" + MMf + "/" + YYYY + " - " + hhf + ":" + mmf;

	return date_txt;
}

function update_date_label() {
	if (current_idx >= 0) {
		document.getElementById("date_label").textContent = fromEpochToString(timestep_description[current_idx].epoch);
	}
}

function disableBtn(id, status) {
	document.getElementById(id).disabled = status;
}

async function gotoHour(idx) {
	is_updating_mutex
		.acquire()
		.then(async function (release) {
			if (idx >= 0 && idx < timestep_description.length) {
				current_idx = idx;
				await setupLayers();
				update_date_label();
			}
			release();
		});
}

async function gotoHourFirst() {
	gotoHour(0);
}

async function gotoHourLast() {
	gotoHour(timestep_description.length - 1);
}

async function decrHour() {
	is_updating_mutex
		.acquire()
		.then(async function (release) {
			if (current_idx > 0) {
				current_idx = current_idx - 1;
				await setupLayers();
				update_date_label();
			}
			release();
		});
}

async function incrHour() {
	is_updating_mutex
		.acquire()
		.then(async function (release) {
			if (current_idx + 1 < timestep_description.length) {
				current_idx = current_idx + 1;
				await setupLayers();
				update_date_label();
			}
			release();
		});
}


function find_url(all_resources, name) {
	let result = null;
	let item = all_resources.find(x => x.name === name);
	if (item) {
		result = item.url;
	}
	return result;
}

function createTimeStepDescription(resources_forecast_json, resources_radar_json) {

	let forecast_resources = resources_forecast_json.result.resources;
	let utc_to_cest = 2 * 60 * 60 * 1000;

	forecast_resources.forEach(function (item) {
		let filekind = item.name;
		let url = item.url;
		let tmp_str = url.split("/");
		let poi_str = tmp_str[tmp_str.length - 2];
		let date_str = tmp_str[tmp_str.length - 3];

		let YYYY = date_str.substr(0, 4);
		let MM = date_str.substr(5, 2);
		let MDate = parseInt(MM) - 1;
		let DD = date_str.substr(8, 2);
		let hh = date_str.substr(11, 2);
		let mm = date_str.substr(14, 2);

		let ss = 0;
		let date = new Date(YYYY, MDate, DD, hh, mm, ss);
		date.setTime(date.getTime() + utc_to_cest);

		YYYY = date.getFullYear();
		MM = date.getMonth() + 1;
		DD = date.getDate();
		hh = date.getHours();
		mm = date.getMinutes();
		let epoch = date.getTime();
		MMf = ("00" + MM).slice(-2);
		DDf = ("00" + DD).slice(-2);
		hhf = ("00" + hh).slice(-2);
		mmf = ("00" + mm).slice(-2);

		let idx = timestep_description.findIndex(x => x.epoch === epoch);
		if (idx == -1) {
			let td = {
				epoch: epoch,
				wind_url: null,
				tcloud_url: null,
				tprec_url: null,
				temp_url: null,
				radar_url: null
			};
			timestep_description.push(td);
			idx = timestep_description.length - 1;
		};

		switch (filekind) {
			case "uv10":
				timestep_description[idx].wind_url = url;
				break;
			case "tcov":
				timestep_description[idx].tcloud_url = url;
				break;
			case "tprec":
				timestep_description[idx].tprec_url = url;
				break;
			case "temp2m":
				timestep_description[idx].temp_url = url;
				break;
			default:
				console.log("ERROR: unknown kind " + fname);
		};

	});

	let radar_resources = resources_radar_json.result.resources;
	radar_resources.forEach(function (item) {
		let fname = item.name;
		let url = item.url;
		let YYYY = fname.substr(0, 4); let Y = parseInt(YYYY);
		let MM = fname.substr(5, 2); let M = parseInt(MM) - 1;
		let DD = fname.substr(8, 2); let D = parseInt(DD);
		let hh = fname.substr(11, 2); let h = parseInt(hh);
		let mm = "00"; let m = parseInt(mm);
		let date = new Date(Y, M, D, h, m, 0, 0);
		let epoch = date.getTime() + utc_to_cest;

		let idx = timestep_description.findIndex(x => x.epoch === epoch);
		if (idx == -1) {
			let td = {
				epoch: epoch,
				wind_url: null,
				tcloud_url: null,
				tprec_url: null,
				temp_url: null,
				radar_url: null
			};
			timestep_description.push(td);
			idx = timestep_description.length - 1;
		};
		timestep_description[idx].radar_url = url;
	});

	timestep_description.sort(function (a, b) {
		if (a.epoch < b.epoch) return -1;
		if (b.epoch < a.epoch) return 1;
		return 0;
	});

	current_idx = timestep_description.length > 0 ? 0 : -1;
}

function handling_select_container() {
	let idx = document.getElementById("select_date").value;
	gotoHour(parseInt(idx));
}

function generate_date_menu() {
	let overlay_container = document.getElementById("time-overlay");
	let date_menu_container = document.createElement("div");
	overlay_container.appendChild(date_menu_container);
	let select_container = document.createElement("select");
	select_container.setAttribute("id", "select_date");

	select_container.onchange = handling_select_container;

	date_menu_container.appendChild(select_container);
	timestep_description.forEach(function (item, i) {
		let opt = document.createElement("option");
		let date_str = fromEpochToString(item.epoch);
		opt.setAttribute("value", i);
		var t = document.createTextNode(date_str);
		opt.appendChild(t);
		select_container.appendChild(opt);
	});
}

// Main
async function main(resources_forecast_url, resources_radar_url) {
	const resources_forecast_json = await loadResources(resources_forecast_url);
	const resources_radar_json = await loadResources(resources_radar_url);
	createTimeStepDescription(resources_forecast_json, resources_radar_json);
	mapStuff = initBaseMap();
	createWindLegend();
	createTprecLegend();
	createTempLegend();
	createRadarLegend();
	await setupLayers();
	update_date_label();
	generate_date_menu();
}

window.onload = function () {
	main('https://rest.tdm-project.it/tdm/odata/product/meteosim/bolam/2018110301/cf725252-d976-4342-a68b-465d577b7291-lonlat/description.json',
		'https://rest.tdm-project.it/tdm/odata/product/radar/cag01est2400/2018-11-03/1h/description.json');
};
