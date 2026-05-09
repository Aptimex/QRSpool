// Injects a simple on-page console log panel for easier debugging on mobile devices. A clickable "Debug" button is injected at the bottom-right of the page, which shows and hides the log. 

(function () {
    const container = document.createElement('div');
    container.style.cssText = 'font-family:monospace;font-size:12px;';

    const toggle = document.createElement('div');
    toggle.textContent = 'Debug';
    toggle.style.cssText = 'cursor:pointer;opacity:0.35;text-align:right;padding:2px 8px;user-select:none;color:#888;font-size:11px;';
    toggle.addEventListener('mouseenter', () => toggle.style.opacity = '0.8');
    toggle.addEventListener('mouseleave', () => { if (!panelVisible) toggle.style.opacity = '0.35'; });

    const panel = document.createElement('div');
    panel.style.cssText = 'display:none;background:rgba(0,0,0,0.88);color:#eee;max-height:40vh;overflow-y:auto;padding:4px 6px;border-top:1px solid #444;';

    let panelVisible = false;
    toggle.addEventListener('click', () => {
        panelVisible = !panelVisible;
        panel.style.display = panelVisible ? 'block' : 'none';
        toggle.style.opacity = panelVisible ? '0.9' : '0.35';
    });

    const colors = { log: '#ddd', warn: '#f0c040', error: '#ff6b6b', info: '#6cf' };

    function addEntry(level, args) {
        const line = document.createElement('div');
        line.style.cssText = `color:${colors[level] || '#ddd'};border-bottom:1px solid #222;padding:1px 0;white-space:pre-wrap;word-break:break-all;`;
        const time = new Date().toTimeString().slice(0, 8);
        const text = args.map(a => {
            if (a instanceof Error) return a.stack || String(a);
            if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a, null, 2); } catch { return String(a); } }
            return String(a);
        }).join(' ');
        line.textContent = `[${time}] ${level.toUpperCase()}: ${text}`;
        panel.appendChild(line);
        panel.scrollTop = panel.scrollHeight;
    }

    ['log', 'warn', 'error', 'info'].forEach(level => {
        const orig = console[level].bind(console);
        console[level] = (...args) => { orig(...args); addEntry(level, args); };
    });

    window.addEventListener('error', e => addEntry('error', [e.message + (e.filename ? ` (${e.filename}:${e.lineno})` : '')]));
    window.addEventListener('unhandledrejection', e => addEntry('error', ['Unhandled promise rejection: ' + (e.reason?.stack || e.reason)]));

    container.appendChild(toggle);
    container.appendChild(panel);

    function attach() {
        const footer = document.getElementById('footerPlaceholder');
        if (footer) { footer.parentNode.insertBefore(container, footer); }
        else { document.body.appendChild(container); }
    }
    if (document.body) { attach(); } else { document.addEventListener('DOMContentLoaded', attach); }
})();
