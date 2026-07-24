(function installFirebaseTestDouble(){
  'use strict';

  const seed = window.__CONNECT_HUB_TEST_SEED__ || {};
  const documents = new Map();
  const listeners = new Set();
  const documentListeners = new Set();
  const writeLog = [];
  const operationControls = [];
  const transactionFailuresAfterCommit = [];
  let generatedId = 0;
  let generatedControlId = 0;
  let transactionQueue = Promise.resolve();

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

  async function applyOperationControl(operation, path){
    const control = operationControls.find(candidate => (
      candidate.state === 'scheduled' &&
      candidate.operation === operation &&
      (!candidate.pathIncludes || path.includes(candidate.pathIncludes))
    ));
    if(!control) return;
    control.state = 'pending';
    try {
      if(control.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, control.delayMs));
      }
      if(control.failureMessage) {
        const error = new Error(control.failureMessage);
        error.code = control.failureCode || 'fixture/write-failed';
        throw error;
      }
    } finally {
      control.state = 'completed';
      const index = operationControls.indexOf(control);
      if(index >= 0) operationControls.splice(index, 1);
    }
  }

  function scheduleOperationControl({
    operation,
    pathIncludes = '',
    delayMs = 0,
    failureMessage = '',
    failureCode = ''
  }){
    const control = {
      id: `fixture-control-${++generatedControlId}`,
      operation,
      pathIncludes,
      delayMs,
      failureMessage,
      failureCode,
      state: 'scheduled'
    };
    operationControls.push(control);
    return control.id;
  }

  function directChildren(collectionPath){
    const prefix = collectionPath + '/';
    return [...documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => ({ id: path.slice(prefix.length), path, data }));
  }

  function docSnapshot(path, data, hasPendingWrites = false){
    const id = path.split('/').pop();
    return {
      id,
      ref: new DocumentReference(path),
      exists: data !== undefined,
      metadata: { hasPendingWrites },
      data(){ return data === undefined ? undefined : clone(data); }
    };
  }

  function querySnapshot(query, hasPendingWrites = false){
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
    const docs = rows.map(row => docSnapshot(row.path, row.data, hasPendingWrites));
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      metadata: { hasPendingWrites }
    };
  }

  function scheduleListeners(changedPath, hasPendingWrites = false){
    for(const listener of listeners) {
      if(!changedPath.startsWith(listener.query.path + '/')) continue;
      const snapshot = querySnapshot(listener.query, hasPendingWrites);
      setTimeout(() => listener.success(snapshot), 0);
    }
    for(const listener of documentListeners) {
      if(changedPath !== listener.path) continue;
      const snapshot = docSnapshot(listener.path, documents.get(listener.path), hasPendingWrites);
      setTimeout(() => listener.success(snapshot), 0);
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
      await applyOperationControl('set', this.path);
      const before = documents.get(this.path) || {};
      const next = materialize(options.merge ? { ...clone(before), ...clone(data) } : clone(data));
      documents.set(this.path, next);
      writeLog.push({ operation: 'set', path: this.path, merge: Boolean(options.merge), data: serialize(next), at: performance.now() });
      scheduleListeners(this.path);
    }
    async delete(){
      await applyOperationControl('delete', this.path);
      documents.delete(this.path);
      writeLog.push({ operation: 'delete', path: this.path, at: performance.now() });
      scheduleListeners(this.path);
    }
  }

  async function commitTransactionOperations(operations){
    if(!operations.length) return;
    const previousDocuments = new Map(documents);
    const stagedDocuments = new Map(documents);
    const stagedWrites = [];
    const changedPaths = [...new Set(operations.map(item => item.reference.path))];

    for(const item of operations) {
      if(item.operation === 'set') {
        const before = stagedDocuments.get(item.reference.path) || {};
        const next = materialize(item.options.merge
          ? { ...clone(before), ...clone(item.data) }
          : clone(item.data));
        stagedDocuments.set(item.reference.path, next);
        stagedWrites.push({
          operation: 'set',
          path: item.reference.path,
          merge: Boolean(item.options.merge),
          data: serialize(next),
          at: performance.now()
        });
      } else {
        stagedDocuments.delete(item.reference.path);
        stagedWrites.push({
          operation: 'delete',
          path: item.reference.path,
          at: performance.now()
        });
      }
    }

    documents.clear();
    for(const [path, data] of stagedDocuments) documents.set(path, data);
    changedPaths.forEach(path => scheduleListeners(path, true));

    try {
      for(const item of operations) {
        await applyOperationControl(item.operation, item.reference.path);
      }
    } catch(error) {
      documents.clear();
      for(const [path, data] of previousDocuments) documents.set(path, data);
      changedPaths.forEach(path => scheduleListeners(path, false));
      throw error;
    }

    writeLog.push(...stagedWrites);
    changedPaths.forEach(path => scheduleListeners(path, false));
    if(transactionFailuresAfterCommit.length) {
      const failure = transactionFailuresAfterCommit.shift();
      const error = new Error(failure.message);
      error.code = failure.code;
      throw error;
    }
  }

  const database = {
    collection(name){ return new CollectionReference(name); },
    runTransaction(updateFunction){
      const execute = async () => {
        const snapshotDocuments = new Map(documents);
        const operations = [];
        const transaction = {
          async get(reference){
            return docSnapshot(reference.path, snapshotDocuments.get(reference.path));
          },
          set(reference, data, options = {}){
            operations.push({ operation: 'set', reference, data, options });
            return transaction;
          },
          delete(reference){
            operations.push({ operation: 'delete', reference });
            return transaction;
          }
        };
        const result = await updateFunction(transaction);
        await commitTransactionOperations(operations);
        return result;
      };
      const operation = transactionQueue.then(execute, execute);
      transactionQueue = operation.catch(() => undefined);
      return operation;
    },
    batch(){
      const operations = [];
      return {
        set(reference, data, options = {}){
          operations.push({ operation: 'set', reference, data, options });
          return this;
        },
        delete(reference){
          operations.push({ operation: 'delete', reference });
          return this;
        },
        async commit(){
          const stagedDocuments = new Map(documents);
          const stagedWrites = [];
          const changedPaths = [];

          for(const item of operations) {
            await applyOperationControl(item.operation, item.reference.path);
            if(item.operation === 'set') {
              const before = stagedDocuments.get(item.reference.path) || {};
              const next = materialize(item.options.merge
                ? { ...clone(before), ...clone(item.data) }
                : clone(item.data));
              stagedDocuments.set(item.reference.path, next);
              stagedWrites.push({
                operation: 'set',
                path: item.reference.path,
                merge: Boolean(item.options.merge),
                data: serialize(next),
                at: performance.now()
              });
            } else {
              stagedDocuments.delete(item.reference.path);
              stagedWrites.push({
                operation: 'delete',
                path: item.reference.path,
                at: performance.now()
              });
            }
            changedPaths.push(item.reference.path);
          }

          documents.clear();
          for(const [path, data] of stagedDocuments) documents.set(path, data);
          writeLog.push(...stagedWrites);
          for(const path of changedPaths) scheduleListeners(path);
        }
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
  seedCollection('historico_eventos', seed.historyEvents);

  window.firebase = firebase;
  window.__firebaseTestHarness = {
    snapshot(){
      return Object.fromEntries([...documents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, data]) => [path, serialize(data)]));
    },
    writes(){ return clone(writeLog); },
    clearWrites(){ writeLog.length = 0; },
    document(path){ return serialize(documents.get(path)); },
    replaceDocumentSilently(path, data){
      documents.set(path, materialize(clone(data)));
    },
    delayNext(operation, pathIncludes, delayMs = 250){
      return scheduleOperationControl({ operation, pathIncludes, delayMs });
    },
    failNext(operation, pathIncludes, message = 'Falha de escrita simulada.'){
      return scheduleOperationControl({
        operation,
        pathIncludes,
        failureMessage: message,
        failureCode: 'fixture/write-failed'
      });
    },
    failAfterNextTransactionCommit(message = 'Resposta da transação perdida após o commit.'){
      transactionFailuresAfterCommit.push({
        message,
        code: 'fixture/ack-lost'
      });
    },
    pendingControls(){
      return operationControls.map(control => ({
        id: control.id,
        operation: control.operation,
        pathIncludes: control.pathIncludes,
        state: control.state
      }));
    }
  };
})();
