document.addEventListener("alpine:init", () => {
  Alpine.data("petaApp", () => ({
    map: null,
    digitasiLayer: null,
    baseZoomLevel: null,
    mapZoomPercent: 100,
    layoutTitle: '',
    digitasiLayerName: '',
    isBuffering: false,
    isBufferVisible: false,
    isRouting: false,
    isRouteVisible: false,
    analysisLayer: null,
    routingControl: null,

    initMap() {
      this.map = L.map('map').setView([-6.9175, 107.6191], 13);
      this.map.attributionControl.setPrefix('');

      this.baseLayers = {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }),
        esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }),
        google: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '© Google' })
      };
      this.baseLayers.osm.addTo(this.map);

      this.digitasiLayer = L.geoJSON().addTo(this.map);

      this.map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawPolygon: true,
        drawPolyline: true,
        editMode: true,
        dragMode: true,
        removalMode: true
      });

      this.map.on('pm:create', (e) => {
        const layer = e.layer;

        if (layer instanceof L.Marker) {
          layer.on('click', () => {
            if (this.isBuffering) this.createBuffer(layer);
            if (this.isRouting) this.calculateRoute(layer);
          });
        }

        const form = document.createElement('div');
        form.innerHTML = `
          <label style="font-size:12px;">Nama Layer</label>
          <input id="layer-name" type="text" value="Layer Baru"
              style="width:100%; margin-bottom:4px; font-size:12px; padding:2px;">
          <label style="font-size:12px;">Warna</label>
          <input id="layer-color" type="color" value="#ff0000"
              style="width:100%; height:30px; margin-bottom:6px;">
          <button id="save-layer" style="width:100%; background:#2563eb; color:#fff; border:none; padding:4px; cursor:pointer; font-size:12px;">
            Simpan
          </button>
        `;

        L.popup()
          .setLatLng(layer.getLatLng ? layer.getLatLng() : layer.getBounds().getCenter())
          .setContent(form)
          .openOn(this.map);

        form.querySelector('#save-layer').addEventListener('click', () => {
          const nama = form.querySelector('#layer-name').value;
          const warna = form.querySelector('#layer-color').value;

          layer.feature = {
            type: "Feature",
            properties: { layerName: nama, color: warna },
            geometry: layer.toGeoJSON().geometry
          };

          if (layer.setStyle) layer.setStyle({ color: warna, fillColor: warna });
          this.digitasiLayer.addLayer(layer);
          this.map.closePopup();
        });
      });
    },

    changeBasemap(type) {
      Object.values(this.baseLayers).forEach(l => this.map.removeLayer(l));
      this.baseLayers[type].addTo(this.map);
    },

    applyMapZoom() {
      if (this.baseZoomLevel === null) this.baseZoomLevel = this.map.getZoom();
      const scale = this.mapZoomPercent / 100;
      const newZoom = this.baseZoomLevel + Math.log2(scale);
      this.map.setZoom(newZoom);
    },

    // BUFFER
    startBufferMode() {
      this.isBuffering = true;
      this.isRouting = false;
      alert('Klik marker untuk membuat buffer');
    },
    cancelBufferMode() { this.isBuffering = false; },
    createBuffer(marker) {
      const radius = prompt('Masukkan radius (meter):', '500');
      if (!radius) return;
      if (this.analysisLayer) this.map.removeLayer(this.analysisLayer);

      const geo = marker.toGeoJSON();
      const buffered = turf.buffer(geo, parseFloat(radius), { units: 'meters' });

      this.analysisLayer = L.geoJSON(buffered, {
        style: { color: '#00FFFF', fillColor: '#00FFFF', fillOpacity: 0.3 }
      }).addTo(this.map);

      this.isBufferVisible = true;
      this.isBuffering = false;
    },
    clearBufferAnalysis() {
      if (this.analysisLayer) this.map.removeLayer(this.analysisLayer);
      this.isBufferVisible = false;
    },

    // ROUTING
    startRoutingMode() {
      this.isRouting = true;
      this.isBuffering = false;
      alert('Klik marker untuk membuat rute');
    },
    cancelRoutingMode() { this.isRouting = false; },
    calculateRoute(marker) {
      if (!navigator.geolocation) {
        alert('Geolocation tidak tersedia');
        return;
      }

      navigator.geolocation.getCurrentPosition((pos) => {
        const start = L.latLng(pos.coords.latitude, pos.coords.longitude);
        const dest = marker.getLatLng();

        if (this.routingControl) this.map.removeControl(this.routingControl);

        this.routingControl = L.Routing.control({
          waypoints: [start, dest],
          routeWhileDragging: false,
          addWaypoints: false,
          showAlternatives: false
        }).addTo(this.map);

        this.isRouteVisible = true;
        this.isRouting = false;
      });
    },
    clearRoutingAnalysis() {
      if (this.routingControl) this.map.removeControl(this.routingControl);
      this.isRouteVisible = false;
    },

    saveLayoutInput() {
      sessionStorage.setItem('layoutMeta', JSON.stringify({
        layoutTitle: this.layoutTitle,
        digitasiLayerName: this.digitasiLayerName
      }));
      alert('✅ Input disimpan');
    },

    openMapLayout() {
      const center = this.map.getCenter();
      const drawnGeo = this.digitasiLayer.toGeoJSON();
      const meta = JSON.parse(sessionStorage.getItem('layoutMeta') || '{}');

      const legendHTML = drawnGeo.features.map(f => {
        const name = f.properties?.layerName || 'Tanpa Nama';
        const color = f.properties?.color || '#3388ff';
        return `<p><span style="background:${color};width:10px;height:10px;display:inline-block;margin-right:5px;border:1px solid #333;"></span>${name}</p>`;
      }).join('');

      sessionStorage.setItem("layoutData", JSON.stringify({
        title: meta.layoutTitle || "Peta Layout",
        center: [center.lat, center.lng],
        zoom: this.map.getZoom(),
        drawnItems: drawnGeo,
        legendHTML
      }));

      window.open("layout.html", "_blank");
    }
  }));
});
