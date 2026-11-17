// Where the phone is, when the browser will say. Best effort and never in the way: it resolves null when the browser
// has no geolocation, the person said no, or it takes longer than `timeoutMs` - a salesman at a shop door must never
// wait on a GPS fix to record a visit. The server keeps a location only when it is a real one.
export function currentLocation({ timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : null;
    if (!geo?.getCurrentPosition) return resolve(null);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      geo.getCurrentPosition(
        (p) => { clearTimeout(timer); finish({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
        () => { clearTimeout(timer); finish(null); },
        { enableHighAccuracy: false, maximumAge: 120000, timeout: timeoutMs }
      );
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}
