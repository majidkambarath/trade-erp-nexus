// Browsers word a missing page file differently. It happens after a new version is published:
// the open tab still asks for a file the new build no longer has.
const STALE_BUILD = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i;

export const isStaleBuildError = (error) => STALE_BUILD.test(String(error?.message || error || ""));
