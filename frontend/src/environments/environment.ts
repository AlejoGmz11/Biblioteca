export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  siteUrl: 'http://localhost:4200',
  /**
   * Minutos de inactividad tras los que se cierra la sesión. 7 días, igual que
   * la vida del refresh token: con 30 minutos la app se cerraba al dejar la
   * pestaña un rato o al leer un libro sin tocar nada más.
   */
  sessionTimeoutMinutes: 7 * 24 * 60
};
