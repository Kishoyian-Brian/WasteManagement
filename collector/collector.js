/**
 * Collector dashboard — Rictei Smart Waste
 * Assigned reports, map view, route calculation, mark collected.
 * Depends: ../js/data.js (WasteData)
 */
(function() {
  'use strict';

  var mapInstance = null;
  var markers = [];
  var routeControl = null;
  var collectorSearch = '';
  var collectorSort = 'newest';

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    var d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function initMap() {
    if (mapInstance) return;
    
    // Tharaka Nithi County center
    mapInstance = L.map('collection-map', {
      zoomControl: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true
    }).setView([-0.3, 37.8], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstance);

    // Ensure map resizes properly on mobile
    setTimeout(function() {
      if (mapInstance) {
        mapInstance.invalidateSize();
      }
    }, 100);
  }

  var reportMarkers = {}; // Store report data with markers

  function renderMap(approvedReports) {
    if (!mapInstance) {
      initMap();
    }

    // Clear existing markers
    markers.forEach(function(marker) {
      mapInstance.removeLayer(marker);
    });
    markers = [];
    reportMarkers = {};

    if (approvedReports.length === 0) return;

    var bounds = [];
    var geocodePromises = [];

    approvedReports.forEach(function(r) {
      var coords = null;
      if (r.lat && r.lng) {
        coords = [r.lat, r.lng];
        addMarkerToMap(coords[0], coords[1], r);
        bounds.push(coords);
      } else if (r.location) {
        // Try to geocode
        geocodePromises.push(
          new Promise(function(resolve) {
            geocodeLocation(r.location, function(lat, lng) {
              if (lat && lng) {
                r.lat = lat;
                r.lng = lng;
                addMarkerToMap(lat, lng, r);
                bounds.push([lat, lng]);
              }
              resolve();
            });
          })
        );
      }
    });

    // Wait for geocoding to complete, then fit bounds
    Promise.all(geocodePromises).then(function() {
      if (bounds.length > 0) {
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    });
  }

  function addMarkerToMap(lat, lng, report) {
    var isUrgent = (report.fillLevel || 0) >= 80;
    var color = isUrgent ? '#c0392b' : (report.fillLevel || 0) >= 50 ? '#d68910' : '#27ae60';
    var iconSize = isUrgent ? 30 : 25;

    var marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background: ' + color + '; width: ' + iconSize + 'px; height: ' + iconSize + 'px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [iconSize, iconSize],
        iconAnchor: [iconSize / 2, iconSize / 2]
      })
    }).addTo(mapInstance);

    marker.bindPopup(
      '<div style="min-width: 200px;">' +
        '<strong>' + escapeHtml(report.location || 'Unknown') + '</strong><br>' +
        '<small>Report #' + escapeHtml((report.id || '').slice(1, 9)) + '</small><br>' +
        'Type: ' + escapeHtml(report.wasteType || 'N/A') + '<br>' +
        'Fill: ' + (report.fillLevel || 0) + '%<br>' +
        '<button onclick="window.collectorMarkCollected(\'' + escapeHtml(report.id) + '\')" style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; background: var(--status-ok); color: white; border: none; border-radius: 4px; cursor: pointer;">Mark Collected</button>' +
      '</div>'
    );

    marker.reportId = report.id;
    markers.push(marker);
  }

  function geocodeLocation(locationName, callback) {
    var query = locationName + ', Tharaka Nithi County, Kenya';
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1', {
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.length > 0) {
          callback(parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
          callback(null, null);
        }
      })
      .catch(function() {
        callback(null, null);
      });
  }

  function calculateRoute(approvedReports) {
    if (!mapInstance) initMap();

    // Clear existing route
    if (routeControl) {
      mapInstance.removeLayer(routeControl);
      routeControl = null;
    }

    // Get waypoints from reports (use geocoded locations if available)
    var waypoints = [];
    approvedReports.forEach(function(r) {
      if (r.lat && r.lng) {
        waypoints.push([r.lat, r.lng]);
      }
    });

    if (waypoints.length === 0) {
      alert('No locations with coordinates available. The map will geocode locations automatically. Please wait a moment and try again.');
      return;
    }

    if (waypoints.length === 1) {
      alert('Only one location available. No route needed.');
      return;
    }

    // Create optimized route
    var sortedWaypoints = optimizeRoute(waypoints);
    
    // Draw route line
    routeControl = L.polyline(sortedWaypoints, {
      color: '#0d5c3d',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(mapInstance);

    // Add route info popup
    var totalDistance = calculateTotalDistance(sortedWaypoints);
    var routeInfo = L.popup()
      .setLatLng(sortedWaypoints[0])
      .setContent(
        '<div style="min-width: 200px;">' +
        '<strong>Optimized Collection Route</strong><br>' +
        '<strong>' + sortedWaypoints.length + '</strong> locations<br>' +
        'Approx. distance: <strong>' + totalDistance.toFixed(1) + ' km</strong><br>' +
        '<small>Follow the route line on the map</small>' +
        '</div>'
      )
      .openOn(mapInstance);

    // Create Google Maps link with all waypoints
    var googleMapsUrl = 'https://www.google.com/maps/dir/';
    sortedWaypoints.forEach(function(wp, idx) {
      if (idx > 0) googleMapsUrl += '/';
      googleMapsUrl += wp[0] + ',' + wp[1];
    });
    
    // Add button to open in Google Maps
    setTimeout(function() {
      var btn = document.createElement('a');
      btn.href = googleMapsUrl;
      btn.target = '_blank';
      btn.className = 'btn btn-sm';
      btn.style.cssText = 'margin-top: 0.5rem; display: inline-block; background: var(--primary); color: white; text-decoration: none; padding: 0.4rem 0.8rem; border-radius: 4px;';
      btn.textContent = 'Open in Google Maps';
      var popupContent = routeInfo.getContent();
      routeInfo.setContent(popupContent + btn.outerHTML);
    }, 100);

    document.getElementById('btn-clear-route').style.display = 'inline-block';
  }

  function optimizeRoute(waypoints) {
    // Simple nearest-neighbor algorithm for route optimization
    if (waypoints.length <= 1) return waypoints;
    
    var optimized = [];
    var remaining = waypoints.slice();
    var current = remaining.shift();
    optimized.push(current);

    while (remaining.length > 0) {
      var nearest = null;
      var nearestIndex = -1;
      var minDist = Infinity;

      remaining.forEach(function(point, idx) {
        var dist = getDistance(current, point);
        if (dist < minDist) {
          minDist = dist;
          nearest = point;
          nearestIndex = idx;
        }
      });

      if (nearest) {
        optimized.push(nearest);
        remaining.splice(nearestIndex, 1);
        current = nearest;
      }
    }

    return optimized;
  }

  function getDistance(point1, point2) {
    // Haversine formula for distance between two lat/lng points
    var R = 6371; // Earth radius in km
    var dLat = (point2[0] - point1[0]) * Math.PI / 180;
    var dLon = (point2[1] - point1[1]) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateTotalDistance(waypoints) {
    var total = 0;
    for (var i = 0; i < waypoints.length - 1; i++) {
      total += getDistance(waypoints[i], waypoints[i + 1]);
    }
    return total;
  }

  function render() {
    var approved = WasteData.getApproved();
    var collected = WasteData.getCollected();

    // Update stats
    var statAssigned = document.getElementById('stat-assigned');
    var statCompleted = document.getElementById('stat-completed');
    var statUrgent = document.getElementById('stat-urgent');
    var statTotalCollected = document.getElementById('stat-total-collected');
    
    var urgentCount = approved.filter(function(r) { return (r.fillLevel || 0) >= 80; }).length;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayCollected = collected.filter(function(r) {
      if (!r.collectedAt) return false;
      return new Date(r.collectedAt) >= today;
    }).length;

    if (statAssigned) statAssigned.textContent = approved.length;
    if (statCompleted) statCompleted.textContent = todayCollected;
    if (statUrgent) statUrgent.textContent = urgentCount;
    if (statTotalCollected) statTotalCollected.textContent = collected.length;

    // Show notification banner
    var banner = document.getElementById('notification-banner');
    if (banner) banner.style.display = approved.length > 0 ? 'flex' : 'none';

    // Filter and sort approved reports
    var filtered = approved.slice();
    if (collectorSearch) {
      var searchLower = collectorSearch.toLowerCase();
      filtered = filtered.filter(function(r) {
        var id = (r.id || '').toLowerCase();
        var location = (r.location || '').toLowerCase();
        return id.includes(searchLower) || location.includes(searchLower);
      });
    }

    if (collectorSort === 'newest') {
      filtered.sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else if (collectorSort === 'oldest') {
      filtered.sort(function(a, b) {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    } else if (collectorSort === 'fill-high') {
      filtered.sort(function(a, b) {
        return (b.fillLevel || 0) - (a.fillLevel || 0);
      });
    } else if (collectorSort === 'location') {
      filtered.sort(function(a, b) {
        return (a.location || '').localeCompare(b.location || '');
      });
    }

    // Render assigned reports table
    renderAssignedTable(filtered);

    // Render collected table
    renderCollectedTable(collected.slice(0, 20));

    // Update map if visible
    var mapContainer = document.getElementById('collection-map-container');
    if (mapContainer && mapContainer.style.display !== 'none') {
      renderMap(filtered);
    }
  }

  function renderAssignedTable(reports) {
    var tbody = document.getElementById('assigned-list');
    var tableEl = document.getElementById('assigned-table');
    var emptyEl = document.getElementById('assigned-empty');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = reports.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = reports.length === 0 ? 'none' : 'table';

    reports.forEach(function(r) {
      var tr = document.createElement('tr');
      var isUrgent = (r.fillLevel || 0) >= 80;
      var fillClass = isUrgent ? 'fill-urgent' : (r.fillLevel || 0) >= 50 ? 'fill-warning' : 'fill-ok';
      
      tr.innerHTML =
        '<td><a href="#" class="report-id-link" data-id="' + escapeHtml(r.id) + '">#' + escapeHtml((r.id || '').slice(1, 9)) + '</a></td>' +
        '<td>' + escapeHtml(r.location || 'Unknown') + (r.lat && r.lng ? ' <a href="https://www.google.com/maps?q=' + r.lat + ',' + r.lng + '" target="_blank" style="color: var(--primary); text-decoration: none;">📍</a>' : '') + '</td>' +
        '<td>' + escapeHtml(r.wasteType || 'N/A') + '</td>' +
        '<td><span class="fill-badge ' + fillClass + '">' + (r.fillLevel || 0) + '%</span>' + (isUrgent ? ' <span class="urgent-indicator">⚠</span>' : '') + '</td>' +
        '<td>' + formatDate(r.createdAt) + '</td>' +
        '<td class="table-actions">' +
          '<button type="button" class="btn btn-sm btn-view" data-id="' + escapeHtml(r.id) + '">View</button>' +
          (r.lat && r.lng ? '<a href="https://www.google.com/maps/dir/?api=1&destination=' + r.lat + ',' + r.lng + '" target="_blank" class="btn btn-sm" style="background: var(--primary); color: white; text-decoration: none; margin-left: 0.25rem;">Directions</a>' : '') +
          '<button type="button" class="btn btn-sm btn-collect" data-id="' + escapeHtml(r.id) + '">Mark Collected</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    // Attach event listeners
    tbody.querySelectorAll('.btn-collect').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.markCollected(btn.dataset.id)) render();
      });
    });
  }

  function renderCollectedTable(collected) {
    var tbody = document.getElementById('collected-list');
    var tableEl = document.getElementById('collected-table');
    var emptyEl = document.getElementById('collected-empty');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = collected.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = collected.length === 0 ? 'none' : 'table';

    collected.forEach(function(r) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>#' + escapeHtml((r.id || '').slice(1, 9)) + '</td>' +
        '<td>' + escapeHtml(r.location || 'Unknown') + '</td>' +
        '<td>' + escapeHtml(r.wasteType || 'N/A') + '</td>' +
        '<td>' + formatDate(r.collectedAt) + '</td>';
      tbody.appendChild(tr);
    });
  }

  // Map toggle button
  var btnShowMap = document.getElementById('btn-show-map');
  var mapContainer = document.getElementById('collection-map-container');
  if (btnShowMap && mapContainer) {
    btnShowMap.addEventListener('click', function() {
      if (mapContainer.style.display === 'none') {
        mapContainer.style.display = 'block';
        initMap();
        // Resize map after showing
        setTimeout(function() {
          if (mapInstance) {
            mapInstance.invalidateSize();
          }
        }, 200);
        render();
        btnShowMap.textContent = '📋 View as Table';
        var btnRoute = document.getElementById('btn-calculate-route');
        if (btnRoute) btnRoute.style.display = 'inline-block';
      } else {
        mapContainer.style.display = 'none';
        btnShowMap.textContent = '🗺️ View on Map';
        var btnRoute = document.getElementById('btn-calculate-route');
        var btnClear = document.getElementById('btn-clear-route');
        if (btnRoute) btnRoute.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
      }
    });
  }

  // Route calculation
  var btnCalculateRoute = document.getElementById('btn-calculate-route');
  if (btnCalculateRoute) {
    btnCalculateRoute.addEventListener('click', function() {
      var approved = WasteData.getApproved();
      if (approved.length === 0) {
        alert('No assigned reports to calculate route for.');
        return;
      }
      calculateRoute(approved);
    });
  }

  // Clear route
  var btnClearRoute = document.getElementById('btn-clear-route');
  if (btnClearRoute) {
    btnClearRoute.addEventListener('click', function() {
      if (routeControl && mapInstance) {
        mapInstance.removeControl(routeControl);
        routeControl = null;
      }
      btnClearRoute.style.display = 'none';
    });
  }

  // Search and sort
  var searchInput = document.getElementById('collector-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      collectorSearch = this.value.trim();
      render();
    });
  }

  var sortSelect = document.getElementById('collector-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      collectorSort = this.value;
      render();
    });
  }

  // Expose mark collected function for map popups
  window.collectorMarkCollected = function(id) {
    if (WasteData.markCollected(id)) {
      render();
      if (mapInstance) {
        mapInstance.closePopup();
      }
    }
  };

  render();
})();
