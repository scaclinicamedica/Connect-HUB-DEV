(function installFirebaseTestDouble(){
  'use strict';

  const seed = window.__CONNECT_HUB_TEST_SEED__ || {};
  const documents = new Map();
  const listeners = new Set();
  const documentListeners = new Set();
  const writeLog = [];
  let generatedId = 0;

  function clone(value){
    if(value === null || value === undefined) return value;
    if(Array.isArray(value)) return value.map(clone);
    if(value && value.__testTimestamp === true) return makeTimestamp(value.iso);
    if(typeof value === 'object') {
      const output = {};
      for(const [key, item] of Object.entries(value)) output[key] = clone(item);
      return output;
    }
    return value;
  }

  function makeTimestamp(iso = new Date().toISOString()){
    return {
      __testTimestamp: true,
      iso,
      toDate(){ return new Date(iso); }
    };
  }

  function materialize(value){
    if(value && value.__serverTimestamp === true) return makeTimestamp();
    if(Array.isArray(value)) return value.map(materialize);
    if(value && typeof value === 'object') {
      const output = {};
      for(const [key, item] of Object.entries(value)) output[key] = materialize(item);
      return output;
    }
    return value;
  }

  function serialize(value){
    if(value === null || value === undefined) return value;
    if(Array.isArray(value)) return value.map(serialize);
    if(value && value.__testTimestamp === true) return { $timestamp: value.iso };
    if(typeof value === 'object') {
      const output = {};
      for(const key of Object.keys(value).sort()) output[key] = serialize(value[key]);
      return output;
    }
    return value;
  }

  function directChildren(collectionPath){
    const prefix = collectionPath + '/';
    return [...documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => ({ id: path.slice(prefix.length), path, data }));
  }

  function docSnapshot(path, data){
    const id = path.split('/').pop();
    return {
      id,
      ref: new DocumentReference(path),
      exists: data !== undefined,
      data(){ return data === undefined ? undefined : clone(data); }
    };
  }

  function querySnapshot(query){
    let rows = directChildren(query.path);
    if(query.orderField) {
      rows.sort((left, right) => {
        const a = left.data?.[query.orderField];
        const b = right.data?.[query.orderField];
        const av = a?.iso || a || '';
        const bv = b?.iso || b || '';
        const direction = query.orderDirection === 'asc' ? 1 : -1;
        return String(av).localeCompare(String(bv)) * direction;
      });
    }
    if(Number.isFinite(query.limitCount)) rows = rows.slice(0, query.limitCount);
    const docs = rows.map(row => docSnapshot(row.path, row.data));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  function scheduleListeners(changedPath){
    for(const listener of listeners) {
      if(!changedPath.startsWith(listener.query.path + '/')) continue;
      setTimeout(() => listener.success(querySnapshot(listener.query)), 0);
    }
    for(const listener of documentListeners) {
      if(changedPath !== listener.path) continue;
      setTimeout(() => listener.success(docSnapshot(listener.path, documents.get(listener.path))), 0);
    }
  }

  class QueryReference {
    constructor(path, options = {}){
      this.path = path;
      this.orderField = options.orderField || '';
      this.orderDirection = options.orderDirection || 'asc';
      this.limitCount = options.limitCount;
    }
    orderBy(field, direction = 'asc'){
      return new QueryReference(this.path, { ...this, orderField: field, orderDirection: direction });
    }
    limit(count){
      return new QueryReference(this.path, { ...this, limitCount: count });
    }
    async get(){ return querySnapshot(this); }
    onSnapshot(success, error){
      const listener = { query: this, success, error };
      listeners.add(listener);
      setTimeout(() => {
        try { success(querySnapshot(this)); }
        catch(cause) { if(error) error(cause); }
      }, 0);
      return () => listeners.delete(listener);
    }
  }

  class CollectionReference extends QueryReference {
    doc(id = `fixture-generated-${++generatedId}`){ return new DocumentReference(`${this.path}/${id}`); }
    async add(data){
      const reference = this.doc();
      await reference.set(data, { merge: false });
      return reference;
    }
  }

  class DocumentReference {
    constructor(path){ this.path = path; this.id = path.split('/').pop(); }
    collection(name){ return new CollectionReference(`${this.path}/${name}`); }
    async get(){ return docSnapshot(this.path, documents.get(this.path)); }
    onSnapshot(success, error){
      const listener = { path: this.path, success, error };
      documentListeners.add(listener);
      setTimeout(() => {
        try { success(docSnapshot(this.path, documents.get(this.path))); }
        catch(cause) { if(error) error(cause); }
      }, 0);
      return () => documentListeners.delete(listener);
    }
    async set(data, options = {}){
      const before = documents.get(this.path) || {};
      const next = materialize(options.merge ? { ...clone(before), ...clone(data) } : clone(data));
      documents.set(this.path, next);
      writeLog.push({ operation: 'set', path: this.path, merge: Boolean(options.merge), data: serialize(next), at: performance.now() });
      scheduleListeners(this.path);
    }
    async delete(){
      documents.delete(this.path);
      writeLog.push({ operation: 'delete', path: this.path, at: performance.now() });
      scheduleListeners(this.path);
    }
  }

  const database = {
    collection(name){ return new CollectionReference(name); },
    batch(){
      const operations = [];
      return {
        set(reference, data, options){ operations.push(() => reference.set(data, options)); return this; },
        delete(reference){ operations.push(() => reference.delete()); return this; },
        async commit(){ for(const operation of operations) await operation(); }
      };
    }
  };

  const firebase = {
    apps: [],
    initializeApp(config){
      const app = { options: clone(config) };
      firebase.apps.push(app);
      return app;
    },
    auth(){
      return { async signInAnonymously(){ return { user: { uid: 'fixture-anonymous-user' } }; } };
    },
    firestore(){ return database; }
  };
  firebase.firestore.FieldValue = {
    serverTimestamp(){ return { __serverTimestamp: true }; }
  };

  function seedCollection(path, values){
    for(const value of values || []) documents.set(`${path}/${value.id}`, materialize(clone(value)));
  }

  const unit = seed.unit || 'emergencia';
  const root = `connect_hub_v55/${unit}`;
  seedCollection(`${root}/pacientes`, seed.patients);
  if(seed.meta) documents.set(`${root}/meta/atual`, materialize(clone(seed.meta)));
  seedCollection(`${root}/confirmacoes`, seed.confirmations);

  window.firebase = firebase;
  window.__firebaseTestHarness = {
    snapshot(){
      return Object.fromEntries([...documents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, data]) => [path, serialize(data)]));
    },
    writes(){ return clone(writeLog); },
    clearWrites(){ writeLog.length = 0; },
    document(path){ return serialize(documents.get(path)); }
  };
})();
