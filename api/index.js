const { app, initializeDatabase } = require('../server/app');

let databaseReady;

module.exports = async function handler(req, res) {
  try {
    databaseReady ||= initializeDatabase();
    await databaseReady;
  } catch (error) {
    console.error('Could not initialize the Neon database.', error);
    return res.status(500).json({ error: 'The database is unavailable. Check the deployment environment variables.' });
  }

  // Vercel rewrites nested /api/* URLs to this one function and places the
  // original API path in __route. Restore it so Express receives /api/....
  const rewrittenUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const route = rewrittenUrl.searchParams.get('__route') || '';
  rewrittenUrl.searchParams.delete('__route');
  const pathname = route ? `/api/${route}` : '/api';
  req.url = `${pathname}${rewrittenUrl.search}`;

  return app(req, res);
};
