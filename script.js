document.addEventListener('DOMContentLoaded', function() {
    let currentStation = 'EGLC';
    let currentLocation = 'london';
    let currentTimezone = 'Europe/London';
    let currentMetarRaw = '';
    let currentTafRaw = '';
    const copyPromptBtn = document.getElementById('copyPromptBtn');
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
        const timeStr = String(localTime.getHours()).padStart(2, '0') + ':' +
            String(localTime.getMinutes()).padStart(2, '0') + ':' +
            String(localTime.getSeconds()).padStart(2, '0');
        document.getElementById('londonTime').textContent = timeStr;
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
            
            // Update METAR display for new location
            updateMetarForDisplay(currentStation, locations[loc].name);
            
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
            
            // Update trend chart if function exists
            if (window.trendFetch) window.trendFetch();
            
            showToast('Switched to ' + locations[loc].name);
        });
    });

    // Tab Switching
    const windowsRow = document.querySelector('.windows-row');
    const mainContent = document.querySelector('.main-content');
    const promptContainer = document.querySelector('.prompt-container');
    
    function switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.tab[data-tab="' + tabId + '"]').classList.add('active');
        
        const tabContent = document.getElementById('tab-' + tabId);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        // Show windows-row and prompt only on Dashboard tab, show main-content on others
        if (tabId === 'dashboard') {
            windowsRow.style.display = 'grid';
            if (promptContainer) promptContainer.style.display = 'block';
            mainContent.classList.add('dashboard-active');
        } else {
            windowsRow.style.display = 'none';
            if (promptContainer) promptContainer.style.display = 'none';
            mainContent.classList.remove('dashboard-active');
        }
        
        // Redraw trend chart when trend tab becomes visible
        if (tabId === 'trend') {
            setTimeout(() => {
                if (trendData && trendData.hourly) {
                    updateTrendDisplay();
                } else {
                    fetchTrendData();
                }
            }, 50);
        }
    }
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // Initialize - start with Dashboard
    switchTab('dashboard');
    
    // Initialize METAR display
    updateMetarForDisplay(currentStation, locations[currentLocation].name);

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

    const METAR_ENDPOINT = 'https://aviationweather.gov/api/data/metar';
    const CORS_PROXY = 'https://corsproxy.io/?';

    function buildMetarUrl(params) {
        const query = new URLSearchParams({ format: 'json', ...params });
        return METAR_ENDPOINT + '?' + query.toString();
    }

    function safeText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
        return el;
    }

    function safeValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
        return el;
    }

    function safeClass(id, value) {
        const el = document.getElementById(id);
        if (el) el.className = value;
        return el;
    }

    async function fetchAviationWeatherJson(url) {
        const proxyOnly = location.protocol === 'file:';
        if (!proxyOnly) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    if (res.status === 204) return [];
                    const text = await res.text();
                    if (!text) return [];
                    return JSON.parse(text);
                }
            } catch (e) {
                console.warn('Direct METAR fetch failed, trying proxy.', e);
            }
        }

        const proxyUrl = CORS_PROXY + encodeURIComponent(url);
        const proxyRes = await fetch(proxyUrl, { cache: 'no-store' });
        if (!proxyRes.ok) {
            throw new Error('METAR request failed: ' + proxyRes.status);
        }
        if (proxyRes.status === 204) return [];
        const proxyText = await proxyRes.text();
        if (!proxyText) return [];
        return JSON.parse(proxyText);
    }

    function formatVisibility(metar) {
        const vis = metar.visib ?? metar.vis;
        return vis ?? '--';
    }

    function formatAltimeter(altim) {
        const value = Number(altim);
        if (!Number.isFinite(value)) return '--';
        if (value >= 100) return Math.round(value) + ' hPa';
        return value.toFixed(2) + ' inHg';
    }
    
    // Parse METAR data from raw string
    function parseMetarFromRaw(metarStr) {
        const result = {
            temp: null,
            dewpt: null,
            vis: null,
            time: null,
            clouds: [],
            hasNCD: false
        };
        
        if (!metarStr) return result;
        
        // Parse time (format: DDHHMMZ)
        const timeMatch = metarStr.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
        if (timeMatch) {
            result.time = {
                day: timeMatch[1],
                hour: timeMatch[2],
                minute: timeMatch[3]
            };
        }
        
        // Parse temperature/dewpoint (format: XX/YY or MXX/MYY for negative)
        const tempMatch = metarStr.match(/\b(M?\d{2})\/(M?\d{2})\b/);
        if (tempMatch) {
            const parseTemp = (t) => {
                if (t.startsWith('M')) return -parseInt(t.substring(1));
                return parseInt(t);
            };
            result.temp = parseTemp(tempMatch[1]);
            result.dewpt = parseTemp(tempMatch[2]);
        }
        
        // Parse visibility (9999 = 10+ km, or XXXX meters, or X SM)
        // Look for visibility after wind but before temperature/pressure
        const parts = metarStr.split(' ');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            // Match 9999 or 4-digit visibility meters (but not QNH which starts with Q)
            if (/^(9999|\d{4})$/.test(part) && part !== 'AUTO' && part !== 'COR') {
                const vis = parseInt(part);
                if (vis === 9999) {
                    result.vis = '6+';
                    result.visKm = '10+';
                    break;
                } else if (vis >= 1000) {
                    const miles = vis / 1609.34;
                    result.vis = miles.toFixed(0);
                    result.visKm = Math.round(vis / 1000);
                    break;
                }
            }
            // Match X SM (statute miles)
            const smMatch = part.match(/^(\d+)(\d\/\d)?SM$/);
            if (smMatch) {
                let miles = parseInt(smMatch[1]);
                if (smMatch[2]) {
                    const frac = smMatch[2].split('/');
                    miles += parseInt(frac[0]) / parseInt(frac[1]);
                }
                result.vis = miles;
                result.visKm = Math.round(miles * 1.60934);
                break;
            }
        }
        
        // Parse clouds
        const cloudMatches = metarStr.match(/\b(FEW|SCT|BKN|OVC|SKC|CLR|NSC|NCD)(\d{3})?\b/g);
        if (cloudMatches) {
            cloudMatches.forEach(match => {
                const cover = match.substring(0, 3);
                const baseCode = match.substring(3, 6);
                if (cover === 'NCD') {
                    result.hasNCD = true;
                } else {
                    result.clouds.push({
                        cover: cover,
                        base: baseCode ? parseInt(baseCode) : null
                    });
                }
            });
        }
        
        return result;
    }
    
    // METAR Display Helper Functions
    function formatMetarConditionsTime(reportTime, metarTime) {
        // Use METAR time if available, otherwise reportTime
        let date;
        if (metarTime) {
            const now = new Date();
            date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), parseInt(metarTime.day), 
                                     parseInt(metarTime.hour), parseInt(metarTime.minute)));
        } else {
            date = new Date(reportTime);
        }
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        return `${hours}${minutes} UTC ${day} ${date.toLocaleDateString('en-US', { weekday: 'short' })} ${month} ${year}`;
    }
    
    function celsiusToFahrenheit(c) {
        if (c === null || c === undefined) return null;
        return Math.round((c * 9/5) + 32);
    }
    
    function formatTemperature(temp) {
        if (temp === null || temp === undefined) return '--°C (--°F)';
        const f = celsiusToFahrenheit(temp);
        return `${temp}°C (${f}°F)`;
    }
    
    function calculateRH(temp, dewpt) {
        if (temp === null || dewpt === null || temp === undefined || dewpt === undefined) return null;
        // Simplified RH calculation using Magnus formula
        const a = 17.625;
        const b = 243.04;
        const alpha = ((a * dewpt) / (b + dewpt)) - ((a * temp) / (b + temp));
        const rh = 100 * Math.exp(alpha);
        return Math.round(rh);
    }
    
    function formatDewpoint(dwpt, temp) {
        if (dwpt === null || dwpt === undefined) return '--°C (--°F) (RH = --%)';
        const f = celsiusToFahrenheit(dwpt);
        const rh = calculateRH(temp, dwpt);
        return `${dwpt}°C (${f}°F) (RH = ${rh ?? '--'}%)`;
    }
    
    function formatPressure(altim) {
        const value = Number(altim);
        if (!Number.isFinite(value)) return '-- inHg (-- hPa)';
        if (value >= 100) {
            return `${(value / 33.8639).toFixed(2)} inHg (${Math.round(value)} hPa)`;
        }
        return `${value.toFixed(2)} inHg (${Math.round(value * 33.8639)} hPa)`;
    }
    
    function formatWindsDetailed(m) {
        if (!m.wdir && !m.wspd) return '--';
        const dir = m.wdir ?? 'VAR';
        const compass = dir === 'VAR' ? 'variable' : degreesToCompass(dir);
        const speed = m.wspd ?? '--';
        const speedMs = speed !== '--' ? (speed * 0.514444).toFixed(1) : '--';
        const speedMph = speed !== '--' ? (speed * 1.15078).toFixed(1) : '--';
        if (m.wgst) {
            return `from the ${compass} (${dir}°) at ${speed} kt (${speedMs} m/s, ${speedMph} mph), gusts ${m.wgst} kt`;
        }
        return `from the ${compass} (${dir}°) at ${speed} kt (${speedMs} m/s, ${speedMph} mph)`;
    }
    
    function formatVisibilityDetailed(m) {
        // Parse from raw METAR first
        const raw = m.rawOb || m.rawTAF || '';
        const parsed = parseMetarFromRaw(raw);
        
        if (parsed.vis) {
            if (parsed.visKm === '10+') {
                return `6+ mi (10+ km)`;
            }
            return `${parsed.vis} mi (${parsed.visKm} km)`;
        }
        
        // Fallback to API data
        const vis = m.visib ?? m.vis;
        if (!vis || isNaN(vis)) return '--';
        // Convert statute miles to km (1 SM = 1.60934 km)
        const km = Math.round(vis * 1.60934);
        if (vis >= 6) {
            return `${vis}+ mi (${km}+ km)`;
        }
        return `${vis} mi (${km} km)`;
    }
    
    function formatCloudsDetailed(m) {
        const raw = m.rawOb || m.rawTAF || '';
        const parsed = parseMetarFromRaw(raw);
        
        // Check for NCD (No Cloud Detected)
        if (parsed.hasNCD) {
            return 'no clouds detected';
        }
        
        // Use parsed clouds from raw METAR
        if (parsed.clouds && parsed.clouds.length > 0) {
            return parsed.clouds.map(c => {
                const coverName = getCloudCoverName(c.cover) || c.cover;
                if (c.base) {
                    const baseFeet = c.base * 100;
                    return `${coverName} clouds at ${baseFeet.toLocaleString('en-US')} ft`;
                }
                return coverName;
            }).join(', ');
        }
        
        return 'clear skies';
    }
    
    function updateMetarForDisplay(station, locationName) {
        const stationNames = {
            'EGLC': 'London City Arpt, EN, GB',
            'LFPG': 'Paris Charles de Gaulle, FR'
        };
        const fullName = stationNames[station] || locationName;
        safeText('metarFor', `${station} (${fullName})`);
    }
    
    const cloudCoverNames = {
        'CLR': 'clear',
        'SKC': 'sky clear',
        'NSC': 'no significant clouds',
        'NCD': 'no clouds detected',
        'FEW': 'few',
        'SCT': 'scattered',
        'BKN': 'broken',
        'OVC': 'overcast',
        'VV': 'vertical visibility'
    };
    
    function getCloudCoverName(code) {
        return cloudCoverNames[code] || (code ? code.toLowerCase() : '');
    }
    
    function degreesToCompass(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        if (deg === null || deg === undefined || deg === 'VAR') return 'VAR';
        const d = Math.round(deg / 22.5) % 16;
        return directions[d];
    }
    
    function updateDecodedMetar(m) {
        const stationId = m.stationId || currentStation;
        const stationNames = {
            'EGLC': 'London City Arpt, EN, GB',
            'LFPG': 'Paris Charles de Gaulle, FR',
            'EGTE': 'Exeter, GB',
            'EGFF': 'Cardiff, GB'
        };
        
        const stationName = stationNames[stationId] || stationId;
        
        safeText('decMetarStation', stationId + ' (' + stationName + ')');
        safeText('decMetarText', m.rawOb || '--');
        
        const reportTime = m.reportTime ? new Date(m.reportTime) : null;
        let timeStr = '--';
        if (reportTime) {
            const day = reportTime.getUTCDate();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const dayName = days[reportTime.getUTCDay()];
            const monthName = months[reportTime.getUTCMonth()];
            const year = reportTime.getUTCFullYear();
            const hours = String(reportTime.getUTCHours()).padStart(2, '0');
            const mins = String(reportTime.getUTCMinutes()).padStart(2, '0');
            timeStr = hours + mins + ' UTC ' + day + ' ' + dayName + ' ' + monthName + ' ' + year;
        }
        safeText('decMetarTime', timeStr);
        
        const temp = m.temp ?? m.temperature ?? null;
        const dwpt = m.dwpt ?? m.dewpt ?? m.dewpoint ?? null;
        let tempStr = '--';
        if (temp !== null && temp !== undefined) {
            const tempF = (temp * 9/5) + 32;
            tempStr = temp.toFixed(0) + '°C (' + tempF.toFixed(0) + '°F)';
        }
        safeText('decMetarTemp', tempStr);
        
        let dewpStr = '--';
        if (dwpt !== null && dwpt !== undefined) {
            const dwptF = (dwpt * 9/5) + 32;
            let rhStr = '';
            if (temp !== null && temp !== undefined && dwpt !== null && dwpt !== undefined) {
                const rh = calculateRH(temp, dwpt);
                rhStr = ' (RH = ' + rh + '%)';
            }
            dewpStr = dwpt.toFixed(0) + '°C (' + dwptF.toFixed(0) + '°F)' + rhStr;
        }
        safeText('decMetarDewp', dewpStr);
        
        const altim = m.altim;
        let altimStr = '--';
        if (altim !== null && altim !== undefined) {
            const val = Number(altim);
            if (val >= 100) {
                altimStr = (val / 100).toFixed(2) + ' inHg (' + Math.round(val) + ' hPa)';
            } else {
                altimStr = val.toFixed(2) + ' inHg (' + Math.round(val * 33.8639) + ' hPa)';
            }
        }
        safeText('decMetarAltim', altimStr);
        
        const wdir = m.wdir;
        const wspd = m.wspd;
        const wgst = m.wgst;
        let windStr = '--';
        if (wspd !== null && wspd !== undefined) {
            const compass = degreesToCompass(wdir);
            let dirStr = wdir !== null && wdir !== undefined ? wdir + '°' : 'VAR';
            const speedKt = wspd;
            const speedMs = (wspd * 0.514444).toFixed(1);
            const speedMph = (wspd * 1.15078).toFixed(1);
            windStr = 'from the ' + compass + ' (' + dirStr + ') at ' + speedKt + ' kt (' + speedMs + ' m/s, ' + speedMph + ' mph)';
            if (wgst) {
                windStr += ' G' + wgst + 'kt';
            }
        }
        safeText('decMetarWind', windStr);
        
        const vis = m.visib ?? m.vis;
        let visStr = '--';
        if (vis !== null && vis !== undefined) {
            if (vis >= 10) {
                visStr = '6+ mi (10+ km)';
            } else {
                const visKm = (vis * 1.60934).toFixed(1);
                visStr = vis + ' mi (' + visKm + ' km)';
            }
        }
        safeText('decMetarVis', visStr);
        
        let cloudsStr = '--';
        let ceilingStr = '--';
        if (m.clouds && m.clouds.length > 0) {
            const cloudParts = [];
            let lowestCeiling = null;
            m.clouds.forEach(c => {
                const cover = c.cover || 'CLR';
                if (c.base !== null && c.base !== undefined) {
                    const baseFt = c.base * 100;  // METAR cloud base is in hundreds of feet
                    cloudParts.push(cover.toLowerCase() + ' clouds at ' + baseFt.toLocaleString() + ' ft');
                    if (cover !== 'CLR' && cover !== 'SKC' && cover !== 'NSC') {
                        if (lowestCeiling === null || baseFt < lowestCeiling) {
                            lowestCeiling = baseFt;
                        }
                    }
                } else {
                    if (cover === 'CLR' || cover === 'SKC' || cover === 'NSC') {
                        cloudParts.push('clear');
                    } else {
                        cloudParts.push(cover.toLowerCase());
                    }
                }
            });
            cloudsStr = cloudParts.join(', ');
            if (lowestCeiling !== null) {
                ceilingStr = lowestCeiling.toLocaleString() + ' ft';
            }
        }
        safeText('decMetarClouds', cloudsStr);
        safeText('decMetarCeiling', ceilingStr || 'unlimited');
    }
    
    function calculateRH(temp, dewpoint) {
        const a = 17.27;
        const b = 237.7;
        const alpha = ((a * temp) / (b + temp)) + Math.log(5);
        const rh = Math.exp(((a * dewpoint) / (b + dewpoint)) - Math.log(5));
        return Math.round(rh * 100);
    }
    
    function updateDecodedTaf(t) {
        const stationId = t.stationId || currentStation;
        const stationNames = {
            'EGLC': 'London City Arpt',
            'LFPG': 'Paris Charles de Gaulle',
            'EGTE': 'Exeter',
            'EGFF': 'Cardiff'
        };
        
        const stationName = stationNames[stationId] || stationId;
        
        safeText('decTafStation', stationName);
        safeText('decTafText', t.rawTAF || '--');
        
        const raw = t.rawTAF || '';
        
        let periodStr = '--';
        let typeStr = 'standard forecast or significant change';
        let firstFc = null;
        
        if (t.forecasts && t.forecasts.length > 0) {
            firstFc = t.forecasts[0];
            
            if (firstFc.from && firstFc.to) {
                const fromDate = new Date(firstFc.from);
                const toDate = new Date(firstFc.to);
                
                const formatTafTime = (d) => {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const day = d.getUTCDate();
                    const dayName = days[d.getUTCDay()];
                    const monthName = months[d.getUTCMonth()];
                    const year = d.getUTCFullYear();
                    const hours = String(d.getUTCHours()).padStart(2, '0');
                    const mins = String(d.getUTCMinutes()).padStart(2, '0');
                    return hours + mins + ' UTC ' + day + ' ' + dayName + ' ' + monthName + ' ' + year;
                };
                
                periodStr = formatTafTime(fromDate) + ' to ' + formatTafTime(toDate);
            }
            
            const changeIndicator = firstFc.changeIndicator;
            if (changeIndicator === 'PROB') {
                typeStr = 'PROB: probability forecast';
            } else if (changeIndicator === 'TEMPO') {
                typeStr = 'TEMPO: expected for less than half the time period';
            } else if (changeIndicator === 'BECMG') {
                typeStr = 'BECMG: becoming';
            } else if (changeIndicator === 'FM') {
                typeStr = 'FM: from';
            } else {
                typeStr = 'standard forecast or significant change';
            }
        }
        
        safeText('decTafPeriod', periodStr);
        safeText('decTafType', typeStr);
        
        let windStr = '--';
        if (firstFc) {
            const wdir = firstFc.wdir;
            const wspd = firstFc.wspd;
            if (wspd !== null && wspd !== undefined) {
                const compass = degreesToCompass(wdir);
                let dirStr = wdir !== null && wdir !== undefined ? wdir + '°' : 'VAR';
                const speedKt = wspd;
                const speedMs = (wspd * 0.514444).toFixed(1);
                const speedMph = (wspd * 1.15078).toFixed(1);
                windStr = 'from the ' + compass + ' (' + dirStr + ') at ' + speedKt + ' kt (' + speedMs + ' m/s, ' + speedMph + ' mph)';
            }
        }
        safeText('decTafWind', windStr);
        
        let visStr = '--';
        if (firstFc) {
            const vis = firstFc.visib ?? firstFc.vis;
            if (vis !== null && vis !== undefined) {
                if (vis >= 10) {
                    visStr = '6+ mi (10+ km)';
                } else {
                    const visKm = (vis * 1.60934).toFixed(1);
                    visStr = vis + ' mi (' + visKm + ' km)';
                }
            }
        }
        safeText('decTafVis', visStr);
        
        let cloudsStr = '--';
        if (firstFc && firstFc.clouds && firstFc.clouds.length > 0) {
            const cloudParts = [];
            firstFc.clouds.forEach(c => {
                const cover = c.cover || 'CLR';
                if (c.base !== null && c.base !== undefined) {
                    const baseFt = c.base * 100;  // METAR cloud base is in hundreds of feet
                    cloudParts.push(cover.toLowerCase() + ' clouds at ' + baseFt.toLocaleString() + ' ft');
                } else {
                    if (cover === 'CLR' || cover === 'SKC' || cover === 'NSC') {
                        cloudParts.push('clear');
                    } else {
                        cloudParts.push(cover.toLowerCase());
                    }
                }
            });
            cloudsStr = cloudParts.join(', ');
        }
        safeText('decTafClouds', cloudsStr);
        
        const additionalContainer = document.getElementById('decTafAdditional');
        additionalContainer.innerHTML = '';
        
        if (t.forecasts && t.forecasts.length > 1) {
            for (let i = 1; i < t.forecasts.length; i++) {
                const fc = t.forecasts[i];
                const changeIndicator = fc.changeIndicator;
                
                if (changeIndicator === 'PROB' || changeIndicator === 'TEMPO') {
                    const div = document.createElement('div');
                    div.className = 'decoded-taf-additional';
                    
                    let typeText = 'standard forecast or significant change';
                    if (changeIndicator === 'PROB') {
                        typeText = 'PROB: probability forecast';
                    } else if (changeIndicator === 'TEMPO') {
                        typeText = 'TEMPO: expected for less than half the time period';
                    }
                    
                    let periodText = '--';
                    if (fc.from && fc.to) {
                        const fromDate = new Date(fc.from);
                        const toDate = new Date(fc.to);
                        
                        const formatTafTime = (d) => {
                            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const day = d.getUTCDate();
                            const dayName = days[d.getUTCDay()];
                            const monthName = months[d.getUTCMonth()];
                            const year = d.getUTCFullYear();
                            const hours = String(d.getUTCHours()).padStart(2, '0');
                            const mins = String(d.getUTCMinutes()).padStart(2, '0');
                            return hours + mins + ' UTC ' + day + ' ' + dayName + ' ' + monthName + ' ' + year;
                        };
                        
                        periodText = formatTafTime(fromDate) + ' to ' + formatTafTime(toDate);
                    }
                    
                    let cloudText = '--';
                    if (fc.clouds && fc.clouds.length > 0) {
                        const cloudParts = [];
                        fc.clouds.forEach(c => {
                            const cover = c.cover || 'CLR';
                            if (c.base !== null && c.base !== undefined) {
                                const baseFt = c.base * 100;  // METAR cloud base is in hundreds of feet
                                cloudParts.push(cover.toLowerCase() + ' clouds at ' + baseFt.toLocaleString() + ' ft');
                            }
                        });
                        cloudText = cloudParts.join(', ');
                    }
                    
                    div.innerHTML = 
                        '<div class="decoded-row"><span class="decoded-label">Text:</span><span class="decoded-value">' + changeIndicator + '</span></div>' +
                        '<div class="decoded-row"><span class="decoded-label">Forecast period:</span><span class="decoded-value">' + periodText + '</span></div>' +
                        '<div class="decoded-row"><span class="decoded-label">Forecast type:</span><span class="decoded-value">' + typeText + '</span></div>' +
                        '<div class="decoded-row"><span class="decoded-label">Clouds:</span><span class="decoded-value">' + cloudText + '</span></div>';
                    
                    additionalContainer.appendChild(div);
                }
            }
        }
    }

    // Fetch METAR for specific station
    async function fetchMetarForStation(station, prefix) {
        try {
            const cacheBuster = Date.now();
            const url = buildMetarUrl({ ids: station, hours: 6, cache: cacheBuster });
            const data = await fetchAviationWeatherJson(url);
            
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
                
                const wind = (m.wdir ?? 'VAR') + '° @ ' + (m.wspd ?? '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                if (windEl) windEl.textContent = wind;
                if (visEl) visEl.textContent = formatVisibility(m) + ' SM';
                
                let clouds = '--';
                if (m.clouds && m.clouds.length > 0) {
                    clouds = m.clouds.map(c => (c.cover || 'CLR') + (c.base ? ' ' + c.base + '00ft' : '')).join(' ');
                }
                if (cloudsEl) cloudsEl.textContent = clouds;
                const tempVal = m.temp ?? m.temperature ?? null;
                const dwptVal = m.dwpt ?? m.dewpt ?? m.dewpoint ?? null;
                if (tempEl) tempEl.textContent = (tempVal ?? '--') + '° / ' + (dwptVal ?? '--') + '°';
                if (qnhEl) qnhEl.textContent = formatAltimeter(m.altim);
                
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
            const url = buildMetarUrl({ ids: station, hours: 6, cache: cacheBuster });
            const data = await fetchAviationWeatherJson(url);
            
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            
            if (data && data.length > 0) {
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                
                data.forEach(m => {
                    const raw = m.rawOb || 'No data';
                    const time = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    const wind = (m.wdir ?? 'VAR') + '° @ ' + (m.wspd ?? '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
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
                            '<span>Vis: ' + formatVisibility(m) + ' SM</span>' +
                            '<span>Temp: ' + (m.temp ?? '--') + '°C</span>' +
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
        try {
            // Add cache-busting parameter and hours parameter to get latest
            const cacheBuster = Date.now();
            const url = buildMetarUrl({ ids: currentStation, hours: 6, cache: cacheBuster });
            const data = await fetchAviationWeatherJson(url);
            
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
                    safeText('metarTime', m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--');
                    safeText('metarText', raw);
                    currentMetarRaw = raw;
                    
                    const wind = (m.wdir ?? 'VAR') + '° @ ' + (m.wspd ?? '--') + 'kt' + (m.wgst ? ' G' + m.wgst + 'kt' : '');
                    safeText('metarWind', wind);
                    safeText('metarVisibility', formatVisibility(m) + ' SM');
                    
                    let clouds = '--';
                    if (m.clouds && m.clouds.length > 0) {
                        clouds = m.clouds.map(c => (c.cover || 'CLR') + (c.base ? c.base + 'kft' : '')).join(' ');
                    }
                    safeText('metarClouds', clouds);
                    const tempValue = m.temp ?? m.temperature ?? null;
                    const dwptValue = m.dwpt ?? m.dewpt ?? m.dewpoint ?? null;
                    safeText('metarTemp', (tempValue ?? '--') + '°C / ' + (dwptValue ?? '--') + '°C');
                    safeText('metarAltimeter', formatAltimeter(m.altim));
                    
                    // Update Dashboard METAR window
                    // Parse raw METAR to get accurate data
                    const parsedMetar = parseMetarFromRaw(raw);
                    
                    updateMetarForDisplay(currentStation, locations[currentLocation].name);
                    safeText('metarText', raw);
                    safeText('metarConditions', formatMetarConditionsTime(m.reportTime, parsedMetar.time));
                    
                    // Use parsed values from raw METAR (more accurate than API)
                    const temp = parsedMetar.temp ?? m.temp ?? m.temperature ?? null;
                    const dwpt = parsedMetar.dewpt ?? m.dwpt ?? m.dewpt ?? m.dewpoint ?? null;
                    safeText('metarTemp', formatTemperature(temp));
                    safeText('metarDewpoint', formatDewpoint(dwpt, temp));
                    safeText('metarPressure', formatPressure(m.altim));
                    safeText('metarWinds', formatWindsDetailed(m));
                    safeText('metarVisibility', formatVisibilityDetailed(m));
                    safeText('metarClouds', formatCloudsDetailed(m));
                    
                    // Update Detail view (METAR tab)
                    safeText('detailMetarRaw', raw);
                    safeText('decStation', m.stationId || currentStation);
                    safeText('decTime', m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--');
                    safeText('decWind', wind);
                    safeText('decVisibility', formatVisibility(m) + ' SM');
                    safeText('decClouds', clouds);
                    const decTemp = m.temp ?? m.temperature ?? null;
                    const decDwpt = m.dwpt ?? m.dewpt ?? m.dewpoint ?? null;
                    safeText('decTemp', (decTemp ?? '--') + '°C');
                    safeText('decDewp', (decDwpt ?? '--') + '°C');
                    safeText('decAltim', formatAltimeter(m.altim));
                    
                    safeText('metarFltCat', cat);
                    safeClass('metarFltCat', 'badge ' + cat.toLowerCase());
                    
                    // Update Dashboard decoded METAR
                    updateDecodedMetar(m);
                    
                    if (!isFirstLoad && isNewData) {
                        showToast('New METAR received!');
                    }
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to fetch METAR');
        }
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
                    currentTafRaw = raw;
                    
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
                    
                    updateDecodedTaf(t);
                    
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

    // Refresh buttons
    document.getElementById('refreshTaf').addEventListener('click', function() {
        fetchTaf(true);
    });

    // Copy button for TAF
    document.querySelector('[data-copy="taf"]').addEventListener('click', async function() {
        if (await copyToClipboard(currentTafRaw || '')) showToast('TAF copied!');
    });
    
    // ATK (Prompt Template) Function
    async function processPromptTemplate(template) {
        const metarRaw = currentMetarRaw || '';
        const tafRaw = currentTafRaw || '';
        const stationCode = currentStation;
        
        const now = new Date();
        const timeStr = now.toUTCString().slice(0, -7) + ' UTC';
        
        let processed = template;
        
        processed = processed.replace(/@metar/g, metarRaw);
        processed = processed.replace(/@taf/g, tafRaw);
        processed = processed.replace(/@station/g, stationCode);
        processed = processed.replace(/@time/g, timeStr);
        
        // @6-metar - get last 6 hours of METAR from history
        let metar6h = '';
        try {
            const cacheBuster = Date.now();
            const url = buildMetarUrl({ ids: stationCode, hours: 6, cache: cacheBuster });
            const data = await fetchAviationWeatherJson(url);
            if (data && data.length > 0) {
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                metar6h = data.map(m => m.rawOb || '').filter(Boolean).join('\n');
            }
        } catch (e) {
            console.warn('Failed to fetch 6h METAR:', e);
        }
        processed = processed.replace(/@6-metar/g, metar6h || 'No METAR data available');
        
        // @6-taf - TAF forecast for next 6 hours
        let taf6h = '';
        try {
            const cacheBuster = Date.now();
            const url = 'https://aviationweather.gov/api/data/taf?ids=' + stationCode + '&format=json&cache=' + cacheBuster;
            const data = await fetchAviationWeatherJson(url);
            if (data && data.length > 0) {
                const t = data[0];
                if (t.forecasts) {
                    const sixHoursFromNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
                    const relevantForecasts = t.forecasts.filter(fc => {
                        if (!fc.to) return true;
                        return new Date(fc.to) <= sixHoursFromNow;
                    });
                    taf6h = relevantForecasts.map(fc => {
                        const from = fc.from ? new Date(fc.from).toUTCString().slice(0, -7) : '';
                        const to = fc.to ? new Date(fc.to).toUTCString().slice(0, -7) : '';
                        const change = fc.changeIndicator || '';
                        const wind = (fc.wdir ?? '---') + '° @ ' + (fc.wspd ?? '--') + 'kt';
                        const vis = fc.visib ?? fc.vis ?? '--';
                        let clouds = '--';
                        if (fc.clouds && fc.clouds.length > 0) {
                            clouds = fc.clouds.map(c => (c.cover || 'CLR') + (c.base ? ' ' + c.base + 'kft' : '')).join(' ');
                        }
                        return `[${from} - ${to}] ${change}\n  Wind: ${wind}, Vis: ${vis} SM, Clouds: ${clouds}`;
                    }).join('\n\n');
                }
                if (!taf6h) taf6h = t.rawTAF || '';
            }
        } catch (e) {
            console.warn('Failed to fetch 6h TAF:', e);
        }
        processed = processed.replace(/@6-taf/g, taf6h || 'No TAF data available');
        
        // @satellite - satellite sounding data
        let satelliteDataStr = '';
        try {
            const savedData = localStorage.getItem('satelliteData');
            if (savedData) {
                const data = parseSatelliteData(savedData);
                if (data.length > 0) {
                    satelliteDataStr = data.map(d => 
                        `${d.pressure.toFixed(1)} hPa | Alt: ${d.altitude}m | Temp: ${d.temp.toFixed(1)}°C | Dewp: ${d.dewpt.toFixed(1)}°C | RH: ${d.rh}% | Wind: ${d.wdir}°/${d.wspd.toFixed(0)}kt | Theta: ${d.theta.toFixed(1)} | ThetaE: ${d.thetaE.toFixed(1)}`
                    ).join('\n');
                }
            }
        } catch (e) {
            console.warn('Failed to get satellite data:', e);
        }
        processed = processed.replace(/@satellite/g, satelliteDataStr || 'No satellite data available');
        
        // @metar-history - full history with details
        let metarHistory = '';
        try {
            const cacheBuster = Date.now();
            const url = buildMetarUrl({ ids: stationCode, hours: 6, cache: cacheBuster });
            const data = await fetchAviationWeatherJson(url);
            if (data && data.length > 0) {
                data.sort((a, b) => new Date(b.reportTime) - new Date(a.reportTime));
                metarHistory = data.map(m => {
                    const time = m.reportTime ? new Date(m.reportTime).toUTCString().slice(0, -7) : '--';
                    const wind = (m.wdir ?? 'VAR') + '° @ ' + (m.wspd ?? '--') + 'kt';
                    const vis = m.visib ?? m.vis ?? '--';
                    const temp = m.temp ?? '--';
                    const cat = m.fltCat || 'VFR';
                    return `[${time}] ${m.rawOb}\n  Wind: ${wind}, Vis: ${vis}, Temp: ${temp}°C, Cat: ${cat}`;
                }).join('\n\n');
            }
        } catch (e) {
            console.warn('Failed to fetch METAR history:', e);
        }
        processed = processed.replace(/@metar-history/g, metarHistory || 'No METAR history available');
        
        return processed;
    }
    
    copyPromptBtn.addEventListener('click', async function() {
        const promptTemplate = document.getElementById('promptInput').value;
        if (!promptTemplate.trim()) {
            showToast('Write a prompt first!');
            return;
        }
        const processedText = await processPromptTemplate(promptTemplate);
        if (await copyToClipboard(processedText)) showToast('Prompt copied!');
    });
    
    // Keyword button click - insert at cursor position
    document.querySelectorAll('.keyword-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const keyword = this.dataset.keyword;
            const promptInput = document.getElementById('promptInput');
            const start = promptInput.selectionStart;
            const end = promptInput.selectionEnd;
            const text = promptInput.value;
            promptInput.value = text.substring(0, start) + keyword + text.substring(end);
            promptInput.focus();
            promptInput.selectionStart = promptInput.selectionEnd = start + keyword.length;
        });
    });

    // Data Tab - AI Predictions
    const dataBody = document.getElementById('dataPredictionsBody');
    
    function updateDataSummary() {
        const rows = dataBody.querySelectorAll('tr');
        let grokErrors = [], googleErrors = [], claudeErrors = [];
        
        rows.forEach(r => {
            const inputs = r.querySelectorAll('input');
            const grok = parseFloat(inputs[2].value);
            const google = parseFloat(inputs[3].value);
            const claude = parseFloat(inputs[4].value);
            const result = parseFloat(inputs[6].value);
            
            if (!isNaN(result)) {
                if (!isNaN(grok)) grokErrors.push(Math.abs(grok - result));
                if (!isNaN(google)) googleErrors.push(Math.abs(google - result));
                if (!isNaN(claude)) claudeErrors.push(Math.abs(claude - result));
            }
        });
        
        const avg = arr => arr.length ? (arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(1) + '°' : '--';
        
        document.getElementById('grokAvgError').textContent = avg(grokErrors);
        document.getElementById('googleAvgError').textContent = avg(googleErrors);
        document.getElementById('claudeAvgError').textContent = avg(claudeErrors);
        
        // Determine best AI
        const errors = [
            { name: 'Grok', err: grokErrors.length ? grokErrors.reduce((a,b) => a+b, 0) / grokErrors.length : Infinity },
            { name: 'Google', err: googleErrors.length ? googleErrors.reduce((a,b) => a+b, 0) / googleErrors.length : Infinity },
            { name: 'Claude', err: claudeErrors.length ? claudeErrors.reduce((a,b) => a+b, 0) / claudeErrors.length : Infinity }
        ];
        
        errors.sort((a, b) => a.err - b.err);
        document.getElementById('bestAI').textContent = errors[0].err === Infinity ? '--' : errors[0].name;
    }
    
    dataBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('Delete this row?')) {
                e.target.closest('tr').remove();
                updateDataSummary();
                saveDataToStorage();
            }
        }
    });
    
    dataBody.addEventListener('input', function() {
        updateDataSummary();
        saveDataToStorage();
    });
    
    document.getElementById('addDataRowBtn').addEventListener('click', function() {
        const today = new Date().toISOString().split('T')[0];
        const row = document.createElement('tr');
        row.innerHTML = 
            '<td><input type="date" class="table-input" value="' + today + '"></td>' +
            '<td><input type="time" class="table-input" value="12:00"></td>' +
            '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--"></td>' +
            '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--"></td>' +
            '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--"></td>' +
            '<td><input type="time" class="table-input" value="12:00"></td>' +
            '<td><input type="number" class="table-input result-input" step="0.1" placeholder="--"></td>' +
            '<td><button class="delete-btn">×</button></td>';
        dataBody.appendChild(row);
        saveDataToStorage();
    });
    
    function saveDataToStorage() {
        const rows = dataBody.querySelectorAll('tr');
        const data = [];
        rows.forEach(r => {
            const inputs = r.querySelectorAll('input');
            data.push({
                date: inputs[0].value,
                time: inputs[1].value,
                grok: inputs[2].value,
                google: inputs[3].value,
                claude: inputs[4].value,
                trendPoint: inputs[5].value,
                result: inputs[6].value
            });
        });
        localStorage.setItem('aiPredictionsData', JSON.stringify(data));
    }
    
    function loadDataFromStorage() {
        const saved = localStorage.getItem('aiPredictionsData');
        if (saved) {
            const data = JSON.parse(saved);
            dataBody.innerHTML = '';
            data.forEach(d => {
                const row = document.createElement('tr');
                row.innerHTML = 
                    '<td><input type="date" class="table-input" value="' + d.date + '"></td>' +
                    '<td><input type="time" class="table-input" value="' + d.time + '"></td>' +
                    '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--" value="' + (d.grok || '') + '"></td>' +
                    '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--" value="' + (d.google || '') + '"></td>' +
                    '<td><input type="number" class="table-input ai-input" step="0.1" placeholder="--" value="' + (d.claude || '') + '"></td>' +
                    '<td><input type="time" class="table-input" value="' + d.trendPoint + '"></td>' +
                    '<td><input type="number" class="table-input result-input" step="0.1" placeholder="--" value="' + (d.result || '') + '"></td>' +
                    '<td><button class="delete-btn">×</button></td>';
                dataBody.appendChild(row);
            });
            updateDataSummary();
        }
    }
    
    document.getElementById('saveDataBtn').addEventListener('click', function() {
        this.textContent = 'Saved!';
        setTimeout(() => this.textContent = 'Save Data', 1500);
    });
    
    loadDataFromStorage();

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
            if (dashDateEl) {
                dashDateEl.querySelector('.dash-date-value').textContent = displayDate;
            }
            

            
            if (satelliteUpdateDateStr === yesterday || satelliteUpdateDateStr < yesterday) {
                dateEl.classList.add('stale');
                if (dashDateEl) dashDateEl.classList.add('stale');
            } else {
                dateEl.classList.remove('stale');
                if (dashDateEl) dashDateEl.classList.remove('stale');
            }
        } else {
            dateEl.textContent = 'Never';
            dateEl.classList.add('stale');
            if (dashDateEl) {
                dashDateEl.querySelector('.dash-date-value').textContent = 'Never';
                dashDateEl.classList.add('stale');
            }

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
    
    // Trend Tab - Temperature Chart
    const locationCoords = {
        london: { lat: 51.5085, lon: -0.1257, name: 'London' },
        paris: { lat: 48.8566, lon: 2.3522, name: 'Paris' }
    };
    
    let trendData = null;

    function getLocalDateISO(timeZone) {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(new Date());
            const map = {};
            parts.forEach(part => {
                if (part.type !== 'literal') map[part.type] = part.value;
            });
            return map.year + '-' + map.month + '-' + map.day;
        } catch {
            return new Date().toISOString().slice(0, 10);
        }
    }

    function buildTrendApiUrl(coords, timeZone) {
        const safeTimezone = timeZone || 'auto';
        const today = getLocalDateISO(safeTimezone);
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({
            latitude: coords.lat,
            longitude: coords.lon,
            hourly: 'temperature_2m',
            temperature_unit: 'celsius',
            timezone: safeTimezone,
            start_date: today,
            end_date: today
        }).toString();
        return url.toString();
    }

    function getCurrentHourIndex(times, timeZone) {
        if (!times || times.length === 0) return 0;
        const now = new Date();
        const localTimeString = now.toLocaleString('en-US', { timeZone: timeZone });
        const localTime = new Date(localTimeString);
        const currentHour = localTime.getHours();
        const hours = times.map(t => parseInt(t.slice(11, 13), 10));
        let index = hours.indexOf(currentHour);
        if (index === -1) index = Math.min(currentHour, times.length - 1);
        return index;
    }
    
    async function fetchTrendData() {
        const coords = locationCoords[currentLocation];
        if (!coords) {
            console.error('No coordinates found for location:', currentLocation);
            showToast('Invalid location configuration');
            return;
        }
        
        document.getElementById('trendUpdated').textContent = 'Loading...';
        
        const apiUrl = buildTrendApiUrl(coords, currentTimezone);
        
        try {
            let data;
            try {
                const directRes = await fetch(apiUrl, { cache: 'no-store' });
                if (!directRes.ok) throw new Error('Direct fetch failed');
                data = await directRes.json();
                console.log('Trend data received (direct):', data);
            } catch (directError) {
                console.log('Direct fetch failed, trying proxy:', directError);
                const proxyUrl = CORS_PROXY + encodeURIComponent(apiUrl);
                const proxyRes = await fetch(proxyUrl, { cache: 'no-store' });
                if (!proxyRes.ok) throw new Error(`Proxy fetch failed: ${proxyRes.status}`);
                data = await proxyRes.json();
                console.log('Trend data received (proxy):', data);
            }
            
            if (!data.hourly || !data.hourly.temperature_2m || data.hourly.temperature_2m.length === 0) {
                throw new Error('Invalid API response structure');
            }
            
            trendData = {
                hourly: {
                    time: data.hourly.time,
                    temperature_2m: data.hourly.temperature_2m
                },
                timezone: data.timezone || currentTimezone
            };
            
            const tabContent = document.getElementById('tab-trend');
            if (tabContent && tabContent.classList.contains('active')) {
                updateTrendDisplay();
            }
        } catch (e) {
            console.error('Failed to fetch trend data:', e);
            document.getElementById('trendUpdated').textContent = 'Error';
            const grid = document.getElementById('trendHourlyGrid');
            if (grid) grid.innerHTML = '<div class="trend-hourly-item">No data</div>';
            const tableBody = document.getElementById('trendHourlyTableBody');
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="2">No data</td></tr>';
            showToast('Failed to fetch trend data');
        }
    }
    
    function updateTrendDisplay() {
        if (!trendData || !trendData.hourly) {
            document.getElementById('trendMin').textContent = '--°C';
            document.getElementById('trendMax').textContent = '--°C';
            document.getElementById('trendCurrent').textContent = '--°C';
            document.getElementById('trendUpdated').textContent = 'Loading...';
            document.getElementById('trendHourlyGrid').innerHTML = '<div class="trend-hourly-item">Loading...</div>';
            const tableBody = document.getElementById('trendHourlyTableBody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
            }
            return;
        }
        
        const coords = locationCoords[currentLocation];
        document.getElementById('trendLocationName').textContent = coords.name;
        
        const temps = trendData.hourly.temperature_2m;
        const times = trendData.hourly.time;
        const length = Math.min(temps.length, times ? times.length : temps.length);
        const safeTemps = temps.slice(0, length);
        const safeTimes = times ? times.slice(0, length) : null;
        
        if (!safeTemps || safeTemps.length === 0) {
            console.error('No temperature data available');
            return;
        }
        
        const minTemp = Math.min(...safeTemps);
        const maxTemp = Math.max(...safeTemps);
        
        const now = new Date();
        const trendTimezone = trendData.timezone || currentTimezone;
        const localTimeString = now.toLocaleString('en-US', { timeZone: trendTimezone });
        const localTime = new Date(localTimeString);
        const currentHour = localTime.getHours();
        const currentIndex = getCurrentHourIndex(safeTimes, trendTimezone);
        const currentTemp = safeTemps[currentIndex] !== undefined ? safeTemps[currentIndex] : safeTemps[0];
        
        document.getElementById('trendMin').textContent = minTemp.toFixed(1) + '°C';
        document.getElementById('trendMax').textContent = maxTemp.toFixed(1) + '°C';
        document.getElementById('trendCurrent').textContent = currentTemp.toFixed(1) + '°C';
        document.getElementById('trendUpdated').textContent = now.toLocaleTimeString().slice(0, 5);
        
        drawTrendChart(safeTemps, safeTimes, currentIndex);
        updateHourlyGrid(safeTemps, safeTimes, currentIndex);
    }
    
    function drawTrendChart(temps, times, currentHour) {
        const canvas = document.getElementById('trendChart');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        const tabContent = document.getElementById('tab-trend');
        if (!tabContent || !tabContent.classList.contains('active')) {
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const wrapper = canvas.parentElement;
        
        if (!wrapper) {
            console.error('Canvas wrapper not found');
            return;
        }
        
        const wrapperRect = wrapper.getBoundingClientRect();
        
        if (wrapperRect.width === 0 || wrapperRect.height === 0) {
            console.log('Canvas wrapper has no size, retrying...');
            setTimeout(() => drawTrendChart(temps, times, currentHour), 50);
            return;
        }
        
        canvas.style.width = wrapperRect.width + 'px';
        canvas.style.height = wrapperRect.height + 'px';
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = wrapperRect.width * dpr;
        canvas.height = wrapperRect.height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        const width = wrapperRect.width;
        const height = wrapperRect.height;
        const padding = { top: 30, right: 20, bottom: 40, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        ctx.clearRect(0, 0, width, height);
        
        const minTemp = Math.min(...temps) - 1;
        const maxTemp = Math.max(...temps) + 1;
        const tempRange = maxTemp - minTemp || 1;
        
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? '#3d4450' : '#E1E8E6';
        const textColor = isDark ? '#9aa5b1' : '#8FA3A3';
        const lineColor = '#C99B3B';
        const fillColor = isDark ? 'rgba(201,155,59,0.2)' : 'rgba(201,155,59,0.1)';
        
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            const temp = maxTemp - (tempRange / 5) * i;
            ctx.fillStyle = textColor;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(temp.toFixed(0) + '°', padding.left - 10, y + 4);
        }
        
        let maxTempIndex = 0;
        let maxTempValue = temps[0];
        for (let i = 1; i < temps.length; i++) {
            if (temps[i] > maxTempValue) {
                maxTempValue = temps[i];
                maxTempIndex = i;
            }
        }
        
        let secondMaxTempIndex = -1;
        let secondMaxTempValue = -Infinity;
        for (let i = 0; i < temps.length; i++) {
            if (i !== maxTempIndex && temps[i] > secondMaxTempValue) {
                secondMaxTempValue = temps[i];
                secondMaxTempIndex = i;
            }
        }
        
        const greenZoneIndex = Math.max(0, maxTempIndex - 3);
        const zoneWidth = chartWidth / Math.max(temps.length - 1, 1);
        
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        const greenX = padding.left + zoneWidth * greenZoneIndex;
        ctx.fillRect(greenX - zoneWidth * 0.5, padding.top, zoneWidth, chartHeight);
        
        if (secondMaxTempIndex >= 0 && secondMaxTempIndex !== maxTempIndex) {
            ctx.fillStyle = 'rgba(255, 220, 0, 0.4)';
            const yellowX = padding.left + zoneWidth * secondMaxTempIndex;
            ctx.fillRect(yellowX - zoneWidth * 0.5, padding.top, zoneWidth, chartHeight);
        }
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        const redX = padding.left + zoneWidth * maxTempIndex;
        ctx.fillRect(redX - zoneWidth * 0.5, padding.top, zoneWidth, chartHeight);
        
        ctx.fillStyle = textColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < temps.length; i += 3) {
            const x = padding.left + (chartWidth / Math.max(temps.length - 1, 1)) * i;
            const label = times && times[i] ? times[i].slice(11, 16) : i.toString().padStart(2, '0') + ':00';
            ctx.fillText(label, x, height - 10);
        }
        
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight);
        temps.forEach((temp, i) => {
            const x = padding.left + (chartWidth / Math.max(temps.length - 1, 1)) * i;
            const y = padding.top + chartHeight - ((temp - minTemp) / tempRange) * chartHeight;
            if (i === 0) ctx.lineTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        temps.forEach((temp, i) => {
            const x = padding.left + (chartWidth / Math.max(temps.length - 1, 1)) * i;
            const y = padding.top + chartHeight - ((temp - minTemp) / tempRange) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        const safeCurrentHour = Math.min(currentHour, temps.length - 1);
        const currentX = padding.left + (chartWidth / Math.max(temps.length - 1, 1)) * safeCurrentHour;
        const currentY = padding.top + chartHeight - ((temps[safeCurrentHour] - minTemp) / tempRange) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        temps.forEach((temp, i) => {
            if (i === safeCurrentHour) return;
            const x = padding.left + (chartWidth / Math.max(temps.length - 1, 1)) * i;
            const y = padding.top + chartHeight - ((temp - minTemp) / tempRange) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = lineColor;
            ctx.fill();
        });
    }
    
    function updateHourlyGrid(temps, times, currentHour) {
        const grid = document.getElementById('trendHourlyGrid');
        const tableBody = document.getElementById('trendHourlyTableBody');
        if (!grid && !tableBody) return;
        if (grid) grid.innerHTML = '';
        if (tableBody) tableBody.innerHTML = '';
        
        const safeCurrentHour = Math.min(currentHour, temps.length - 1);
        
        temps.forEach((temp, i) => {
            if (grid) {
                const item = document.createElement('div');
                item.className = 'trend-hourly-item' + (i === safeCurrentHour ? ' current' : '');
                const timeLabel = times && times[i] ? times[i].slice(11, 16) : i.toString().padStart(2, '0') + ':00';
                item.innerHTML = 
                    '<div class="trend-hourly-time">' + timeLabel + '</div>' +
                    '<div class="trend-hourly-temp">' + temp.toFixed(1) + '°</div>';
                grid.appendChild(item);
            }

            if (tableBody) {
                const row = document.createElement('tr');
                row.className = 'trend-hourly-row' + (i === safeCurrentHour ? ' current' : '');
                row.innerHTML =
                    '<td>' + timeLabel + '</td>' +
                    '<td>' + temp.toFixed(1) + '°C</td>';
                tableBody.appendChild(row);
            }
        });
    }
    
    document.getElementById('refreshTrend').addEventListener('click', function() {
        this.textContent = '...';
        fetchTrendData().then(() => {
            this.textContent = '↻';
        });
    });
    
    window.trendFetch = fetchTrendData;
    
    // Handle window resize to redraw chart
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            if (trendData && document.getElementById('tab-trend').classList.contains('active')) {
                updateTrendDisplay();
            }
        }, 250);
    });
    
    fetchTrendData();
    setInterval(fetchTrendData, 10 * 60 * 1000);
});
