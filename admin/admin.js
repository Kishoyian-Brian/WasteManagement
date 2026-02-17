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

  var allReportsFilter = 'all';
  var allReportsSearch = '';
  var allReportsSort = 'newest';

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    var d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderAllReports() {
    var all = WasteData.getAll();
    var tbody = document.getElementById('all-reports-list');
    var tableEl = document.getElementById('reports-table');
    var emptyEl = document.getElementById('all-reports-empty');
    if (!tbody) return;

    // Update stats
    var pending = WasteData.getPending();
    var approved = WasteData.getApproved();
    var collected = WasteData.getCollected();
    var totalEl = document.getElementById('all-reports-total');
    var pendingEl = document.getElementById('all-reports-pending');
    var approvedEl = document.getElementById('all-reports-approved');
    var collectedEl = document.getElementById('all-reports-collected');
    if (totalEl) totalEl.textContent = all.length;
    if (pendingEl) pendingEl.textContent = pending.length;
    if (approvedEl) approvedEl.textContent = approved.length;
    if (collectedEl) collectedEl.textContent = collected.length;

    // Filter by status
    var filtered = all;
    if (allReportsFilter !== 'all') {
      filtered = all.filter(function(r) { return r.status === allReportsFilter; });
    }

    // Search filter
    if (allReportsSearch) {
      var searchLower = allReportsSearch.toLowerCase();
      filtered = filtered.filter(function(r) {
        var id = (r.id || '').toLowerCase();
        var name = (r.name || '').toLowerCase();
        var location = (r.location || '').toLowerCase();
        return id.includes(searchLower) || name.includes(searchLower) || location.includes(searchLower);
      });
    }

    // Sort
    filtered = filtered.slice();
    if (allReportsSort === 'newest') {
      filtered.sort(function(a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else if (allReportsSort === 'oldest') {
      filtered.sort(function(a, b) {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
    } else if (allReportsSort === 'status') {
      var statusOrder = { pending: 1, approved: 2, collected: 3 };
      filtered.sort(function(a, b) {
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      });
    }

    // Render table
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = filtered.length === 0 ? 'none' : 'table';

    filtered.forEach(function(r) {
      var tr = document.createElement('tr');
      var actionsHtml = '<button type="button" class="btn btn-sm btn-view" data-id="' + escapeHtml(r.id) + '">View</button>';
      if (r.status === 'pending') {
        actionsHtml += '<button type="button" class="btn btn-sm btn-approve" data-id="' + escapeHtml(r.id) + '">Approve</button>';
        actionsHtml += '<button type="button" class="btn btn-sm btn-reject" data-id="' + escapeHtml(r.id) + '">Reject</button>';
      } else if (r.status === 'approved') {
        actionsHtml += '<button type="button" class="btn btn-sm btn-collect" data-id="' + escapeHtml(r.id) + '">Mark Collected</button>';
      }
      tr.innerHTML =
        '<td><a href="#" class="report-id-link" data-id="' + escapeHtml(r.id) + '">#' + escapeHtml((r.id || '').slice(1, 9)) + '</a></td>' +
        '<td>' + escapeHtml(r.name || 'Anonymous') + '</td>' +
        '<td>' + escapeHtml(r.location || 'Unknown') + '</td>' +
        '<td>' + escapeHtml(r.wasteType || 'N/A') + '</td>' +
        '<td>' + (r.fillLevel || 0) + '%</td>' +
        '<td><span class="report-badge ' + r.status + '">' + r.status + '</span></td>' +
        '<td>' + formatDate(r.createdAt) + '</td>' +
        '<td class="table-actions">' + actionsHtml + '</td>';
      tbody.appendChild(tr);
    });

    // Attach event listeners
    tbody.querySelectorAll('.btn-view, .report-id-link').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        showReportDetails(btn.dataset.id);
      });
    });
    tbody.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.approve(btn.dataset.id)) render();
      });
    });
    tbody.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.reject(btn.dataset.id)) render();
      });
    });
    tbody.querySelectorAll('.btn-collect').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.markCollected(btn.dataset.id)) render();
      });
    });
  }

  function showReportDetails(id) {
    var report = WasteData.getReport(id);
    if (!report) return;
    var modal = document.getElementById('report-details-modal');
    var content = document.getElementById('report-details-content');
    if (!modal || !content) return;
    content.innerHTML =
      '<div class="detail-row"><strong>Report ID:</strong> <span>#' + escapeHtml((report.id || '').slice(1)) + '</span></div>' +
      '<div class="detail-row"><strong>Status:</strong> <span class="report-badge ' + report.status + '">' + report.status + '</span></div>' +
      '<div class="detail-row"><strong>Reporter:</strong> <span>' + escapeHtml(report.name || 'Anonymous') + '</span></div>' +
      '<div class="detail-row"><strong>Location:</strong> <span>' + escapeHtml(report.location || 'Unknown') + '</span></div>' +
      '<div class="detail-row"><strong>Waste Type:</strong> <span>' + escapeHtml(report.wasteType || 'N/A') + '</span></div>' +
      '<div class="detail-row"><strong>Fill Level:</strong> <span>' + (report.fillLevel || 0) + '%</span></div>' +
      '<div class="detail-row"><strong>Created:</strong> <span>' + formatDate(report.createdAt) + '</span></div>' +
      (report.approvedAt ? '<div class="detail-row"><strong>Approved:</strong> <span>' + formatDate(report.approvedAt) + '</span></div>' : '') +
      (report.collectedAt ? '<div class="detail-row"><strong>Collected:</strong> <span>' + formatDate(report.collectedAt) + '</span></div>' : '') +
      '<div class="detail-actions" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border);">' +
      (report.status === 'pending' ? '<button type="button" class="btn btn-approve" data-id="' + escapeHtml(report.id) + '">Approve</button> <button type="button" class="btn btn-reject" data-id="' + escapeHtml(report.id) + '">Reject</button>' : '') +
      (report.status === 'approved' ? '<button type="button" class="btn btn-collect" data-id="' + escapeHtml(report.id) + '">Mark Collected</button>' : '') +
      '</div>';
    modal.classList.remove('is-hidden');
    content.querySelectorAll('.btn-approve').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.approve(btn.dataset.id)) {
          modal.classList.add('is-hidden');
          render();
        }
      });
    });
    content.querySelectorAll('.btn-reject').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.reject(btn.dataset.id)) {
          modal.classList.add('is-hidden');
          render();
        }
      });
    });
    content.querySelectorAll('.btn-collect').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (WasteData.markCollected(btn.dataset.id)) {
          modal.classList.add('is-hidden');
          render();
        }
      });
    });
  }

  function renderCollectors() {
    var collectors = WasteData.getCollectors();
    var tbody = document.getElementById('collectors-list');
    var tableEl = document.getElementById('collectors-table');
    var emptyEl = document.getElementById('collectors-empty');
    var select = document.getElementById('drive-collector');
    if (tbody) tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = collectors.length === 0 ? 'block' : 'none';
    if (tableEl) tableEl.style.display = collectors.length ? 'table' : 'none';
    if (select) {
      select.innerHTML = '<option value="">— Select —</option>';
      collectors.forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.username;
        opt.textContent = c.username;
        select.appendChild(opt);
      });
    }
    if (tbody) {
      collectors.forEach(function(c) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="collector-username">' + escapeHtml(c.username) + '</td>' +
          '<td><span class="report-badge collected">Collector</span></td>' +
          '<td><span class="status-badge status-active">Active</span></td>' +
          '<td><button type="button" class="btn btn-remove-collector" data-username="' + escapeHtml(c.username) + '" title="Remove collector">Remove</button></td>';
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('.btn-remove-collector').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (WasteData.removeUser(btn.dataset.username)) render();
        });
      });
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

  var btnShowAddCollector = document.getElementById('btn-show-add-collector');
  var addCollectorFormWrap = document.getElementById('add-collector-form-wrap');
  var btnCloseAddCollector = document.getElementById('btn-close-add-collector');

  function closeAddCollectorModal() {
    if (addCollectorFormWrap) addCollectorFormWrap.classList.add('is-hidden');
  }

  function openAddCollectorModal() {
    if (addCollectorFormWrap) addCollectorFormWrap.classList.remove('is-hidden');
  }

  if (btnShowAddCollector && addCollectorFormWrap) {
    btnShowAddCollector.addEventListener('click', openAddCollectorModal);
  }
  if (btnCloseAddCollector) {
    btnCloseAddCollector.addEventListener('click', closeAddCollectorModal);
  }
  if (addCollectorFormWrap) {
    addCollectorFormWrap.addEventListener('click', function(e) {
      if (e.target === addCollectorFormWrap) closeAddCollectorModal();
    });
  }

  // All Reports filters and search
  document.querySelectorAll('.btn-filter').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.btn-filter').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      allReportsFilter = btn.dataset.filter;
      renderAllReports();
    });
  });

  var reportsSearch = document.getElementById('reports-search');
  if (reportsSearch) {
    reportsSearch.addEventListener('input', function() {
      allReportsSearch = this.value.trim();
      renderAllReports();
    });
  }

  var reportsSort = document.getElementById('reports-sort');
  if (reportsSort) {
    reportsSort.addEventListener('change', function() {
      allReportsSort = this.value;
      renderAllReports();
    });
  }

  // Modal close
  var modalCloseBtn = document.getElementById('modal-close-btn');
  var reportModal = document.getElementById('report-details-modal');
  if (modalCloseBtn && reportModal) {
    modalCloseBtn.addEventListener('click', function() {
      reportModal.classList.add('is-hidden');
    });
    reportModal.addEventListener('click', function(e) {
      if (e.target === reportModal) {
        reportModal.classList.add('is-hidden');
      }
    });
  }

  var addCollectorForm = document.getElementById('add-collector-form');
  if (addCollectorForm) {
    addCollectorForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var username = document.getElementById('collector-username').value.trim();
      var password = document.getElementById('collector-password').value;
      var confirmPassword = document.getElementById('collector-password-confirm').value;
      var msg = document.getElementById('collector-message');
      if (!msg) return;
      msg.style.display = 'block';
      if (password !== confirmPassword) {
        msg.textContent = 'Passwords do not match.';
        msg.style.color = 'var(--status-urgent)';
        return;
      }
      if (password.length < 6) {
        msg.textContent = 'Password must be at least 6 characters.';
        msg.style.color = 'var(--status-urgent)';
        return;
      }
      if (WasteData.registerUser(username, password, 'collector')) {
        msg.textContent = 'Collector "' + username + '" added.';
        msg.style.color = 'var(--status-ok)';
        addCollectorForm.reset();
        closeAddCollectorModal();
        render();
      } else {
        msg.textContent = 'Username already exists. Choose another.';
        msg.style.color = 'var(--status-urgent)';
      }
    });
  }

  render();
})();
