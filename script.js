document.addEventListener('DOMContentLoaded', function() {
    let currentStation = 'EGLC';
    let currentLocation = 'london';
    let currentTimezone = 'Europe/London';
    const copyAllBtn = document.getElementById('copyAllBtn');
    const toast = document.getElementById('toast');
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    document.getElementById('themeToggle').addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
    
    function updateThemeIcon(theme) {
        const toggle = document.getElementById('themeToggle');
        if (theme === 'dark') {
            toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
        } else {
            toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        }
    }
    
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
    }
    
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    
    const locations = {
        london: { station: 'EGLC', timezone: 'Europe/London', name: 'London' },
        paris: { station: 'LFPG', timezone: 'Europe/Paris', name: 'Paris' }
    };
    
    // Track last update times for auto-update detection
    let lastMetarTime = null;
    let lastTafTime = null;
    let isFirstLoad = true;

    // Location Clock
    function updateTime() {
        const now = new Date();
        const localTime = new Date(now.toLocaleString('en-US', { timeZone: currentTimezone }));
        document.getElementById('londonTime').textContent = 
            String(localTime.getHours()).padStart(2, '0') + ':' +
            String(localTime.getMinutes()).padStart(2, '0') + ':' +
            String(localTime.getSeconds()).padStart(2, '0');
    }
    updateTime();
    setInterval(updateTime, 1000);
    
    // Location Switching
    document.querySelectorAll('.location-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const loc = this.dataset.location;
            if (loc === currentLocation) return;
            
            document.querySelectorAll('.location-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentLocation = loc;
            currentStation = locations[loc].station;
            currentTimezone = locations[loc].timezone;
            
            // Update clock label
            document.querySelector('.clock-label').textContent = locations[loc].name;
            
            // Update station badges
            document.querySelectorAll('.station-badge, .station-name').forEach(el => {
                el.textContent = currentStation;
            });
            
            // Update METAR tab main station
            const mainStationNameEl = document.getElementById('mainStationName');
            if (mainStationNameEl) mainStationNameEl.textContent = currentStation;
            
            const historyStationNameEl = document.getElementById('historyStationName');
            if (historyStationNameEl) historyStationNameEl.textContent = '(' + currentStation + ')';
            
            // Fetch all METARs for METAR tab
            fetchAllMetars();
            
            // Reset and refetch data
            lastMetarTime = null;
            lastTafTime = null;
            fetchMetar(true);
            fetchTaf(true);
            
            showToast('Switched to ' + locations[loc].name);
        });
    });

    // Tab Switching
    const windowsRow = document.querySelector('.windows-row');
    const mainContent = document.querySelector('.main-content');
    
    function switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.tab[data-tab="' + tabId + '"]').classList.add('active');
        
        const tabContent = document.getElementById('tab-' + tabId);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        // Show windows-row only on Dashboard tab, show main-content on others
        if (tabId === 'dashboard') {
            windowsRow.style.display = 'grid';
            mainContent.style.display = 'none';
        } else {
            windowsRow.style.display = 'none';
            mainContent.style.display = 'block';
        }
    }
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Initialize - start with Dashboard
    switchTab('dashboard');

    // Toast
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // Copy
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        }
    }

    // Fetch METAR for specific station
    async function fetchMetarForStation(station, prefix) {
        try {
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=' + station + '&format=json&cache=' + cacheBuster));
            const data = await res.json();
            
            if (data && data.length > 0) {
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                const m = data[0];
                
                const timeEl = document.getElementById(prefix + 'MetarTime');
                const rawEl = document.getElementById(prefix + 'MetarRaw');
                const windEl = document.getElementById(prefix + 'MetarWind');
                const visEl = document.getElementById(prefix + 'MetarVis');
                const cloudsEl = document.getElementById(prefix + 'MetarClouds');
                const tempEl = document.getElementById(prefix + 'MetarTemp');
                const qnhEl = document.getElementById(prefix + 'MetarQnh');
                const catEl = document.getElementById(prefix + 'MetarCat');
                
                if (timeEl) timeEl.textContent = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                if (rawEl) rawEl.textContent = m.rawOb || 'No data';
                
                const wind = (m.wdir || 'VAR') + '° @ ' + (m.wspd || '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                if (windEl) windEl.textContent = wind;
                if (visEl) visEl.textContent = (m.vis || '--') + ' SM';
                
                let clouds = '--';
                if (m.clouds && m.clouds.length > 0) {
                    clouds = m.clouds.map(c => (c.cover || 'CLR') + (c.base ? ' ' + c.base + '00ft' : '')).join(' ');
                }
                if (cloudsEl) cloudsEl.textContent = clouds;
                if (tempEl) tempEl.textContent = (m.temp || '--') + '° / ' + (m.dwpt || '--') + '°';
                if (qnhEl) qnhEl.textContent = m.altim ? m.altim.toFixed(2) + ' in' : '--';
                
                const cat = m.fltCat || 'VFR';
                if (catEl) {
                    catEl.textContent = cat;
                    catEl.className = 'detail-value badge ' + cat.toLowerCase();
                }
            }
        } catch (e) {
            console.error('Failed to fetch METAR for ' + station, e);
        }
    }
    
    async function fetchAllMetars() {
        await Promise.all([
            fetchMetarForStation(currentStation, 'main'),
            fetchMetarForStation('EGTE', 'egte'),
            fetchMetarForStation('EGFF', 'egff')
        ]);
        fetchAllMetarHistory();
    }
    
    async function fetchMetarHistoryForStation(station, containerId) {
        try {
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=' + station + '&format=json&hours=6&cache=' + cacheBuster));
            const data = await res.json();
            
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            
            if (data && data.length > 0) {
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                
                data.forEach(m => {
                    const raw = m.rawOb || 'No data';
                    const time = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    const wind = (m.wdir || 'VAR') + '° @ ' + (m.wspd || '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                    const cat = m.fltCat || 'VFR';
                    
                    const item = document.createElement('div');
                    item.className = 'metar-history-item';
                    item.innerHTML = 
                        '<div class="history-header">' +
                            '<span class="history-time">' + time + '</span>' +
                            '<span class="badge ' + cat.toLowerCase() + '">' + cat + '</span>' +
                        '</div>' +
                        '<div class="history-raw">' + raw + '</div>' +
                        '<div class="history-details">' +
                            '<span>Wind: ' + wind + '</span>' +
                            '<span>Vis: ' + (m.vis || '--') + ' SM</span>' +
                            '<span>Temp: ' + (m.temp || '--') + '°C</span>' +
                        '</div>';
                    container.appendChild(item);
                });
            } else {
                container.innerHTML = '<div class="metar-history-item"><div class="history-raw">No historical data available</div></div>';
            }
        } catch (e) {
            console.error('Failed to fetch METAR history for ' + station, e);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = '<div class="metar-history-item"><div class="history-raw" style="color: #f87171;">Failed to load history</div></div>';
            }
        }
    }
    
    async function fetchAllMetarHistory() {
        await Promise.all([
            fetchMetarHistoryForStation(currentStation, 'mainMetarHistoryGrid'),
            fetchMetarHistoryForStation('EGTE', 'egteMetarHistoryGrid'),
            fetchMetarHistoryForStation('EGFF', 'egffMetarHistoryGrid')
        ]);
    }
    
    document.getElementById('refreshMainMetar').addEventListener('click', function() {
        this.textContent = '...';
        fetchMetarForStation(currentStation, 'main').then(() => {
            fetchMetarHistoryForStation(currentStation, 'mainMetarHistoryGrid');
            this.textContent = '↻';
        });
    });
    document.getElementById('refreshEgteMetar').addEventListener('click', function() {
        this.textContent = '...';
        fetchMetarForStation('EGTE', 'egte').then(() => {
            fetchMetarHistoryForStation('EGTE', 'egteMetarHistoryGrid');
            this.textContent = '↻';
        });
    });
    document.getElementById('refreshEgffMetar').addEventListener('click', function() {
        this.textContent = '...';
        fetchMetarForStation('EGFF', 'egff').then(() => {
            fetchMetarHistoryForStation('EGFF', 'egffMetarHistoryGrid');
            this.textContent = '↻';
        });
    });
    
    fetchAllMetars();
    setInterval(fetchAllMetars, 60 * 1000);

    // Fetch METAR
    async function fetchMetar(forceUpdate = false) {
        document.getElementById('refreshMetar').textContent = '...';
        try {
            // Add cache-busting parameter and hours parameter to get latest
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=' + currentStation + '&format=json&cache=' + cacheBuster));
            const data = await res.json();
            
            if (data && data.length > 0) {
                // Sort by time to get the most recent
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                const m = data[0];
                const raw = m.rawOb || m.metarId || 'No data';
                const currentReportTime = m.reportTime ? new Date(m.reportTime).getTime() : null;
                
                // Check if this is actually new data
                const isNewData = !lastMetarTime || !currentReportTime || currentReportTime > lastMetarTime;
                
                if (isNewData || forceUpdate) {
                    lastMetarTime = currentReportTime;
                    
                    // Update Dashboard (main page)
                    document.getElementById('metarTime').textContent = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    document.getElementById('metarText').textContent = raw;
                    document.getElementById('metarInput').value = raw;
                    
                    const wind = (m.wdir || 'VAR') + '° @ ' + (m.wspd || '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                    document.getElementById('metarWind').textContent = wind;
                    document.getElementById('metarVisibility').textContent = (m.vis || '--') + ' SM';
                    
                    let clouds = '--';
                    if (m.clouds && m.clouds.length > 0) {
                        clouds = m.clouds.map(c => (c.cover || 'CLR') + (c.base ? c.base + 'kft' : '')).join(' ');
                    }
                    document.getElementById('metarClouds').textContent = clouds;
                    document.getElementById('metarTemp').textContent = (m.temp || '--') + '°C / ' + (m.dwpt || '--') + '°C';
                    document.getElementById('metarAltimeter').textContent = m.altim ? m.altim.toFixed(2) + ' inHg' : '--';
                    
                    // Update Detail view (METAR tab)
                    document.getElementById('detailMetarRaw').textContent = raw;
                    document.getElementById('decStation').textContent = m.stationId || currentStation;
                    document.getElementById('decTime').textContent = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    document.getElementById('decWind').textContent = wind;
                    document.getElementById('decVisibility').textContent = (m.vis || '--') + ' SM';
                    document.getElementById('decClouds').textContent = clouds;
                    document.getElementById('decTemp').textContent = (m.temp || '--') + '°C';
                    document.getElementById('decDewp').textContent = (m.dwpt || '--') + '°C';
                    document.getElementById('decAltim').textContent = m.altim ? m.altim.toFixed(2) + ' inHg' : '--';
                    
                    const cat = m.fltCat || 'VFR';
                    document.getElementById('metarFltCat').textContent = cat;
                    document.getElementById('metarFltCat').className = 'badge ' + cat.toLowerCase();
                    
                    if (!isFirstLoad && isNewData) {
                        showToast('New METAR received!');
                    }
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to fetch METAR');
        }
        document.getElementById('refreshMetar').textContent = '↻';
    }

    // Fetch TAF
    async function fetchTaf(forceUpdate = false) {
        document.getElementById('refreshTaf').textContent = '...';
        try {
            // Add cache-busting parameter
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/taf?ids=' + currentStation + '&format=json&cache=' + cacheBuster));
            const data = await res.json();
            
            if (data && data.length > 0) {
                const t = data[0];
                const raw = t.rawTAF || t.tafId || 'No data';
                const currentIssueTime = t.issueTime ? new Date(t.issueTime).getTime() : null;
                
                // Check if this is actually new data
                const isNewData = !lastTafTime || !currentIssueTime || currentIssueTime > lastTafTime;
                
                if (isNewData || forceUpdate) {
                    lastTafTime = currentIssueTime;
                    
                    // Update Dashboard
                    document.getElementById('tafTime').textContent = t.issueTime ? new Date(t.issueTime).toUTCString().slice(0, -7) : '--';
                    document.getElementById('tafText').textContent = raw;
                    document.getElementById('tafInput').value = raw;
                    
                    // Quick forecast (Dashboard)
                    const fcContainer = document.getElementById('tafForecast');
                    fcContainer.innerHTML = '';
                    if (t.forecasts) {
                        t.forecasts.slice(0, 2).forEach(fc => {
                            const from = fc.from ? new Date(fc.from).toUTCString().slice(17, 22) : '--';
                            const to = fc.to ? new Date(fc.to).toUTCString().slice(17, 22) : '--';
                            const div = document.createElement('div');
                            div.className = 'forecast-item';
                            div.innerHTML = '<div class="forecast-header"><span class="forecast-time">' + from + ' - ' + to + '</span><span class="forecast-type">' + (fc.changeIndicator || 'FM') + '</span></div><div class="forecast-detail">' + raw + '</div>';
                            fcContainer.appendChild(div);
                        });
                    }
                    
                    // Detail view (TAF tab)
                    document.getElementById('detailTafRaw').textContent = raw;
                    const periodsContainer = document.getElementById('tafPeriods');
                    periodsContainer.innerHTML = '';
                    if (t.forecasts) {
                        t.forecasts.forEach(fc => {
                            const from = fc.from ? new Date(fc.from).toUTCString().slice(17, 22) : '--';
                            const to = fc.to ? new Date(fc.to).toUTCString().slice(17, 22) : '--';
                            const div = document.createElement('div');
                            div.className = 'taf-period';
                            div.innerHTML = '<div class="taf-period-header"><span class="taf-period-time">' + from + ' - ' + to + '</span><span class="taf-period-type">' + (fc.changeIndicator || 'FM') + '</span></div><div class="taf-period-detail">' + raw + '</div>';
                            periodsContainer.appendChild(div);
                        });
                    }
                    
                    if (!isFirstLoad && isNewData) {
                        showToast('New TAF received!');
                    }
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to fetch TAF');
        }
        document.getElementById('refreshTaf').textContent = '↻';
    }

    // Auto-update function
    async function checkForUpdates() {
        await fetchMetar();
        await fetchTaf();
        isFirstLoad = false;
    }

    // Initial fetch
    fetchMetar(true);
    fetchTaf(true);
    fetchAllMetars();
    isFirstLoad = false;
    
    // Auto-update every 30 seconds
    setInterval(checkForUpdates, 30 * 1000);
    setInterval(fetchAllMetars, 60 * 1000);

    // Refresh buttons
    document.getElementById('refreshMetar').addEventListener('click', function() {
        fetchMetar(true);
    });
    document.getElementById('refreshTaf').addEventListener('click', function() {
        fetchTaf(true);
    });

    // Copy buttons
    document.querySelector('[data-copy="metar"]').addEventListener('click', async function() {
        if (await copyToClipboard(document.getElementById('metarInput').value)) showToast('METAR copied!');
    });
    document.querySelector('[data-copy="taf"]').addEventListener('click', async function() {
        if (await copyToClipboard(document.getElementById('tafInput').value)) showToast('TAF copied!');
    });
    copyAllBtn.addEventListener('click', async function() {
        const all = '=== METAR ===\n' + document.getElementById('metarInput').value + '\n\n=== TAF ===\n' + document.getElementById('tafInput').value;
        if (await copyToClipboard(all)) showToast('All data copied!');
    });

    // Table
    const tableBody = document.getElementById('inputTableBody');
    
    function updateTableSummary() {
        const rows = tableBody.querySelectorAll('tr');
        let tw = 0, tt = 0, mv = Infinity, c = 0;
        rows.forEach(r => {
            const i = r.querySelectorAll('input');
            tw += parseFloat(i[3].value) || 0;
            tt += parseFloat(i[7].value) || 0;
            mv = Math.min(mv, parseFloat(i[5].value) || Infinity);
            c++;
        });
        document.getElementById('avgWind').textContent = c ? Math.round(tw/c) + ' kt' : '--';
        document.getElementById('avgTemp').textContent = c ? Math.round(tt/c) + '°C' : '--';
        document.getElementById('minVis').textContent = mv === Infinity ? '--' : mv + ' SM';
        document.getElementById('rowCount').textContent = c;
    }
    
tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-btn')) {
            e.target.closest('tr').remove();
            updateTableSummary();
        }
    });
    tableBody.addEventListener('input', updateTableSummary);
    
    document.getElementById('addRowBtn').addEventListener('click', function() {
        const row = document.createElement('tr');
        row.innerHTML = '<td><input type="date" class="table-input" value="2026-02-20"></td><td><input type="time" class="table-input" value="12:00"></td><td><input type="number" class="table-input" value="270"></td><td><input type="number" class="table-input" value="12"></td><td><input type="number" class="table-input" value="0"></td><td><input type="number" class="table-input" value="10"></td><td><input type="number" class="table-input" value="5000"></td><td><input type="number" class="table-input" value="15"></td><td><input type="number" class="table-input" value="8"></td><td><input type="number" class="table-input" value="30.10" step="0.01"></td><td><button class="delete-btn">×</button></td>';
        tableBody.appendChild(row);
        updateTableSummary();
    });
    
    document.getElementById('saveDataBtn').addEventListener('click', function() {
        this.textContent = 'Saved!';
        setTimeout(() => this.textContent = 'Save Data', 1500);
    });
    
    updateTableSummary();

    // Satellite Data Functions
    let satelliteData = [];
    let satelliteUpdateDateStr = localStorage.getItem('satelliteUpdateDate') || null;
    
    function loadSatelliteData() {
        const savedData = localStorage.getItem('satelliteData');
        if (savedData) {
            satelliteData = JSON.parse(savedData);
            document.getElementById('satelliteDataInput').value = savedData;
        }
        updateSatelliteDisplay();
    }
    
    function parseSatelliteData(rawText) {
        const lines = rawText.trim().split('\n');
        const data = [];
        
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
                const pressure = parseFloat(parts[0]);
                if (!isNaN(pressure)) {
                    data.push({
                        pressure: pressure,
                        altitude: parseFloat(parts[1]) || 0,
                        temp: parseFloat(parts[2]) || 0,
                        dewpt: parseFloat(parts[3]) || 0,
                        rh: parseFloat(parts[4]) || 0,
                        mixr: parseFloat(parts[5]) || 0,
                        wdir: parseFloat(parts[6]) || 0,
                        wspd: parseFloat(parts[7]) || 0,
                        theta: parseFloat(parts[8]) || 0,
                        thetaE: parseFloat(parts[9]) || 0,
                        thetaW: parseFloat(parts[10]) || 0
                    });
                }
            }
        });
        
        return data;
    }
    
    function updateSatelliteDisplay() {
        const pressureFrom = parseInt(document.getElementById('pressureFrom').value) || 1000;
        const pressureTo = parseInt(document.getElementById('pressureTo').value) || 700;
        
        const filteredData = satelliteData.filter(d => d.pressure <= pressureFrom && d.pressure >= pressureTo);
        
        // Update label
        document.getElementById('pressureRangeLabel').textContent = '(' + pressureFrom + ' - ' + pressureTo + ' hPa)';
        
        // Update Satellite tab table
        const tableBody = document.getElementById('satelliteDataTable');
        if (filteredData.length > 0) {
            tableBody.innerHTML = filteredData.map(d => 
                '<tr>' +
                    '<td>' + d.pressure.toFixed(1) + '</td>' +
                    '<td>' + d.altitude + '</td>' +
                    '<td>' + d.temp.toFixed(1) + '</td>' +
                    '<td>' + d.dewpt.toFixed(1) + '</td>' +
                    '<td>' + d.rh + '</td>' +
                    '<td>' + d.mixr.toFixed(2) + '</td>' +
                    '<td>' + d.wdir + '</td>' +
                    '<td>' + d.wspd.toFixed(1) + '</td>' +
                    '<td>' + d.theta.toFixed(1) + '</td>' +
                    '<td>' + d.thetaE.toFixed(1) + '</td>' +
                    '<td>' + d.thetaW.toFixed(1) + '</td>' +
                '</tr>'
            ).join('');
        } else {
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: var(--text-muted);">No data in selected range</td></tr>';
        }
        
        // Update Dashboard
        const dashTable = document.getElementById('satelliteDashTable');
        if (filteredData.length > 0) {
            dashTable.innerHTML = filteredData.map(d => 
                '<div class="satellite-dash-row">' +
                    '<span class="dash-press">' + d.pressure.toFixed(0) + ' hPa</span>' +
                    '<span class="dash-temp">' + d.temp.toFixed(1) + '°C</span>' +
                    '<span class="dash-wind">' + d.wdir + '°/' + d.wspd.toFixed(0) + 'kt</span>' +
                '</div>'
            ).join('');
        } else {
            dashTable.innerHTML = '<div class="satellite-dash-row"><span class="dash-press">--</span><span class="dash-temp">--</span><span class="dash-wind">--</span></div>';
        }
        
        // Update date display
        updateSatelliteDateDisplay();
    }
    
    function updateSatelliteDateDisplay() {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        const dateEl = document.getElementById('satelliteUpdateDate');
        const dashDateEl = document.getElementById('satelliteDashDate');
        
        if (satelliteUpdateDateStr) {
            const displayDate = satelliteUpdateDateStr;
            
            dateEl.textContent = displayDate;
            dashDateEl.querySelector('.dash-date-value').textContent = displayDate;
            
            if (satelliteUpdateDateStr === yesterday || satelliteUpdateDateStr < yesterday) {
                dateEl.classList.add('stale');
                dashDateEl.classList.add('stale');
            } else {
                dateEl.classList.remove('stale');
                dashDateEl.classList.remove('stale');
            }
        } else {
            dateEl.textContent = 'Never';
            dateEl.classList.add('stale');
            dashDateEl.querySelector('.dash-date-value').textContent = 'Never';
            dashDateEl.classList.add('stale');
        }
    }
    
    // Save Satellite Data
    document.getElementById('saveSatelliteData').addEventListener('click', function() {
        const rawText = document.getElementById('satelliteDataInput').value;
        satelliteData = parseSatelliteData(rawText);
        
        localStorage.setItem('satelliteData', rawText);
        
        const today = new Date().toISOString().split('T')[0];
        satelliteUpdateDateStr = today;
        localStorage.setItem('satelliteUpdateDate', today);
        
        updateSatelliteDisplay();
        showToast('Satellite data updated!');
    });
    
    // Apply Pressure Filter
    document.getElementById('applyPressureFilter').addEventListener('click', function() {
        updateSatelliteDisplay();
    });
    
    // Refresh Satellite
    document.getElementById('refreshSatellite').addEventListener('click', function() {
        this.textContent = '...';
        updateSatelliteDisplay();
        setTimeout(() => {
            this.textContent = '↻';
            showToast('Satellite data refreshed');
        }, 500);
    });
    
    // Load saved satellite data
    loadSatelliteData();
});
