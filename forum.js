(() => {
  const listEl = document.getElementById("threadList");
  const countEl = document.getElementById("threadCount");
  const catsEl = document.getElementById("forumCats");
  const form = document.getElementById("threadForm");
  const titleEl = document.getElementById("threadTitle");
  const categoryEl = document.getElementById("threadCategory");
  const contentEl = document.getElementById("threadContent");
  const statusEl = document.getElementById("threadStatus");
  const avatarEl = document.getElementById("forumAvatar");
  const userNameEl = document.getElementById("forumUserName");
  const userHandleEl = document.getElementById("forumUserHandle");

  const notify = (message) => {
    if (typeof window.s4Toast === "function") window.s4Toast(message);
  };

  let threads = [];
  let categories = [];
  let activeCategory = "Tous";

  const formatDate = (iso) => {
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso)
      );
    } catch {
      return "";
    }
  };

  const renderUser = (user) => {
    if (!user) return;

    if (avatarEl) {
      avatarEl.onerror = () => {
        avatarEl.onerror = null;
        avatarEl.src = "https://cdn.discordapp.com/embed/avatars/0.png";
      };
      avatarEl.src = user.avatarUrl;
      avatarEl.alt = `Photo de profil de ${user.name}`;
    }
    if (userNameEl) userNameEl.textContent = user.name;
    if (userHandleEl) userHandleEl.textContent = `@${user.username}`;
  };

  const renderCategories = () => {
    if (!catsEl) return;
    catsEl.replaceChildren();

    ["Tous", ...categories].forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "forum-cat";
      button.textContent = category;
      if (category === activeCategory) button.classList.add("active");
      button.addEventListener("click", () => {
        activeCategory = category;
        renderCategories();
        renderThreads();
      });
      catsEl.append(button);
    });
  };

  const buildThread = (thread) => {
    const article = document.createElement("article");
    article.className = "thread";

    const head = document.createElement("div");
    head.className = "thread-head";

    const avatar = document.createElement("img");
    avatar.className = "thread-avatar";
    avatar.src = thread.author.avatarUrl;
    avatar.alt = "";
    avatar.width = 40;
    avatar.height = 40;
    avatar.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "thread-meta";
    const author = document.createElement("strong");
    author.textContent = thread.author.name;
    const time = document.createElement("small");
    time.textContent = formatDate(thread.createdAt);
    meta.append(author, time);

    const category = document.createElement("span");
    category.className = "thread-cat";
    category.textContent = thread.category;

    head.append(avatar, meta, category);

    const title = document.createElement("h3");
    title.className = "thread-title";
    title.textContent = thread.title;

    const body = document.createElement("p");
    body.className = "thread-body";
    body.textContent = thread.content;

    article.append(head, title, body);
    return article;
  };

  const renderThreads = () => {
    if (!listEl) return;
    const visible =
      activeCategory === "Tous"
        ? threads
        : threads.filter((thread) => thread.category === activeCategory);

    if (countEl) countEl.textContent = `${visible.length} sujet${visible.length > 1 ? "s" : ""}`;

    listEl.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "forum-empty";
      empty.textContent = "Aucun sujet pour le moment. Lance la discussion !";
      listEl.append(empty);
      return;
    }

    visible.forEach((thread) => listEl.append(buildThread(thread)));
  };

  const fillCategories = () => {
    if (!categoryEl) return;
    categoryEl.replaceChildren();
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryEl.append(option);
    });
  };

  const load = async () => {
    try {
      const response = await fetch("/api/forum/threads", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      if (response.status === 401) {
        location.assign(`/auth/discord?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      threads = Array.isArray(data.threads) ? data.threads : [];
      categories = Array.isArray(data.categories) ? data.categories : [];

      fillCategories();
      renderCategories();
      renderThreads();
    } catch (error) {
      console.error("[Forum] Chargement impossible.", error);
      if (listEl) {
        listEl.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "forum-empty";
        empty.textContent = "Impossible de charger le forum. Vérifie que le serveur est lancé.";
        listEl.append(empty);
      }
    }
  };

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (statusEl) statusEl.textContent = "";

      const payload = {
        title: titleEl ? titleEl.value.trim() : "",
        category: categoryEl ? categoryEl.value : "",
        content: contentEl ? contentEl.value.trim() : ""
      };

      if (payload.title.length < 3) {
        if (statusEl) statusEl.textContent = "Le titre doit contenir au moins 3 caractères.";
        return;
      }
      if (!payload.content) {
        if (statusEl) statusEl.textContent = "Écris un message avant de publier.";
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      try {
        const response = await fetch("/api/forum/threads", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        });

        if (response.status === 401) {
          location.assign(`/auth/discord?next=${encodeURIComponent(location.pathname)}`);
          return;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        threads.unshift(data.thread);
        activeCategory = "Tous";
        form.reset();
        renderCategories();
        renderThreads();
        if (statusEl) statusEl.textContent = "Sujet publié.";
        notify("Sujet publié sur le forum.");
      } catch (error) {
        if (statusEl) statusEl.textContent = error.message || "Impossible de publier le sujet.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const boot = async () => {
    const user = window.s4Auth ? await window.s4Auth.ready : null;
    if (!user) return;
    renderUser(user);
    await load();
  };

  boot();
})();
