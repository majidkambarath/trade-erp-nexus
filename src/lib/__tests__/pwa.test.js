import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerServiceWorker } from "../pwa";

// A new worker never swaps itself out from under someone mid-voucher: the page decides, after
// being told. What used to go wrong (F13): the "controllerchange" handler reloaded on ANY
// change, including the one that fires on a first-ever visit the instant the new worker calls
// `clients.claim()` (nothing was showing before - there is nothing to refresh), and including
// the one that fires in every OTHER open tab the moment someone in ONE tab accepts an update
// (that tab asked; the rest did not, and reloading them throws away what they were doing).
// Only the tab that itself pressed "Update" may reload.

function fakeEmitter() {
  const listeners = {};
  return {
    addEventListener: (type, fn) => {
      (listeners[type] ||= []).push(fn);
    },
    removeEventListener: () => {},
    emit: (type) => listeners[type]?.slice().forEach((fn) => fn()),
  };
}

function fakeRegistration() {
  const emitter = fakeEmitter();
  return {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: emitter.addEventListener,
    emit: emitter.emit,
  };
}

function fakeWorker() {
  return { postMessage: vi.fn(), addEventListener: vi.fn(), state: "installed" };
}

let originalPROD;
let reloadSpy;
let container;
let registration;
let originalLocation;

beforeEach(() => {
  originalPROD = import.meta.env.PROD;
  import.meta.env.PROD = true;
  // jsdom's own location.reload is non-configurable, so the whole object is swapped for one
  // whose methods can be spied on (the same approach as src/axios/__tests__/refreshFailure.test.js).
  originalLocation = window.location;
  reloadSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, reload: reloadSpy },
    writable: true,
    configurable: true,
  });
  vi.useRealTimers();
});

afterEach(() => {
  import.meta.env.PROD = originalPROD;
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  delete navigator.serviceWorker;
});

// Sets up navigator.serviceWorker, registers, and fires the window "load" event registerServiceWorker
// waits for (jsdom's own load already happened before the test attached a listener for it).
async function bootWith({ controllerAtStart }) {
  const emitter = fakeEmitter();
  registration = fakeRegistration();
  container = {
    controller: controllerAtStart ? {} : null,
    register: vi.fn().mockResolvedValue(registration),
    addEventListener: emitter.addEventListener,
    removeEventListener: emitter.removeEventListener,
    emit: emitter.emit,
  };
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });

  const onUpdate = vi.fn();
  registerServiceWorker({ onUpdate });
  window.dispatchEvent(new Event("load"));
  // Flush the microtasks of the async "load" handler (the register() await and everything after it).
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  return { onUpdate };
}

describe("a first install claiming the tab", () => {
  it("never reloads the page: nothing was showing before, so there is nothing to refresh", async () => {
    await bootWith({ controllerAtStart: false });

    // clients.claim() in the worker's own activate handler hands this tab a controller with no
    // page action at all - the exact sequence a brand new visit goes through.
    container.controller = {};
    container.emit("controllerchange");

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe("an update offered to an already-controlled tab", () => {
  it("reloads only once THIS tab's own onUpdate callback was used", async () => {
    const { onUpdate } = await bootWith({ controllerAtStart: true });
    const worker = fakeWorker();
    let stateHandler;
    worker.addEventListener = (type, fn) => {
      if (type === "statechange") stateHandler = fn;
    };
    registration.installing = worker;
    registration.emit("updatefound");
    worker.state = "installed";
    stateHandler?.();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const apply = onUpdate.mock.calls[0][0];
    apply(); // the person presses "Update" in this tab's banner
    expect(worker.postMessage).toHaveBeenCalledWith("skip-waiting");

    container.controller = worker;
    container.emit("controllerchange");

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT reload a tab that never pressed its own banner, even once the controller switches", async () => {
    const { onUpdate } = await bootWith({ controllerAtStart: true });
    const worker = fakeWorker();
    let stateHandler;
    worker.addEventListener = (type, fn) => {
      if (type === "statechange") stateHandler = fn;
    };
    registration.installing = worker;
    registration.emit("updatefound");
    worker.state = "installed";
    stateHandler?.();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    // This tab is offered the banner but never acts on it - some OTHER tab accepts the update instead,
    // which still switches the controller under every tab sharing the registration.
    container.controller = worker;
    container.emit("controllerchange");

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("acts on a second controllerchange no more than the first", async () => {
    const { onUpdate } = await bootWith({ controllerAtStart: true });
    const worker = fakeWorker();
    let stateHandler;
    worker.addEventListener = (type, fn) => {
      if (type === "statechange") stateHandler = fn;
    };
    registration.installing = worker;
    registration.emit("updatefound");
    worker.state = "installed";
    stateHandler?.();
    const apply = onUpdate.mock.calls[0][0];
    apply();

    container.controller = worker;
    container.emit("controllerchange");
    container.emit("controllerchange");

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
