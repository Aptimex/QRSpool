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

// ACtive Tag
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
