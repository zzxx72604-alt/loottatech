export const environment = {
  production: true,

  /**
   * In production Nginx serves the admin app and reverse-proxies /api to
   * Kestrel on the same host, so these become relative and CORS disappears.
   */
  apiBase: '/api',
  fileBase: '',
};
