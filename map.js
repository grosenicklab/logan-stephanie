/* Map page — our places around Mazunte on an OpenFreeMap vector
   basemap, recolored layer by layer to the site palette. Each pin
   links out to Google Maps for directions. Places without coordinates
   are listed but not pinned; add lat/lng once a location is confirmed. */

(function () {
  const CATS = {
    stay:  { label: 'Stay',         color: '#B85B3F' },
    do:    { label: 'Do',           color: '#3A6B85' },
    eat:   { label: 'Eat',          color: '#7D4A3A' },
    drink: { label: 'Drink',        color: '#D4924E' },
    travel:{ label: 'Getting here', color: '#4A423D' }
  };

  // q is what Google Maps searches for when a pin's link is opened.
  const PLACES = [
    { name: 'Cocolia', cat: 'stay', lat: 15.66748, lng: -96.56338,
      note: 'Our hotel, and home base for the wedding', q: 'Cocolia Hotel, Mazunte, Oaxaca' },

    { name: 'Punta Cometa', cat: 'do', lat: 15.66006, lng: -96.55703,
      note: 'Sunset hike to the southern tip of Oaxaca, where Logan proposed to Stephanie', q: 'Punta Cometa, Mazunte, Oaxaca' },
    { name: 'Playa Mermejita', cat: 'do', lat: 15.66404, lng: -96.56633,
      note: 'Wild beach just west of Punta Cometa', q: 'Playa Mermejita, Mazunte, Oaxaca' },
    { name: 'Laguna de Manialtepec', cat: 'do', lat: 15.94105, lng: -97.19003,
      note: 'Bioluminescence tour, about 1½ hours from Mazunte', q: 'Laguna de Manialtepec, Oaxaca' },
    { name: 'Lagunas de Chacahua', cat: 'do', lat: 16.00193, lng: -97.71998,
      note: 'Day trip: mangrove lagoons, a bird sanctuary and a remote beach village, about 3 hours each way', q: 'Parque Nacional Lagunas de Chacahua, Oaxaca' },

    { name: 'Ícaro Café', cat: 'eat', lat: 15.66652, lng: -96.55492,
      note: 'Breakfast · arrive early for the chocolatín', q: 'Ícaro Café, Mazunte, Oaxaca' },
    { name: 'Maralto', cat: 'eat', lat: 15.66682, lng: -96.55093,
      note: 'Breakfast · second-best chocolatín, besos de guayaba, chilaquiles', q: 'Maralto Panadería, Mazunte, Oaxaca' },
    { name: 'La Mora Posada', cat: 'eat', lat: 15.66573, lng: -96.54333,
      note: 'Breakfast · San Agustinillo', q: 'La Mora Posada, San Agustinillo, Oaxaca' },
    { name: 'Órale Café', cat: 'eat', lat: 15.66494, lng: -96.52511,
      note: 'Breakfast · Zipolite', q: 'Órale Café, Zipolite, Oaxaca' },
    { name: 'El Alquimista', cat: 'eat', also: 'drink', lat: 15.66355, lng: -96.52361,
      note: 'Brunch and cocktails · on the beach in Zipolite', q: 'El Alquimista, Zipolite, Oaxaca' },
    { name: 'Umami', cat: 'eat', lat: 15.66567, lng: -96.54381,
      note: 'Lunch · get the crispy bowl', q: 'Umami, San Agustinillo, Oaxaca' },
    { name: 'La Negra', cat: 'eat', lat: null, lng: null,
      note: 'Lunch · tacos and salsas', q: 'La Negra, Mazunte, Oaxaca' },
    { name: 'La Ola', cat: 'eat', lat: 15.66634, lng: -96.54669,
      note: 'Lunch · ceviches and tostadas, on San Agustinillo beach', q: 'La Ola, San Agustinillo, Oaxaca' },
    { name: 'El Armadillo', cat: 'eat', lat: 15.66665, lng: -96.55612,
      note: 'Dinner · vegan', q: 'El Armadillo, Mazunte, Oaxaca' },
    { name: 'Falafel el Loco', cat: 'eat', lat: 15.66833, lng: -96.55697,
      note: 'Dinner', q: 'Falafel el Loco, Mazunte, Oaxaca' },
    { name: 'El Chiringuito', cat: 'eat', also: 'drink', lat: 15.66185, lng: -96.56012,
      note: 'Dinner and drinks · get the octopus or solomillo; on Mermejita', q: 'El Chiringuito, Playa Mermejita, Mazunte, Oaxaca' },
    { name: 'El Navegante', cat: 'eat', lat: 15.66556, lng: -96.54419,
      note: 'Dinner · San Agustinillo', q: 'El Navegante, San Agustinillo, Oaxaca' },
    { name: 'Arena Negra', cat: 'eat', lat: 15.66788, lng: -96.55518,
      note: 'Dinner · fish soup', q: 'Arena Negra, Mazunte, Oaxaca' },
    { name: 'Cenzontle', cat: 'eat', lat: 15.66694, lng: -96.55587,
      note: 'Dinner · if you crave a burger', q: 'Cenzontle, Mazunte, Oaxaca' },

    { name: 'La Bodega', cat: 'drink', lat: 15.66504, lng: -96.55586,
      note: 'Drinks', q: 'La Bodega, Mazunte, Oaxaca' },
    { name: 'Kombuchería Bar el Pasatiempo', cat: 'drink', lat: null, lng: null,
      note: 'Drinks · San Agustinillo', q: 'Pasatiempo kombucha, San Agustinillo, Oaxaca' },
    { name: 'Mezcalería Gota Gorda', cat: 'drink', lat: 15.66425, lng: -96.52242,
      note: 'Drinks · small-batch mezcal in Zipolite', q: 'Gota Gorda mezcal, Zipolite, Oaxaca' },

    { name: 'Puerto Escondido airport (PXM)', cat: 'travel', lat: 15.87631, lng: -97.08862,
      note: 'About an hour by taxi to Mazunte', q: 'Aeropuerto Internacional de Puerto Escondido' },
    { name: 'Huatulco airport (HUX)', cat: 'travel', lat: 15.77598, lng: -96.25870,
      note: 'About 45 minutes by taxi to Mazunte', q: 'Aeropuerto Internacional de Bahías de Huatulco' }
  ];

  const TOWNS = [
    // Set down on Mazunte beach, clear of the pins in the village.
    { name: 'Mazunte', lat: 15.6658, lng: -96.5530 },
    { name: 'San Agustinillo', lat: 15.6661, lng: -96.5446 },
    { name: 'Zipolite', lat: 15.6642, lng: -96.5197 }
  ];

  // Sea creatures drawn by Stephanie (from her Flying Seed map),
  // in the water off Mermejita, Mazunte, San Agustinillo and Zipolite.
  const CREATURES = [
    { id: 'mermaid', lat: 15.6592, lng: -96.5650, size: 1.1 },  // off Mermejita
    { id: 'fish2',   lat: 15.6612, lng: -96.5525, size: 0.8 },  // off Mazunte
    { id: 'octopus', lat: 15.6600, lng: -96.5440, size: 1.0 },  // off San Agustinillo
    { id: 'fish',    lat: 15.6585, lng: -96.5275, size: 0.8 },  // off Zipolite
    { id: 'clam',    lat: 15.6580, lng: -96.5225, size: 0.7 }   // off Zipolite
  ];

  // Basemap colors, from the palette in style.css.
  const PAL = {
    land:    '#F5EDE0',
    green:   '#E6E3CC',
    town:    '#EFE4D2',
    water:   '#C5D3D6',
    road:    '#E3D2B6',
    roadMaj: '#DCC6A5',
    build:   '#E8D9C1',
    line:    '#C8B79E',
    label:   '#7A6A5F',
    halo:    '#FAF6EE'
  };

  const gmaps = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const inCat = (p, cat) => cat === 'all' || p.cat === cat || p.also === cat;

  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [-96.5450, 15.6662],
    zoom: 14,
    cooperativeGestures: true,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  // Recolor the positron layers in place; hide clutter we don't need
  // (road names, shields, small place labels; our towns get their own).
  const HIDE = /^(highway-name|highway-shield|road_shield|label_other|label_village|label_state|label_country|boundary|railway)/;
  function recolor() {
    map.getStyle().layers.forEach(l => {
      const id = l.id;
      const set = (prop, val) => { try { map.setPaintProperty(id, prop, val); } catch (_) {} };
      if (HIDE.test(id)) { map.setLayoutProperty(id, 'visibility', 'none'); return; }
      if (l.type === 'background') set('background-color', PAL.land);
      else if (id === 'water') set('fill-color', PAL.water);
      else if (id === 'waterway') set('line-color', PAL.water);
      else if (id === 'park' || id.startsWith('landcover')) set('fill-color', PAL.green);
      else if (id === 'landuse_residential') set('fill-color', PAL.town);
      else if (id === 'building') { set('fill-color', PAL.build); set('fill-outline-color', PAL.build); }
      else if (id.startsWith('aeroway')) {
        set(l.type === 'fill' ? 'fill-color' : 'line-color', PAL.road);
      }
      else if (l.type === 'line' && /major|motorway/.test(id)) set('line-color', PAL.roadMaj);
      else if (l.type === 'line') set('line-color', PAL.road);
      else if (l.type === 'symbol') {
        set('text-color', PAL.label);
        set('text-halo-color', PAL.halo);
        set('text-halo-width', 1.2);
      }
    });
  }

  // Pins and town names are drawn as map layers rather than floating
  // page elements, so they stay locked to the map while it moves.
  const pinned = PLACES.filter(p => p.lat != null);
  const placesData = {
    type: 'FeatureCollection',
    features: pinned.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { i, cat: p.cat, also: p.also || '', color: CATS[p.cat].color }
    }))
  };
  const townsData = {
    type: 'FeatureCollection',
    features: TOWNS.map(t => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: { name: t.name }
    }))
  };

  // The drawings are pre-rendered PNGs (images/sea/*.png, from her
  // SVGs) at twice their display size, so they stay crisp on
  // high-density screens and load the same way in every browser.
  async function loadCreature(id) {
    const res = await map.loadImage('images/sea/' + id + '.png');
    return res.data;
  }

  async function addCreatures() {
    const ids = [...new Set(CREATURES.map(c => c.id))];
    const images = await Promise.all(ids.map(loadCreature));
    ids.forEach((id, i) => { if (!map.hasImage(id)) map.addImage(id, images[i], { pixelRatio: 2 }); });
    map.addSource('creatures', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: CREATURES.map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          properties: { id: c.id, size: c.size }
        }))
      }
    });
    map.addLayer({
      id: 'creatures',
      type: 'symbol',
      source: 'creatures',
      minzoom: 11,
      layout: {
        'icon-image': ['get', 'id'],
        'icon-size': ['interpolate', ['linear'], ['zoom'],
          11, ['*', ['get', 'size'], 0.3],
          14, ['*', ['get', 'size'], 0.75],
          16, ['*', ['get', 'size'], 1.1]],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    }, 'places-halo');
  }

  function addLayers() {
    map.addSource('towns', { type: 'geojson', data: townsData });
    map.addLayer({
      id: 'towns',
      type: 'symbol',
      source: 'towns',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.24,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-allow-overlap': true
      },
      paint: { 'text-color': '#4A423D', 'text-halo-color': PAL.halo, 'text-halo-width': 1.5 }
    });

    map.addSource('places', { type: 'geojson', data: placesData });
    map.addLayer({
      id: 'places-halo',
      type: 'circle',
      source: 'places',
      filter: ['==', ['get', 'cat'], 'stay'],
      paint: { 'circle-radius': 14, 'circle-color': '#B85B3F', 'circle-opacity': 0.22 }
    });
    map.addLayer({
      id: 'places',
      type: 'circle',
      source: 'places',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'cat'], 'stay'], 9, 7],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': PAL.halo
      }
    });

    map.on('click', 'places', e => {
      const p = pinned[e.features[0].properties.i];
      new maplibregl.Popup({ className: 'map-card', closeButton: false, offset: 12, maxWidth: '260px' })
        .setLngLat([p.lng, p.lat])
        .setHTML(
          '<span class="map-card-cat">' + CATS[p.cat].label + '</span>' +
          '<strong class="map-card-name">' + p.name + '</strong>' +
          '<span class="map-card-note">' + p.note + '</span>' +
          '<a class="map-card-link" href="' + gmaps(p.q) + '" target="_blank" rel="noopener">Open in Google Maps &rarr;</a>'
        )
        .addTo(map);
    });
    map.on('mouseenter', 'places', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'places', () => { map.getCanvas().style.cursor = ''; });

    applyFilter();
    addCreatures().catch(err => console.warn('Sea creatures not drawn:', err));
  }

  // "3 Sisters" frames the coast from Mermejita to the far end of
  // Zipolite; the far-flung day trips and airports come into frame
  // through their own filters.
  const COAST = [[-96.5715, 15.6565], [-96.5085, 15.6695]];
  let current = 'all';

  function applyFilter() {
    if (!map.getLayer('places')) return;
    const f = current === 'all' ? null
      : ['any', ['==', ['get', 'cat'], current], ['==', ['get', 'also'], current]];
    map.setFilter('places', f);
    map.setFilter('places-halo', current === 'all' || current === 'stay'
      ? ['==', ['get', 'cat'], 'stay'] : ['==', ['get', 'cat'], '__none__']);
  }

  function show(cat, animate = true) {
    current = cat;
    applyFilter();
    const bounds = new maplibregl.LngLatBounds();
    if (cat === 'all') COAST.forEach(c => bounds.extend(c));
    else pinned.filter(p => inCat(p, cat)).forEach(p => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: animate ? 800 : 0 });
    document.querySelectorAll('.map-filters button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.cat === cat));
    });
    renderList(cat);
  }

  function renderList(cat) {
    const list = document.querySelector('.map-list');
    if (!list) return;
    const order = ['stay', 'do', 'eat', 'drink', 'travel'].filter(c => cat === 'all' || c === cat);
    list.innerHTML = order.map(c => {
      const items = PLACES.filter(p => p.cat === c || p.also === c);
      return '<div><h3><i style="background:' + CATS[c].color + '"></i>' + CATS[c].label + '</h3><ul>' +
        items.map(p =>
          '<li><a href="' + gmaps(p.q) + '" target="_blank" rel="noopener">' + p.name + '</a>' +
          '<span>' + p.note + (p.lat == null ? ' · not on the map yet' : '') + '</span></li>'
        ).join('') + '</ul></div>';
    }).join('');
  }

  const filters = document.querySelector('.map-filters');
  filters.innerHTML = ['all', 'stay', 'do', 'eat', 'drink', 'travel'].map(c =>
    '<button type="button" data-cat="' + c + '">' +
    (c === 'all' ? '3 Sisters' : '<i style="background:' + CATS[c].color + '"></i>' + CATS[c].label) +
    '</button>'
  ).join('');
  filters.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) show(b.dataset.cat);
  });

  map.on('style.load', () => { recolor(); addLayers(); });
  show('all', false);
})();
