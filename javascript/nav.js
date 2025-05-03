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

    if (activeID != null) {
      navEl.querySelector(activeID).classList.add("active")
    }

    parentEl.replaceWith(navEl);

  } catch (error) {
    console.error("Error inserting navbar:", error);
  }
}

async function insertFooter(parentEl) {
  try {
    const fFile = "footer.html";
    const response = await fetch(fFile);

    if (!response.ok) {
      throw new Error(`Failed to fetch HTML file '${fFile}': ${response.status} ${response.statusText}`);
    }

    const footer = await response.text();
    const parser = new DOMParser();
    const navDom = parser.parseFromString(footer, "text/html");
    const footEl = navDom.querySelector("footer");

    parentEl.replaceWith(footEl);

  } catch (error) {
    console.error("Error inserting footer:", error);
  }
}
