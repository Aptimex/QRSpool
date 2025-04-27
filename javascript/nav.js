async function insertNav(parentEl, activeID=null) {
  try {
    const nFile = "nav.html";
    const response = await fetch(nFile);

    if (!response.ok) {
      throw new Error(`Failed to fetch HTML file '${nFile}': ${response.status} ${response.statusText}`);
    }

    const nav = await response.text();
    const parser = new DOMParser();
    const navDom = parser.parseFromString(nav, "text/html");
    const navEl = navDom.querySelector("nav");
    //parentEl.innerHTML = html;

    if (activeID != null) {
      navEl.querySelector(activeID).classList.add("active")
    }

    parentEl.replaceWith(navEl);
    //parentEl.appendChild(navDom);

  } catch (error) {
    console.error("Error inserting HTML:", error);
  }
}


