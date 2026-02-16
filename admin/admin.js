/**
 * Admin dashboard — Rictei Smart Waste
 * Side nav, panels, pending reports, heat map, add drive, collectors.
 * Depends: ../js/data.js (WasteData)
 */
(function() {
  'use strict';

  function showPanel(panelId) {
    document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.sidebar-link').forEach(function(a) { a.classList.remove('active'); });
    var panel = document.getElementById('panel-' + panelId);
    var link = document.querySelector('.sidebar-link[data-panel="' + panelId + '"]');
    if (panel) panel.classList.add('active');
    if (link) link.classList.add('active');
  }

  document.querySelectorAll('.sidebar-link').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      showPanel(a.dataset.panel);
    });
  });

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderHeatMap() {
    var locations = WasteData.getCollectionLocations();
    var list = document.getElementById('heatmap-list');
    var empty = document.getElementById('heatmap-empty');
    if (!list) return;
    list.innerHTML = '';
    if (locations.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    var maxCount = Math.max.apply(null, locations.map(function(l) { return l.count; })) || 1;
    locations.forEach(function(item) {
      var pct = Math.round((item.count / maxCount) * 100);
      var el = document.createElement('div');
      el.className = 'heatmap-item';
      el.innerHTML = '<span class="heatmap-label">' + escapeHtml(item.location) + '</span>' +
        '<div class="heatmap-bar-wrap"><div class="heatmap-bar" style="width:' + pct + '%;"></div></div>' +
        '<span class="heatmap-count">' + item.count + ' collection' + (item.count !== 1 ? 's' : '') + '</span>';
      list.appendChild(el);
    });
  }

  function renderAllReports() {
    var all = WasteData.getAll();
    var list = document.getElementById('all-reports-list');
    if (!list) return;
    list.innerHTML = '';
    all.forEach(function(r) {
      var card = document.createElement('div');
      card.className = 'report-card report-card-done';
      card.innerHTML = '<div class="report-card-header"><span class="report-id">#' + (r.id || '').slice(1, 9) + '</span><span class="report-badge ' + r.status + '">' + r.status + '</span></div>' +
        '<div class="report-card-body"><p><strong>' + escapeHtml(r.name || 'Anonymous') + '</strong> — ' + escapeHtml(r.location || 'Unknown') + '</p>' +
        '<p class="report-meta">Type: ' + (r.wasteType || 'N/A') + ' · Fill: ' + (r.fillLevel || 0) + '%</p></div>';
      list.appendChild(card);
    });
    if (all.length === 0) list.innerHTML = '<p class="empty-state">No reports yet.</p>';
  }

  function renderCollectors() {
    var collectors = WasteData.getCollectors();
    var list = document.getElementById('collectors-list');
    var select = document.getElementById('drive-collector');
    if (list) list.innerHTML = '';
    if (select) {
      select.innerHTML = '<option value="">— Select —</option>';
      collectors.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.username;
        opt.textContent = c.username;
        select.appendChild(opt);
      });
    }
    if (list) {
      collectors.forEach(function(c) {
        var el = document.createElement('div');
        el.className = 'collector-item';
        el.textContent = c.username;
        list.appendChild(el);
      });
      if (collectors.length === 0) list.innerHTML = '<p class="empty-state">No collectors registered.</p>';
    }
  }

  function render() {
    var all = WasteData.getAll();
    var pending = WasteData.getPending();
    var approved = WasteData.getApproved();
    var collected = WasteData.getCollected();

    var statTotal = document.getElementById('stat-total');
    var statPending = document.getElementById('stat-pending');
    var statApproved = document.getElementById('stat-approved');
    var statCollected = document.getElementById('stat-collected');
    if (statTotal) statTotal.textContent = all.length;
    if (statPending) statPending.textContent = pending.length;
    if (statApproved) statApproved.textContent = approved.length;
    if (statCollected) statCollected.textContent = collected.length;

    var list = document.getElementById('pending-list');
    var empty = document.getElementById('pending-empty');
    if (empty) empty.style.display = pending.length ? 'none' : 'block';

    if (list) {
      list.querySelectorAll('.report-card').forEach(function(el) { el.remove(); });
      pending.forEach(function(r) {
        var card = document.createElement('div');
        card.className = 'report-card';
        card.dataset.id = r.id;
        card.innerHTML = '<div class="report-card-header"><span class="report-id">#' + r.id.slice(1, 9) + '</span><span class="report-badge pending">Pending</span></div>' +
          '<div class="report-card-body"><p><strong>' + (r.name || 'Anonymous') + '</strong> — ' + (r.location || 'Unknown') + '</p>' +
          '<p class="report-meta">Type: ' + (r.wasteType || 'N/A') + ' · Fill: ' + (r.fillLevel || 0) + '%</p></div>' +
          '<div class="report-card-actions"><button class="btn btn-approve" data-id="' + r.id + '">Approve</button><button class="btn btn-reject" data-id="' + r.id + '">Reject</button></div>';
        list.appendChild(card);
      });

      list.querySelectorAll('.btn-approve').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (WasteData.approve(btn.dataset.id)) render();
        });
      });
      list.querySelectorAll('.btn-reject').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (WasteData.reject(btn.dataset.id)) render();
        });
      });
    }

    renderHeatMap();
    renderAllReports();
    renderCollectors();
  }

  var addDriveForm = document.getElementById('add-drive-form');
  if (addDriveForm) {
    addDriveForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = document.getElementById('drive-name').value.trim();
      var zone = document.getElementById('drive-zone').value.trim();
      var schedule = document.getElementById('drive-schedule').value;
      var collector = document.getElementById('drive-collector').value;
      var msg = document.getElementById('drive-message');
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = 'Drive "' + name + '" created for ' + (zone || 'general area') + ' (' + schedule + ')' + (collector ? ', assigned to ' + collector : '') + '.';
        msg.style.color = 'var(--status-ok)';
      }
    });
  }

  render();
})();
