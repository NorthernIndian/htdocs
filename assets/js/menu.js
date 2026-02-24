(() => {
  // ----------------------------
  //  EDIT THESE IN ONE PLACE
  // ----------------------------

  const MENU = [
    { label: "Homepage", href: "/index.html" },
    { label: "Now", href: "/now.html" },
    { label: "Blog", href: "/blog.html" },
    {
      label: "Death Clock",
      href: "https://iwasweak.com/death?n=Gavin&bd=07-05-1986&e=82",
      external: true,
    },
    { label: "More...", href: "/more.html" },
  ];

  const CONTACT = {
    title: "Get in touch",
    blurb: "Feel free to drop me a line.",
    items: [
      {
        iconClass: "icon solid fa-envelope",
        html: `<a href="mailto:gavin@gvnmdrs.ca">gavin@gvnmdrs.ca</a>`,
      },
    ],
  };

  const FOOTER_HTML = `
    <footer id="footer">
      <p class="copyright">
        &copy; Untitled. All rights reserved.
        Demo Images: <a href="https://unsplash.com">Unsplash</a>.
        Design: <a href="https://html5up.net">HTML5 UP</a>.
      </p>
    </footer>
  `;

  // ----------------------------
  //  BUILDERS
  // ----------------------------

  function normalizePath(p) {
    if (!p) return "/";
    if (p === "/") return "/index.html";
    return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  }

  function isActive(href) {
    // only do "active" for internal links
    if (!href || href.startsWith("http")) return false;
    const current = normalizePath(window.location.pathname);
    const target = normalizePath(href);
    return current === target;
  }

  function buildMenuHTML(items) {
    return items
      .map((item) => {
        const active = isActive(item.href) ? ' class="active"' : "";
        const target = item.external ? ` target="_blank" rel="noopener noreferrer"` : "";
        return `<li><a${active} href="${item.href}"${target}>${item.label}</a></li>`;
      })
      .join("");
  }

  function buildBottomHTML() {
    const contactItems = CONTACT.items
      .map((i) => `<li class="${i.iconClass}">${i.html}</li>`)
      .join("");

    return `
      <section>
        <header class="major">
          <h2>${CONTACT.title}</h2>
        </header>
        <p>${CONTACT.blurb}</p>
        <ul class="contact">
          ${contactItems}
        </ul>
      </section>
      ${FOOTER_HTML}
    `;
  }

  // ----------------------------
  //  INIT
  // ----------------------------

  function initMenu() {
    const menuNav = document.getElementById("menu");
    if (!menuNav) return;

    const ul = menuNav.querySelector("ul");
    if (!ul) return;

    ul.innerHTML = buildMenuHTML(MENU);
  }

  function initBottom() {
    const mount = document.getElementById("sidebar-bottom");
    if (!mount) return;
    mount.innerHTML = buildBottomHTML();
  }

  // IMPORTANT: run immediately so template JS can bind any menu behaviors
  initMenu();
  initBottom();
})();