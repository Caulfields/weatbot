document.addEventListener('DOMContentLoaded', function() {
    const STATION = 'EGLC';
    const copyAllBtn = document.getElementById('copyAllBtn');
    const toast = document.getElementById('toast');
    
    // Track last update times for auto-update detection
    let lastMetarTime = null;
    let lastTafTime = null;
    let isFirstLoad = true;

    // London Clock
    function updateLondonTime() {
        const now = new Date();
        const londonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        document.getElementById('londonTime').textContent = 
            String(londonTime.getHours()).padStart(2, '0') + ':' +
            String(londonTime.getMinutes()).padStart(2, '0') + ':' +
            String(londonTime.getSeconds()).padStart(2, '0');
    }
    updateLondonTime();
    setInterval(updateLondonTime, 1000);

    // Tab Switching
    const windowsRow = document.querySelector('.windows-row');
    const mainContent = document.querySelector('.main-content');
    
    function switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.tab[data-tab="' + tabId + '"]').classList.add('active');
        document.getElementById('tab-' + tabId).classList.add('active');
        
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

    // Fetch METAR History (last 6 hours)
    async function fetchMetarHistory() {
        try {
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=' + STATION + '&format=json&hours=6&cache=' + cacheBuster));
            const data = await res.json();
            
            const historyContainer = document.getElementById('metarHistory');
            historyContainer.innerHTML = '';
            
            if (data && data.length > 0) {
                // Sort by time, newest first
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                
                data.forEach(m => {
                    const raw = m.rawOb || m.metarId || 'No data';
                    const time = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    const wind = (m.wdir || 'VAR') + '° @ ' + (m.wspd || '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                    const cat = m.fltCat || 'VFR';
                    
                    const item = document.createElement('div');
                    item.className = 'metar-history-item';
                    item.style.cssText = 'padding: 10px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid var(--accent-green);';
                    item.innerHTML = '<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">' +
                        '<span style="font-family: monospace; font-size: 12px; color: var(--accent-green); font-weight: 600;">' + time + '</span>' +
                        '<span class="badge ' + cat.toLowerCase() + '" style="font-size: 11px; padding: 2px 8px;">' + cat + '</span>' +
                        '</div>' +
                        '<div style="font-family: monospace; font-size: 11px; margin-bottom: 6px; word-break: break-all;">' + raw + '</div>' +
                        '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px; color: var(--text-secondary);">' +
                        '<span>Wind: ' + wind + '</span>' +
                        '<span>Vis: ' + (m.vis || '--') + ' SM</span>' +
                        '<span>Temp: ' + (m.temp || '--') + '°C</span>' +
                        '</div>';
                    historyContainer.appendChild(item);
                });
            } else {
                historyContainer.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">No historical data available</div>';
            }
        } catch (e) {
            console.error('Failed to fetch METAR history:', e);
            document.getElementById('metarHistory').innerHTML = '<div style="padding: 10px; color: #f87171;">Failed to load history</div>';
        }
    }

    // Fetch METAR
    async function fetchMetar(forceUpdate = false) {
        document.getElementById('refreshMetar').textContent = '...';
        try {
            // Add cache-busting parameter and hours parameter to get latest
            const cacheBuster = Date.now();
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=' + STATION + '&format=json&cache=' + cacheBuster));
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
                    document.getElementById('decStation').textContent = m.stationId || STATION;
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
            const res = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://aviationweather.gov/api/data/taf?ids=' + STATION + '&format=json&cache=' + cacheBuster));
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
        // Fetch history less frequently (every 2 minutes)
        if (Date.now() % (2 * 60 * 1000) < 35000) {
            fetchMetarHistory();
        }
        isFirstLoad = false;
    }

    // Initial fetch
    fetchMetar(true); // Force update on first load
    fetchMetarHistory();
    fetchTaf(true); // Force update on first load
    isFirstLoad = false;
    
    // Auto-update every 30 seconds to check for new data
    setInterval(checkForUpdates, 30 * 1000);

    // Refresh buttons
    document.getElementById('refreshMetar').addEventListener('click', function() {
        fetchMetar(true);
        fetchMetarHistory();
    });
    document.getElementById('refreshTaf').addEventListener('click', function() {
        fetchTaf(true);
    });
    document.getElementById('refreshSatellite').addEventListener('click', function() {
        this.textContent = '...';
        setTimeout(() => { this.textContent = '↻'; showToast('Satellite refreshed'); }, 500);
    });

    // Copy buttons
    document.querySelector('[data-copy="metar"]').addEventListener('click', async function() {
        if (await copyToClipboard(document.getElementById('metarInput').value)) showToast('METAR copied!');
    });
    document.querySelector('[data-copy="taf"]').addEventListener('click', async function() {
        if (await copyToClipboard(document.getElementById('tafInput').value)) showToast('TAF copied!');
    });
    document.querySelector('[data-copy="satellite"]').addEventListener('click', async function() {
        if (await copyToClipboard(document.getElementById('satelliteInput').value)) showToast('Satellite copied!');
    });
    copyAllBtn.addEventListener('click', async function() {
        const all = '=== METAR ===\n' + document.getElementById('metarInput').value + '\n\n=== TAF ===\n' + document.getElementById('tafInput').value + '\n\n=== SATELLITE ===\n' + document.getElementById('satelliteInput').value;
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
});
