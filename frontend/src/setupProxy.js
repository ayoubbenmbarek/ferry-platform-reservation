const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy all /api requests
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
    })
  );

  // Proxy /auth requests (rewrite to /api/v1/auth)
  app.use(
    '/auth',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/auth': '/api/v1/auth',
      },
    })
  );

  // Proxy /bookings requests (rewrite to /api/v1/bookings)
  app.use(
    '/bookings',
    createProxyMiddleware({
      target: 'http://localhost:8010',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/bookings': '/api/v1/bookings',
      },
    })
  );
};