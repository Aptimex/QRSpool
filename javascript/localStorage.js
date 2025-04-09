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

function getActiveTagData(stringData) {
    return localStorage.getItem("activeTag");
}

function clearActiveTag() {
    localStorage.removeItem("activeTag");
}

//Auth Required
function setAuthRequired() {
    localStorage.setItem("authRequired", "true");
    console.log("Auth Required: true" );
}

function setAuthNotRequired() {
    localStorage.setItem("authRequired", "false");
    console.log("Auth Required: false" );
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
