/*
Getters and setters for localStorage values, with some added logic for default values and interdependent settings.
*/

// Backend Server
function setServer(server) {
    localStorage.setItem("backendServer", server);
    console.log("Server set: " + server);
}

function getServer() {
    return localStorage.getItem("backendServer");
}

function clearServer() {
    localStorage.removeItem("backendServer");
}

// Active Tag
function setActiveTagData(stringData) {
    localStorage.setItem("activeTag", stringData);
    console.log("Active tag set: " + stringData);
}

function getActiveTagData() {
    return localStorage.getItem("activeTag");
}

function clearActiveTag() {
    localStorage.removeItem("activeTag");
}

//Authentication
function setAuthRequired() {
    localStorage.setItem("authRequired", "true");
}

function setAuthNotRequired() {
    localStorage.setItem("authRequired", "false");
}

function getAuthRequired() {
    return localStorage.getItem("authRequired");
}

function isAuthRequired() {
    return (getAuthRequired() === "true")
}

function clearAuthRequired() {
    localStorage.removeItem("authRequired");
}

function setAuthCreds(username, password) {
    localStorage.setItem("basicAuthUser", username);
    localStorage.setItem("basicAuthPass", password);
    console.log("Basic Auth creds saved");
}

function getAuthUser() {
    return localStorage.getItem("basicAuthUser");
}

function getAuthPass() {
    return localStorage.getItem("basicAuthPass");
}

function getAuthCredHeader() {
    u = getAuthUser();
    p = getAuthPass();
    if (u == null || p == null) {
        return null;
    }
    return btoa("" + u + ":" + p);
}

function clearAuthCreds() {
    localStorage.removeItem("basicAuthUser");
    localStorage.removeItem("basicAuthPass");
}

// Active Slot (IDs from a scanned slot QR tag)
function setActiveSlotIDs(idsText) {
    localStorage.setItem("activeSlot", idsText);
    console.log("Active slot set: " + idsText);
}

function getActiveSlotIDs() {
    return localStorage.getItem("activeSlot");
}

function clearActiveSlot() {
    localStorage.removeItem("activeSlot");
}

// Post-apply clear settings
function setClearFilamentAfterApply(val) {
    localStorage.setItem("clearFilamentAfterApply", val ? "true" : "false");
}

function getClearFilamentAfterApply() {
    return localStorage.getItem("clearFilamentAfterApply") === "true";
}

function setClearSlotAfterApply(val) {
    localStorage.setItem("clearSlotAfterApply", val ? "true" : "false");
}

function getClearSlotAfterApply() {
    let v = localStorage.getItem("clearSlotAfterApply");
    if (v === null) return true; // default true so at least one tag is always cleared
    return v === "true";
}

// Play a sound on successful tag scan (intended for browsers without vibration support, e.g. iOS Safari)
function setScanSound(val) {
    localStorage.setItem("scanSound", val ? "true" : "false");
}

function getScanSound() {
    return localStorage.getItem("scanSound") === "true";
}

// Skip waiting for a slot tag and jump straight to Apply after scanning a filament tag
function setAlwaysJumpToApply(val) {
    localStorage.setItem("alwaysJumpToApply", val ? "true" : "false");
}

function getAlwaysJumpToApply() {
    return localStorage.getItem("alwaysJumpToApply") === "true";
}

// Require manual confirmation before auto-applying a scanned filament+slot pair
function setRequireApplyConfirmation(val) {
    localStorage.setItem("requireApplyConfirmation", val ? "true" : "false");
}

function getRequireApplyConfirmation() {
    return localStorage.getItem("requireApplyConfirmation") === "true";
}

// Minimum delay (ms) between processing successive tag scans
function setScanDelay(ms) {
    localStorage.setItem("scanDelay", parseInt(ms));
}

function getScanDelay() {
    let v = localStorage.getItem("scanDelay");
    return v === null ? 1500 : parseInt(v);
}

// Saved Printer Profiles
function getSavedPrinters() {
    let v = localStorage.getItem("savedPrinters");
    return v ? JSON.parse(v) : [];
}

function setSavedPrinters(printers) {
    localStorage.setItem("savedPrinters", JSON.stringify(printers));
}

function getActivePrinterName() {
    return localStorage.getItem("activePrinterName");
}

function setActivePrinterName(name) {
    localStorage.setItem("activePrinterName", name);
}

function clearActivePrinterName() {
    localStorage.removeItem("activePrinterName");
}

// Switch the active server to a saved printer profile
function switchToPrinter(printer) {
    setServer(printer.url);
    setAuthCreds(printer.user || "", printer.pass || "");
    setActivePrinterName(printer.name);
}

function deleteSavedPrinter(id) {
    setSavedPrinters(getSavedPrinters().filter(p => p.id !== id));
}

//Torch
function setTorchStart(tBool) {
    localStorage.setItem("torchStartsOn", tBool);
}

function getTorchStart() {
    let ts = localStorage.getItem("torchStartsOn");
    if (! ts || ts == "false") {
        return false;
    } else {
        return true;
    }
}
