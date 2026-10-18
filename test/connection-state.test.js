'use strict';

const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const Module = require('module');

// homey finnes bare på en Homey. Appklassen trenger bare en baseklasse å
// arve fra for det som testes her.
const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === 'homey') return { App: class {} };
  return originalLoad.call(this, request, ...rest);
};
const NestProtectApp = require('../app');
Module._load = originalLoad;

const { NestAuthError } = require('../lib/nest-auth');

const MINUTE = 60 * 1000;

// En app med falsk klokke. Timerne går bare når testen skrur klokka fram, så
// fem minutters venting tar ingen tid.
function makeApp() {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  const homey = {
    setTimeout(fn, ms) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const advance = (ms) => {
    now += ms;
    for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
    }
  };

  const app = new NestProtectApp();
  app.homey = homey;
  app.protect = new EventEmitter();
  app.log = () => {};
  app.error = () => {};
  app._connectionTrigger = { trigger: async () => {} };
  app.announced = [];
  app.protect.on('connection', (online) => app.announced.push(online));
  return { app, advance };
}

const networkError = () => new Error('fetch failed');
const signedOut = () => new NestAuthError('USER_LOGGED_OUT', { retryable: false, code: 'USER_LOGGED_OUT' });

test('et nettverksbrudd på fire minutter merker ikke enhetene', () => {
  const { app, advance } = makeApp();
  app.setConnected(true);
  app.setConnected(false, networkError());
  advance(4 * MINUTE);
  app.setConnected(true);
  advance(10 * MINUTE);

  assert.deepEqual(app.announced, [true]);
  assert.equal(app.devicesOnline(), true);
});

test('et brudd som varer over fem minutter merker enhetene', () => {
  const { app, advance } = makeApp();
  app.setConnected(true);
  app.setConnected(false, networkError());
  advance(6 * MINUTE);

  assert.deepEqual(app.announced, [true, false]);
  assert.equal(app.devicesOnline(), false);
});

test('statusen er frakoblet med en gang, selv om enhetene venter', () => {
  const { app } = makeApp();
  app.setConnected(true);
  app.setConnected(false, networkError());

  assert.equal(app.isConnected(), false);
  assert.equal(app.devicesOnline(), true);
});

test('en innloggingsfeil merker enhetene med en gang', () => {
  const { app } = makeApp();
  app.setConnected(true);
  app.setConnected(false, signedOut());

  assert.deepEqual(app.announced, [true, false]);
});

test('manglende verdier merker enhetene med en gang', () => {
  const { app } = makeApp();
  const missing = new Error('The cookie is missing');
  missing.needsUser = true;
  app.setConnected(false, missing);

  assert.deepEqual(app.announced, [false]);
});

test('et nettverksbrudd som går over i utlogging, vises med en gang', () => {
  const { app } = makeApp();
  app.setConnected(true);
  app.setConnected(false, networkError());
  app.setConnected(false, signedOut());

  assert.deepEqual(app.announced, [true, false]);
});

test('to raske lagringer gir én omstart', () => {
  const { app, advance } = makeApp();
  let restarts = 0;
  app.restart = () => { restarts += 1; };

  app.scheduleRestart();
  advance(200);
  app.scheduleRestart();
  advance(1000);
  assert.equal(restarts, 0, 'venter på at den andre verdien lander');
  advance(1000);
  assert.equal(restarts, 1);
});

test('en vekking mens løkka er opptatt går ikke tapt', async () => {
  const { app } = makeApp();
  app.wake();

  // Ville ellers sovet en halvtime.
  const result = await Promise.race([
    app._sleep(30 * MINUTE).then(() => 'woke'),
    new Promise((resolve) => setImmediate(() => resolve('still asleep'))),
  ]);
  assert.equal(result, 'woke');
});

test('en husket vekking gjelder bare én søvn', async () => {
  const { app } = makeApp();
  app.wake();
  await app._sleep(30 * MINUTE);

  const result = await Promise.race([
    app._sleep(30 * MINUTE).then(() => 'woke'),
    new Promise((resolve) => setImmediate(() => resolve('still asleep'))),
  ]);
  assert.equal(result, 'still asleep');
});
