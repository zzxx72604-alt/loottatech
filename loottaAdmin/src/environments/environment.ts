export const environment = {
  production: false,

  /**
   * The admin app talks to the ASP.NET Core API directly over CORS.
   * The API already allows http://localhost:4300 (see Program.cs).
   */
  apiBase: 'http://localhost:5197/api',

  /** Where uploaded product photos are served from. */
  fileBase: 'http://localhost:5197',
};
