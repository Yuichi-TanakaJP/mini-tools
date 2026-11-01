'use strict';
// next-pwa 5 injected only the Pages entry; keep that activation boundary.
module.exports = function preserveAppRouterEntry(config, pwaEntry) {
  const upstreamEntry = config.entry;
  config.entry = async () => {
    const entries = typeof upstreamEntry === 'function' ? await upstreamEntry() : upstreamEntry;
    if (entries['main-app']) {
      if (!Array.isArray(entries['main-app'])) throw new Error('Unreviewed PWA main-app entry shape');
      const appEntry = entries['main-app'].filter(entry => entry !== pwaEntry);
      if (appEntry.length === 0) throw new Error('PWA filtering would remove the application entry');
      entries['main-app'] = appEntry;
    }
    return entries;
  };
  return config;
};
