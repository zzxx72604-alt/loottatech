export const environment = {
  production: false,

  /**
   * Base path for every HTTP call in the app.
   *
   * Relative on purpose: the dev server proxies /api to whatever backend is
   * running (see proxy.conf.json). Swapping the Express API for an ASP.NET Core
   * one is a change to that proxy target — no component or service is touched.
   */
  apiBase: '/api',
};
