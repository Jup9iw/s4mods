(() => {
  const loginButtons = Array.from(document.querySelectorAll("[data-discord-login]"));
  const navUser = document.getElementById("navUser");
  const userButton = document.getElementById("userBtn");
  const userMenu = document.getElementById("userMenu");
  const userAvatar = document.getElementById("userAvatar");
  const userAvatarMenu = document.getElementById("userAvatarMenu");
  const userName = document.getElementById("userName");
  const userDisplayName = document.getElementById("userDisplayName");
  const userHandle = document.getElementById("userHandle");
  const userProfile = document.getElementById("userProfile");
  const logoutButton = document.getElementById("logoutBtn");

  const AUTH_MESSAGES = {
    config: "Connexion Discord indisponible : configuration serveur manquante.",
    state: "Session de connexion expirée. Réessaie.",
    guild: "Rejoins le serveur Discord pour accéder au forum.",
    denied: "Connexion Discord annulée.",
    code: "Connexion Discord incomplète. Réessaie.",
    error: "La connexion Discord a échoué. Réessaie."
  };

  const notify = (message) => {
    if (typeof window.s4Toast === "function") window.s4Toast(message);
  };

  let currentUser = null;
  let serverAvailable = true;

  try {
    sessionStorage.removeItem("s4:discord:token");
    sessionStorage.removeItem("s4:discord:user");
    sessionStorage.removeItem("s4:discord:verifier");
    sessionStorage.removeItem("s4:discord:state");
  } catch {
    /* stockage indisponible */
  }

  const cleanUrl = () => {
    const url = new URL(location.href);
    ["auth", "auth_message", "code", "state", "error", "error_description"].forEach((key) =>
      url.searchParams.delete(key)
    );
    const query = url.searchParams.toString();
    history.replaceState({}, document.title, url.pathname + (query ? `?${query}` : "") + url.hash);
  };

  const notifyAuthError = () => {
    const url = new URL(location.href);
    const reason = url.searchParams.get("auth");
    if (!reason) return;
    const custom = url.searchParams.get("auth_message");
    notify(custom || AUTH_MESSAGES[reason] || "Connexion Discord impossible.");
    cleanUrl();
  };

  const setMenu = (open) => {
    if (!userMenu || !userButton) return;
    userMenu.hidden = !open;
    userButton.setAttribute("aria-expanded", String(open));
  };

  const setAvatar = (element, user) => {
    if (!element) return;
    const fallback = "https://cdn.discordapp.com/embed/avatars/0.png";
    element.onerror = () => {
      element.onerror = null;
      element.src = fallback;
    };
    element.src = user.avatarUrl;
    element.alt = `Photo de profil de ${user.name}`;
  };

  const renderLoggedOut = () => {
    currentUser = null;
    setMenu(false);
    if (navUser) navUser.hidden = true;
    loginButtons.forEach((button) => {
      button.hidden = false;
    });
  };

  const renderUser = (user) => {
    currentUser = user;
    setMenu(false);
    if (navUser) navUser.hidden = false;
    loginButtons.forEach((button) => {
      button.hidden = true;
    });

    setAvatar(userAvatar, user);
    setAvatar(userAvatarMenu, user);

    if (userName) userName.textContent = user.name;
    if (userDisplayName) userDisplayName.textContent = user.name;
    if (userHandle) userHandle.textContent = `@${user.username}`;
    if (userProfile) userProfile.href = user.profileUrl;
    if (userButton) userButton.setAttribute("aria-label", `Profil Discord de ${user.name}`);
  };

  const loadSession = async () => {
    try {
      const response = await fetch("/auth/me", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });

      if (response.status === 404) {
        serverAvailable = false;
        renderLoggedOut();
        return null;
      }

      if (response.status === 401) {
        serverAvailable = true;
        renderLoggedOut();
        return null;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      serverAvailable = true;
      if (data.authenticated && data.user) {
        renderUser(data.user);
        return data.user;
      }
      renderLoggedOut();
      return null;
    } catch (error) {
      serverAvailable = false;
      renderLoggedOut();
      console.error("[Discord] Session indisponible.", error);
      return null;
    }
  };

  const startLogin = () => {
    if (currentUser) {
      setMenu(userMenu ? userMenu.hidden : false);
      return;
    }

    if (!serverAvailable) {
      notify("Connexion indisponible : lance le site avec npm start puis ouvre http://localhost:7477/s4mods/");
      return;
    }

    const next = location.pathname + location.search;
    location.assign(`/auth/discord?next=${encodeURIComponent(next)}`);
  };

  const logout = async () => {
    try {
      if (serverAvailable) {
        await fetch("/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        });
      }
    } catch {
      /* ignoré */
    }

    renderLoggedOut();

    const redirect = document.body.dataset.logoutRedirect;
    if (redirect) {
      location.assign(redirect);
      return;
    }

    notify("Tu es déconnecté de Discord.");
  };

  loginButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      startLogin();
    });
  });

  if (userButton && userMenu) {
    userButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenu(userMenu.hidden);
    });

    document.addEventListener("click", (event) => {
      if (navUser && !navUser.contains(event.target)) setMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenu(false);
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  const ready = (async () => {
    notifyAuthError();
    const user = await loadSession();

    if (document.body.dataset.requiresAuth === "true" && !user) {
      location.replace(`/auth/discord?next=${encodeURIComponent(location.pathname)}`);
      return null;
    }

    const note = document.body.dataset.authNote;
    if (note && user) notify(note);

    document.dispatchEvent(new CustomEvent("s4:auth", { detail: { user } }));
    return user;
  })();

  window.s4Auth = {
    ready,
    getUser: () => currentUser,
    logout
  };
})();
