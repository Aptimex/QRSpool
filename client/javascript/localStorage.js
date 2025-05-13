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
