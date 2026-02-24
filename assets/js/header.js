(() => {
  const HEADER = {
    logo: {
      href: "/index.html",
      name: "Gavin Medeiros",
      tagline: "", // optional if you want one later
    },
    socials: [
      { label: "Strava", href: "https://www.strava.com/athletes/115836309", iconClass: "icon brands fa-strava" },
      //{ label: "GitHub", href: "https://github.com/NorthernIndian", iconClass: "icon brands fa-github" },
      { label: "Instagram", href: "https://www.instagram.com/gavinmeds/?hl=en", iconClass: "icon brands fa-instagram" },
      //{ label: "YouTube", href: "https://www.youtube.com/@gavinmedeiros2076/featured", iconClass: "icon brands fa-youtube" },
    ],
  };

  function buildHeaderHTML() {
    const socialsHtml = HEADER.socials
      .map(
        (s) => `
          <li>
            <a href="${s.href}" class="${s.iconClass}" target="_blank" rel="noopener">
              <span class="label">${s.label}</span>
            </a>
          </li>
        `
      )
      .join("");

    const tagline = HEADER.logo.tagline ? ` ${HEADER.logo.tagline}` : "";

    return `
      <a href="${HEADER.logo.href}" class="logo">
        <strong>${HEADER.logo.name}</strong>${tagline}
      </a>
      <ul class="icons">
        ${socialsHtml}
      </ul>
    `;
  }

  function initHeader() {
    const header = document.getElementById("header");
    if (!header) return;
    header.innerHTML = buildHeaderHTML();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeader);
  } else {
    initHeader();
  }
})();