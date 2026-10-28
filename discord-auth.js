(() => {
  const config = window.S4_DISCORD || {};
  const clientId = String(config.clientId || "").trim();
  const redirectUri = String(config.redirectUri || "").trim() || location.origin + location.pathname;

  const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
  const TOKEN_URL = "https://discord.com/api/oauth2/token";
  const REVOKE_URL = "https://discord.com/api/oauth2/token/revoke";
  const USER_URL = "https://discord.com/api/users/@me";
  const CDN_URL = "https://cdn.discordapp.com";

  const TOKEN_KEY = "s4:discord:token";
  const USER_KEY = "s4:discord:user";
  const VERIFIER_KEY = "s4:discord:verifier";
  const STATE_KEY = "s4:discord:state";

  const loginButtons = Array.from(document.querySelectorAll("[data-discord-login]"));
  const loginButton = document.getElementById("discordLogin");
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

  if (loginButton) loginButtons.push(loginButton);

  const notify = (message) => {
    if (typeof window.s4Toast === "function") window.s4Toast(message);
  };

  const encodeBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const randomString = (size = 32) => {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return encodeBase64Url(bytes);
  };

  const createChallenge = async (verifier) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return encodeBase64Url(digest);
  };

  const readToken = () => {
    try {
      const token = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if (!token || !token.accessToken) return null;
      if (token.expiresAt && Date.now() > token.expiresAt - 60000) {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        return null;
      }
      return token;
    } catch {
      return null;
    }
  };

  const readUser = () => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  };

  const cleanUrl = () => {
    const url = new URL(location.href);
    ["code", "state", "error", "error_description"].forEach((key) => url.searchParams.delete(key));
    const query = url.searchParams.toString();
    history.replaceState({}, document.title, url.pathname + (query ? `?${query}` : "") + url.hash);
  };

  const defaultAvatar = (user) => {
    let index = 0;
    try {
      index = Number((BigInt(user.id) >> 22n) % 6n);
    } catch {
      index = 0;
    }
    return `${CDN_URL}/embed/avatars/${index}.png`;
  };

  const avatarUrl = (user, size = 128) => {
    if (!user.avatar) return defaultAvatar(user);
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `${CDN_URL}/avatars/${user.id}/${user.avatar}.${extension}?size=${size}`;
  };

  const displayName = (user) => user.global_name || user.display_name || user.username || "Utilisateur Discord";

  const setAvatar = (element, user) => {
    if (!element) return;
    const fallback = `${CDN_URL}/embed/avatars/0.png`;
    element.onerror = () => {
      element.onerror = null;
      element.src = fallback;
    };
    element.src = avatarUrl(user);
    element.alt = `Photo de profil de ${displayName(user)}`;
  };

  const setMenu = (open) => {
    if (!userMenu || !userButton) return;
    userMenu.hidden = !open;
    userButton.setAttribute("aria-expanded", String(open));
  };

  const renderLoggedOut = () => {
    setMenu(false);
    if (navUser) navUser.hidden = true;
    loginButtons.forEach((button) => {
      button.hidden = false;
    });
  };

  const renderUser = (user) => {
    setMenu(false);
    if (navUser) navUser.hidden = false;
    loginButtons.forEach((button) => {
      button.hidden = true;
    });

    setAvatar(userAvatar, user);
    setAvatar(userAvatarMenu, user);

    const name = displayName(user);
    if (userName) userName.textContent = name;
    if (userDisplayName) userDisplayName.textContent = name;
    if (userHandle) userHandle.textContent = `@${user.username}`;
    if (userProfile) userProfile.href = `https://discord.com/users/${user.id}`;
    if (userButton) userButton.setAttribute("aria-label", `Profil Discord de ${name}`);
  };

  const refreshUser = async () => {
    const token = readToken();
    if (!token) {
      renderLoggedOut();
      return null;
    }

    try {
      const response = await fetch(USER_URL, {
        headers: { Authorization: `Bearer ${token.accessToken}` }
      });

      if (response.status === 401) {
        clearSession();
        renderLoggedOut();
        return null;
      }

      if (!response.ok) throw new Error(`Discord ${response.status}`);

      const user = await response.json();
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      renderUser(user);
      return user;
    } catch (error) {
      const cached = readUser();
      if (cached) {
        renderUser(cached);
        return cached;
      }
      renderLoggedOut();
      console.error("[Discord] Impossible de charger le profil.", error);
      return null;
    }
  };

  const startLogin = async () => {
    if (readToken() && readUser()) {
      setMenu(true);
      notify("Tu es déjà connecté à Discord.");
      return;
    }

    if (!clientId) {
      notify("Connexion Discord indisponible : ajoutez votre Client ID dans discord-config.js.");
      return;
    }

    if (location.protocol === "file:") {
      notify("Ouvre le site via http://localhost ou HTTPS, pas en file://.");
      return;
    }

    if (!window.crypto || !crypto.subtle) {
      notify("La connexion Discord nécessite une page servie en HTTPS.");
      return;
    }

    try {
      const verifier = randomString(32);
      const state = randomString(16);
      const challenge = await createChallenge(verifier);

      sessionStorage.setItem(VERIFIER_KEY, verifier);
      sessionStorage.setItem(STATE_KEY, state);

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "identify",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
      });

      location.assign(`${AUTHORIZE_URL}?${params.toString()}`);
    } catch (error) {
      console.error("[Discord] Impossible de démarrer la connexion.", error);
      notify("Impossible de démarrer la connexion Discord.");
    }
  };

  const handleCallback = async () => {
    const url = new URL(location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (!code && !error) return false;

    const expectedState = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);

    cleanUrl();
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);

    if (error) {
      console.warn("[Discord] Callback refusé", error, errorDescription);
      notify(`Connexion Discord refusée : ${errorDescription || error}`);
      return true;
    }

    if (!state || state !== expectedState || !verifier) {
      notify("Session Discord expirée. Réessaie la connexion.");
      return true;
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      });

      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      if (!response.ok) {
        let detail = `Discord ${response.status}`;
        try {
          const payload = await response.json();
          if (payload && (payload.error_description || payload.error)) {
            detail = payload.error_description || payload.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const token = await response.json();
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
        accessToken: token.access_token,
        expiresAt: Date.now() + Number(token.expires_in || 0) * 1000
      }));

      const user = await refreshUser();
      if (user) notify(`Connecté en tant que ${displayName(user)}.`);
    } catch (error) {
      console.error("[Discord] Échec de la connexion.", error);
      notify("La connexion Discord a échoué. Réessaie.");
    }

    return true;
  };

  const logout = async () => {
    const token = readToken();
    setMenu(false);
    clearSession();
    renderLoggedOut();
    notify("Tu es déconnecté de Discord.");

    if (!token || !clientId) return;

    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: token.accessToken, token_type_hint: "access_token", client_id: clientId })
      });
    } catch {
      /* ignore */
    }
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

  (async () => {
    const handled = await handleCallback();
    if (!handled) await refreshUser();
  })();
})();
