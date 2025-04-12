async function insertNav(parentEl) {
  try {
    const response = await fetch("/nav.html");

    if (!response.ok) {
      throw new Error(`Failed to fetch HTML file: ${response.status} ${response.statusText}`);
    }

    const nav = await response.text();
    const parser = new DOMParser();
    const navDom = parser.parseFromString(nav, "text/html");
    const navEl = navDom.querySelector("nav");
    //parentEl.innerHTML = html;
    parentEl.replaceWith(navEl);
    //parentEl.appendChild(navDom);
  } catch (error) {
    console.error("Error inserting HTML:", error);
  }
}


