/**
 * Cognito Hosted UI authentication (implicit flow).
 * Requires config.js with COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION.
 * Call Auth.init() after config is loaded (e.g. from app.js or index).
 */
window.Auth = (function () {
  const STORAGE_KEY_ID = 'cognito_id_token';
  const STORAGE_KEY_EMAIL = 'cognito_email';

  function getConfig() {
    var c = window.APP_CONFIG || {};
    var poolId = c.COGNITO_USER_POOL_ID;
    var clientId = c.COGNITO_CLIENT_ID;
    var region = c.COGNITO_REGION || 'us-east-1';
    if (!poolId || !clientId) return null;
    return { poolId: poolId, clientId: clientId, region: region };
  }

  function getDomain() {
    var cfg = getConfig();
    if (!cfg) return null;
    return cfg.poolId + '.auth.' + cfg.region + '.amazoncognito.com';
  }

  /** Build Cognito Hosted UI login URL (implicit flow). */
  function getLoginUrl() {
    var cfg = getConfig();
    if (!cfg) return null;
    var domain = getDomain();
    var redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    var scope = encodeURIComponent('openid email');
    return 'https://' + domain + '/oauth2/authorize?identity_provider=Cognito&redirect_uri=' + redirectUri + '&response_type=token&client_id=' + cfg.clientId + '&scope=' + scope;
  }

  /** Build Cognito logout URL. */
  function getLogoutUrl() {
    var cfg = getConfig();
    if (!cfg) return null;
    var domain = getDomain();
    var logoutRedirect = encodeURIComponent(window.location.origin + window.location.pathname);
    return 'https://' + domain + '/logout?client_id=' + cfg.clientId + '&logout_uri=' + logoutRedirect;
  }

  /** Parse hash fragment for id_token and optional email (from decoded JWT). */
  function parseHash() {
    var hash = window.location.hash;
    if (!hash) return null;
    var params = {};
    hash.replace(/^#/, '').split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv.length === 2) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    });
    var idToken = params.id_token || null;
    var accessToken = params.access_token || null;
    if (!idToken) return null;
    try {
      var payload = JSON.parse(atob(idToken.split('.')[1]));
      var email = payload.email || payload['cognito:username'] || null;
      return { idToken: idToken, accessToken: accessToken, email: email };
    } catch (e) {
      return { idToken: idToken, accessToken: accessToken, email: null };
    }
  }

  /** Call once on app load: parse hash and store token, then clean URL. */
  function init() {
    var parsed = parseHash();
    if (parsed) {
      try {
        sessionStorage.setItem(STORAGE_KEY_ID, parsed.idToken);
        if (parsed.email) sessionStorage.setItem(STORAGE_KEY_EMAIL, parsed.email);
      } catch (e) {}
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function getToken() {
    try {
      return sessionStorage.getItem(STORAGE_KEY_ID);
    } catch (e) {
      return null;
    }
  }

  function getEmail() {
    try {
      return sessionStorage.getItem(STORAGE_KEY_EMAIL);
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_ID);
      sessionStorage.removeItem(STORAGE_KEY_EMAIL);
    } catch (e) {}
    var url = getLogoutUrl();
    if (url) window.location.href = url;
    else window.location.reload();
  }

  function login() {
    var url = getLoginUrl();
    if (url) window.location.href = url;
    else alert('Cognito not configured. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID in config.js');
  }

  return {
    init: init,
    getToken: getToken,
    getEmail: getEmail,
    isLoggedIn: isLoggedIn,
    login: login,
    logout: logout,
    getLoginUrl: getLoginUrl,
    getLogoutUrl: getLogoutUrl
  };
})();
