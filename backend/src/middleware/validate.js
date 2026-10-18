const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rejects requests whose route params aren't UUIDs before they hit Postgres
 * (otherwise pg throws "invalid input syntax for type uuid" and we 500).
 */
function uuidParams(router, ...names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (!UUID_RE.test(value)) return res.status(404).json({ error: 'Not found' });
      next();
    });
  }
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { uuidParams, isUuid };
