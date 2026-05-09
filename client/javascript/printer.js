// Injects a compact printer status bar into containerEl.
// Fetches the printer list and active printer from the server, then renders
// a name label (single printer) or <select> dropdown (multiple printers).
async function injectPrinterSelector(containerEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'printer-bar d-flex align-items-center flex-wrap gap-2 mb-3 px-3 py-2 bg-body-tertiary rounded border';

    const label = document.createElement('span');
    label.className = 'text-muted small text-nowrap';
    label.textContent = 'Printer:';
    wrapper.appendChild(label);

    // Placeholder updated once data arrives
    const statusEl = document.createElement('span');
    statusEl.className = 'small text-muted';
    wrapper.appendChild(statusEl);

    containerEl.appendChild(wrapper);

    if (!getServerURL()) {
        statusEl.textContent = 'Not configured';
        statusEl.classList.replace('text-muted', 'text-danger');
        return;
    }

    statusEl.textContent = 'Loading…';

    const [printersResp, activeResp] = await Promise.all([
        getPrinters(),
        getActivePrinter()
    ]);

    if (printersResp.error || activeResp.error) {
        statusEl.textContent = printersResp.error || activeResp.error;
        statusEl.classList.replace('text-muted', 'text-danger');
        return;
    }

    const printers = printersResp;   // string[]
    const activeName = activeResp.name;

    if (printers.length <= 1) {
        statusEl.className = 'small fw-semibold text-truncate';
        statusEl.style.maxWidth = '220px';
        statusEl.textContent = activeName || printers[0] || 'Unknown';
        return;
    }

    // Multiple printers: replace placeholder with a <select>
    const sel = document.createElement('select');
    sel.className = 'form-select form-select-sm';
    sel.style.maxWidth = '220px';
    printers.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === activeName) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', async () => {
        sel.disabled = true;
        const result = await setActivePrinter(sel.value);
        if (result.error) {
            sel.disabled = false;
            console.error('Failed to switch printer:', result.error);
            sel.insertAdjacentHTML('afterend', `<span class="small text-danger">${result.error}</span>`);
        } else {
            window.location.reload();
        }
    });
    statusEl.replaceWith(sel);
}
