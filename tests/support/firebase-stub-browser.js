(function installFirebaseTestDouble(){
  'use strict';

  const seed = window.__CONNECT_HUB_TEST_SEED__ || {};
  const documents = new Map();
  const listeners = new Set();
  const documentListeners = new Set();
  const writeLog = [];
  const readLog = [];
  const subscriptionLog = [];
  const listenerDeliveryLog = [];
  const operationControls = [];
  const authOperationControls = [];
  const transactionFailuresAfterCommit = [];
  let generatedId = 0;
  let generatedControlId = 0;
  let transactionQueue = Promise.resolve();

  function clone(value){
    if(value === null || value === undefined) return value;
    if(Array.isArray(value)) return value.map(clone);
    if(value instanceof Date) return new Date(value.getTime());
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
    if(value instanceof Date) return makeTimestamp(value.toISOString());
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

  function scheduleAuthOperationControl({
    operation,
    appName = '',
    failureMessage = 'Falha de autenticação simulada.',
    failureCode = 'fixture/auth-failed'
  }){
    const control = {
      id: `fixture-auth-control-${++generatedControlId}`,
      operation,
      appName,
      failureMessage,
      failureCode,
      state: 'scheduled'
    };
    authOperationControls.push(control);
    return control.id;
  }

  async function applyAuthOperationControl(operation, appName){
    const control = authOperationControls.find(candidate => (
      candidate.state === 'scheduled' &&
      candidate.operation === operation &&
      (!candidate.appName || candidate.appName === appName)
    ));
    if(!control) return;
    control.state = 'completed';
    const index = authOperationControls.indexOf(control);
    if(index >= 0) authOperationControls.splice(index, 1);
    const error = new Error(control.failureMessage);
    error.code = control.failureCode;
    throw error;
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
    for(const filter of query.filters){
      rows = rows.filter(row => {
        const hasField = Object.prototype.hasOwnProperty.call(row.data || {}, filter.field);
        const fieldValue = row.data?.[filter.field];
        if(filter.operator === '!=') return hasField && fieldValue !== filter.value;
        if(filter.operator === '==') return hasField && fieldValue === filter.value;
        throw new Error(`Unsupported fixture query operator: ${filter.operator}`);
      });
    }
    if(query.orderField) {
      rows = rows.filter(row => Object.prototype.hasOwnProperty.call(row.data || {}, query.orderField));
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
      metadata: { hasPendingWrites },
      forEach(callback){ docs.forEach(callback); }
    };
  }

  function initialListenerDelay(path){
    const configured = (seed.listenerDelays || []).find(delay => (
      !delay.pathIncludes || path.includes(delay.pathIncludes)
    ));
    return Math.max(0, Number(configured?.delayMs) || 0);
  }

  function scheduleListeners(changedPath, hasPendingWrites = false){
    for(const listener of listeners) {
      if(!changedPath.startsWith(listener.query.path + '/')) continue;
      const snapshot = querySnapshot(listener.query, hasPendingWrites);
      setTimeout(() => {
        listenerDeliveryLog.push({
          path: listener.query.path,
          query: true,
          initial: false,
          at: performance.now()
        });
        listener.success(snapshot);
      }, 0);
    }
    for(const listener of documentListeners) {
      if(changedPath !== listener.path) continue;
      const snapshot = docSnapshot(listener.path, documents.get(listener.path), hasPendingWrites);
      setTimeout(() => {
        listenerDeliveryLog.push({
          path: listener.path,
          query: false,
          initial: false,
          at: performance.now()
        });
        listener.success(snapshot);
      }, 0);
    }
  }

  class QueryReference {
    constructor(path, options = {}){
      this.path = path;
      this.orderField = options.orderField || '';
      this.orderDirection = options.orderDirection || 'asc';
      this.limitCount = options.limitCount;
      this.filters = Array.isArray(options.filters) ? options.filters : [];
    }
    orderBy(field, direction = 'asc'){
      return new QueryReference(this.path, { ...this, orderField: field, orderDirection: direction });
    }
    where(field, operator, value){
      return new QueryReference(this.path, {
        ...this,
        filters: [...this.filters, { field, operator, value }]
      });
    }
    limit(count){
      return new QueryReference(this.path, { ...this, limitCount: count });
    }
    async get(options = {}){
      const readEntry = {
        operation: 'get',
        path: this.path,
        query: true,
        transaction: false,
        filters: clone(this.filters),
        orderField: this.orderField,
        orderDirection: this.orderDirection,
        limitCount: this.limitCount,
        source: options.source || 'default',
        returnedPaths: [],
        at: performance.now()
      };
      readLog.push(readEntry);
      await applyOperationControl('get', this.path);
      const snapshot = querySnapshot(this);
      readEntry.returnedPaths = snapshot.docs.map(doc => doc.ref.path);
      return snapshot;
    }
    onSnapshot(success, error){
      const listener = { query: this, success, error };
      listeners.add(listener);
      subscriptionLog.push({
        operation: 'listen',
        path: this.path,
        query: true,
        filters: clone(this.filters),
        orderField: this.orderField,
        orderDirection: this.orderDirection,
        limitCount: this.limitCount,
        at: performance.now()
      });
      setTimeout(() => {
        listenerDeliveryLog.push({
          path: this.path,
          query: true,
          initial: true,
          at: performance.now()
        });
        try { success(querySnapshot(this)); }
        catch(cause) { if(error) error(cause); }
      }, initialListenerDelay(this.path));
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
    async get(options = {}){
      readLog.push({
        operation: 'get',
        path: this.path,
        query: false,
        transaction: false,
        source: options.source || 'default',
        at: performance.now()
      });
      await applyOperationControl('get', this.path);
      return docSnapshot(this.path, documents.get(this.path));
    }
    onSnapshot(success, error){
      const listener = { path: this.path, success, error };
      documentListeners.add(listener);
      subscriptionLog.push({
        operation: 'listen',
        path: this.path,
        query: false,
        at: performance.now()
      });
      setTimeout(() => {
        listenerDeliveryLog.push({
          path: this.path,
          query: false,
          initial: true,
          at: performance.now()
        });
        try { success(docSnapshot(this.path, documents.get(this.path))); }
        catch(cause) { if(error) error(cause); }
      }, initialListenerDelay(this.path));
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
    async update(data){
      if(!documents.has(this.path)){
        const error = new Error('Documento não encontrado para atualização.');
        error.code = 'not-found';
        throw error;
      }
      return this.set(data, { merge: true });
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
            readLog.push({
              operation: 'get',
              path: reference.path,
              query: false,
              transaction: true,
              at: performance.now()
            });
            return docSnapshot(reference.path, snapshotDocuments.get(reference.path));
          },
          set(reference, data, options = {}){
            operations.push({ operation: 'set', reference, data, options });
            return transaction;
          },
          update(reference, data){
            if(!snapshotDocuments.has(reference.path)){
              const error = new Error('Documento não encontrado para atualização.');
              error.code = 'not-found';
              throw error;
            }
            operations.push({
              operation: 'set',
              reference,
              data,
              options: { merge: true }
            });
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
        update(reference, data){
          if(!documents.has(reference.path)){
            const error = new Error('Documento não encontrado para atualização.');
            error.code = 'not-found';
            throw error;
          }
          operations.push({
            operation: 'set',
            reference,
            data,
            options: { merge: true }
          });
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

  const authInstances = new Map();
  const authLog = [];
  const authAccounts = [
    ...(Array.isArray(seed.authAccounts) ? seed.authAccounts : []),
    ...(Array.isArray(seed.adminAccounts) ? seed.adminAccounts : [])
  ];
  const initialAuthByApp = {
    ...(seed.initialAuthByApp && typeof seed.initialAuthByApp === 'object'
      ? seed.initialAuthByApp
      : {})
  };
  if(Object.prototype.hasOwnProperty.call(seed, 'initialAuthUser')) {
    initialAuthByApp['[DEFAULT]'] = seed.initialAuthUser;
  } else if(seed.authUid) {
    initialAuthByApp['[DEFAULT]'] = {
      uid: seed.authUid,
      email: '',
      isAnonymous: true
    };
  }

  function authAccountByEmail(email){
    return authAccounts.find(candidate => (
      String(candidate.email || '').toLowerCase() === String(email || '').toLowerCase()
    ));
  }

  function normalizedAuthEmail(email){
    return String(email || '').trim().toLowerCase();
  }

  function ensureAuthAccountState(account){
    if(!account) return account;
    if(!Number.isInteger(account.sessionVersion)) account.sessionVersion = 0;
    if(account.passwordMechanism === undefined) {
      account.passwordMechanism = typeof account.password === 'string' && account.password.length > 0;
    }
    return account;
  }

  function fixtureEmailFingerprint(email){
    let hash = 2166136261;
    for(const character of normalizedAuthEmail(email)){
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function parseFixtureEmailLink(href){
    try {
      const url = new URL(String(href || ''));
      const entries = [...url.searchParams.entries()];
      if(
        entries.length !== 3 ||
        entries[0][0] !== 'mode' ||
        entries[0][1] !== 'signIn' ||
        entries[1][0] !== 'oobCode' ||
        !entries[1][1] ||
        entries[2][0] !== 'apiKey' ||
        entries[2][1] !== 'fixture-api-key' ||
        url.searchParams.toString() !== url.search.slice(1)
      ) return null;
      return { url, oobCode: entries[1][1] };
    } catch {
      return null;
    }
  }

  function buildFixtureEmailLink(continueUrl, email){
    const url = new URL(String(continueUrl || ''));
    url.search = new URLSearchParams({
      mode: 'signIn',
      oobCode: `fixture_${fixtureEmailFingerprint(email)}_${++generatedId}`,
      apiKey: 'fixture-api-key'
    }).toString();
    return url.toString();
  }

  function hydrateAuthUser(rawUser, appName){
    if(!rawUser) return null;
    const account = ensureAuthAccountState(authAccountByEmail(rawUser.email));
    const user = {
      uid: rawUser.uid,
      email: rawUser.email || '',
      isAnonymous: rawUser.isAnonymous === true,
      __sessionVersion: account?.sessionVersion || 0,
      __signInProvider: rawUser.signInProvider || (rawUser.isAnonymous === true ? 'anonymous' : 'password'),
      providerData: Array.isArray(rawUser.providerData)
        ? clone(rawUser.providerData)
        : rawUser.isAnonymous === true
          ? []
          : [{ providerId: 'password', uid: rawUser.email || rawUser.uid }],
      emailVerified: rawUser.isAnonymous === true
        ? false
        : rawUser.emailVerified !== undefined
          ? Boolean(rawUser.emailVerified)
          : account?.emailVerified !== false,
      async updatePassword(password){
        await applyAuthOperationControl('updatePassword', appName);
        const latest = ensureAuthAccountState(authAccountByEmail(user.email));
        const instance = authInstances.get(appName);
        if(
          !latest ||
          !instance ||
          instance.currentUser !== user ||
          latest.uid !== user.uid ||
          latest.sessionVersion !== user.__sessionVersion ||
          user.emailVerified !== true
        ){
          const error = new Error('A prova recente da identidade não está disponível.');
          error.code = 'auth/requires-recent-login';
          throw error;
        }
        latest.password = String(password || '');
        latest.passwordMechanism = true;
        latest.emailVerified = true;
        latest.sessionVersion += 1;
        user.__sessionVersion = latest.sessionVersion;
        for(const [otherName, otherInstance] of authInstances){
          if(
            otherName !== appName &&
            otherInstance.currentUser?.uid === user.uid
          ){
            otherInstance.currentUser = null;
            notifyAuthObservers(otherInstance);
          }
        }
        authLog.push({
          operation: 'updatePassword',
          appName,
          uid: user.uid,
          sessionsRevoked: true
        });
      },
      async sendEmailVerification(actionCodeSettings){
        await applyAuthOperationControl('sendEmailVerification', appName);
        authLog.push({
          operation: 'sendEmailVerification',
          appName,
          uid: user.uid,
          continueUrl: String(actionCodeSettings?.url || '')
        });
      },
      async reload(){
        await applyAuthOperationControl('reload', appName);
        const latest = ensureAuthAccountState(authAccountByEmail(user.email));
        if(latest && latest.sessionVersion !== user.__sessionVersion){
          const error = new Error('A sessão foi revogada.');
          error.code = 'auth/user-token-expired';
          throw error;
        }
        if(latest) user.emailVerified = latest.emailVerified !== false;
        authLog.push({
          operation: 'reload',
          appName,
          uid: user.uid,
          emailVerified: user.emailVerified
        });
      },
      async getIdToken(forceRefresh = false){
        await applyAuthOperationControl('getIdToken', appName);
        const latest = ensureAuthAccountState(authAccountByEmail(user.email));
        if(latest && latest.sessionVersion !== user.__sessionVersion){
          const error = new Error('A sessão foi revogada.');
          error.code = 'auth/user-token-expired';
          throw error;
        }
        authLog.push({
          operation: 'getIdToken',
          appName,
          uid: user.uid,
          forceRefresh: Boolean(forceRefresh)
        });
        return `fixture-token-${user.uid}`;
      },
      async getIdTokenResult(forceRefresh = false){
        await applyAuthOperationControl('getIdTokenResult', appName);
        const latest = ensureAuthAccountState(authAccountByEmail(user.email));
        if(latest && latest.sessionVersion !== user.__sessionVersion){
          const error = new Error('A sessão foi revogada.');
          error.code = 'auth/user-token-expired';
          throw error;
        }
        authLog.push({
          operation: 'getIdTokenResult',
          appName,
          uid: user.uid,
          forceRefresh: Boolean(forceRefresh)
        });
        return {
          claims: {
            email: user.email,
            email_verified: user.emailVerified,
            firebase: {
              sign_in_provider: user.__signInProvider
            }
          }
        };
      }
    };
    return user;
  }

  function notifyAuthObservers(instance){
    for(const observer of instance.__observers){
      setTimeout(() => {
        try { observer.success(instance.currentUser); }
        catch(error) { if(observer.failure) observer.failure(error); }
      }, 0);
    }
  }

  function authForApp(appName = '[DEFAULT]'){
    if(authInstances.has(appName)) return authInstances.get(appName);
    const initialUser = initialAuthByApp[appName];
    const delayInitialState = Number(seed.authInitialStateDelayMs || 0) > 0;
    const instance = {
      __appName: appName,
      __observers: new Set(),
      __seedSignOutFailureUsed: false,
      __pendingInitialUser: delayInitialState && initialUser
        ?hydrateAuthUser(clone(initialUser), appName)
        :null,
      currentUser: initialUser && !delayInitialState
        ?hydrateAuthUser(clone(initialUser), appName)
        :null,
      async setPersistence(value){
        authLog.push({ operation: 'setPersistence', appName, value: String(value) });
        if(seed.authPersistenceFailure){
          const error = new Error('Falha controlada ao configurar persistência de autenticação.');
          error.code = 'auth/persistence-failed';
          throw error;
        }
      },
      onAuthStateChanged(success, failure){
        const observer = { success, failure };
        instance.__observers.add(observer);
        setTimeout(() => {
          try {
            if(instance.__pendingInitialUser){
              instance.currentUser = instance.__pendingInitialUser;
              instance.__pendingInitialUser = null;
            }
            success(instance.currentUser);
          }
          catch(error) { if(failure) failure(error); }
        }, Math.max(0, Number(seed.authInitialStateDelayMs || 0)));
        return () => instance.__observers.delete(observer);
      },
      async signInAnonymously(){
        await applyAuthOperationControl('signInAnonymously', appName);
        const user = { uid: seed.authUid || 'fixture-anonymous-user', isAnonymous: true };
        instance.currentUser = user;
        authLog.push({ operation: 'signInAnonymously', appName, uid: user.uid });
        notifyAuthObservers(instance);
        return { user };
      },
      async signInWithEmailAndPassword(email, password){
        await applyAuthOperationControl('signInWithEmailAndPassword', appName);
        const account = ensureAuthAccountState(authAccountByEmail(email));
        if(!account || account.passwordMechanism !== true){
          const error = new Error('Credencial institucional inválida.');
          error.code = 'auth/invalid-credential';
          throw error;
        }
        if(String(account.password || '') !== String(password || '')){
          const error = new Error('Credencial institucional inválida.');
          error.code = 'auth/invalid-credential';
          throw error;
        }
        if(account.disabled === true){
          const error = new Error('Conta institucional desativada.');
          error.code = 'auth/user-disabled';
          throw error;
        }
        const user = hydrateAuthUser({
          uid: account.uid,
          email: account.email,
          isAnonymous: false,
          emailVerified: account.emailVerified !== false,
          signInProvider: 'password'
        }, appName);
        instance.currentUser = user;
        authLog.push({ operation: 'signInWithEmailAndPassword', appName, uid: user.uid });
        notifyAuthObservers(instance);
        return { user };
      },
      async createUserWithEmailAndPassword(email, password){
        await applyAuthOperationControl('createUserWithEmailAndPassword', appName);
        if(authAccountByEmail(email)){
          const error = new Error('Conta já existente.');
          error.code = 'auth/email-already-in-use';
          throw error;
        }
        const account = {
          uid: seed.nextAuthUid || `fixture-created-user-${++generatedId}`,
          email: String(email || ''),
          password: String(password || ''),
          passwordMechanism: true,
          disabled: false,
          emailVerified: false,
          sessionVersion: 0
        };
        authAccounts.push(account);
        const user = hydrateAuthUser({
          uid: account.uid,
          email: account.email,
          isAnonymous: false,
          emailVerified: false
        }, appName);
        instance.currentUser = user;
        authLog.push({
          operation: 'createUserWithEmailAndPassword',
          appName,
          uid: user.uid
        });
        notifyAuthObservers(instance);
        return { user };
      },
      async sendSignInLinkToEmail(email, actionCodeSettings){
        await applyAuthOperationControl('sendSignInLinkToEmail', appName);
        const normalizedEmail = normalizedAuthEmail(email);
        const continueUrl = String(actionCodeSettings?.url || '');
        let actionLink = '';
        try {
          const parsedContinueUrl = new URL(continueUrl);
          if(
            actionCodeSettings?.handleCodeInApp !== true ||
            parsedContinueUrl.search ||
            !/^#invite=invite_[0-9a-f]{32}$/.test(parsedContinueUrl.hash)
          ) throw new Error('invalid-action-settings');
          actionLink = buildFixtureEmailLink(continueUrl, normalizedEmail);
        } catch {
          const error = new Error('Configuração inválida para o link por e-mail.');
          error.code = 'auth/invalid-continue-uri';
          throw error;
        }
        authLog.push({
          operation: 'sendSignInLinkToEmail',
          appName,
          email: normalizedEmail,
          continueUrl,
          handleCodeInApp: true,
          actionLink
        });
      },
      isSignInWithEmailLink(href){
        const parsed = parseFixtureEmailLink(href);
        authLog.push({
          operation: 'isSignInWithEmailLink',
          appName,
          result: Boolean(parsed)
        });
        return Boolean(parsed);
      },
      async signInWithEmailLink(email, href){
        await applyAuthOperationControl('signInWithEmailLink', appName);
        const normalizedEmail = normalizedAuthEmail(email);
        const parsed = parseFixtureEmailLink(href);
        const expectedCodePrefix = `fixture_${fixtureEmailFingerprint(normalizedEmail)}_`;
        const usedKey = parsed
          ?`firebase-stub-used-email-link:${parsed.oobCode}`
          :'';
        if(
          !parsed ||
          !parsed.oobCode.startsWith(expectedCodePrefix) ||
          !/^fixture_[0-9a-f]{8}_[1-9][0-9]*$/.test(parsed.oobCode) ||
          parsed.oobCode.startsWith('expired_') ||
          sessionStorage.getItem(usedKey) === 'true'
        ){
          const error = new Error('Link por e-mail inválido ou expirado.');
          error.code = 'auth/invalid-action-code';
          throw error;
        }

        let account = ensureAuthAccountState(authAccountByEmail(normalizedEmail));
        const isNewUser = !account;
        if(!account){
          account = {
            uid: seed.nextAuthUid || `fixture-created-user-${++generatedId}`,
            email: normalizedEmail,
            password: '',
            passwordMechanism: false,
            disabled: false,
            emailVerified: true,
            sessionVersion: 0
          };
          authAccounts.push(account);
        }else if(account.disabled === true){
          const error = new Error('Conta institucional desativada.');
          error.code = 'auth/user-disabled';
          throw error;
        }else if(account.emailVerified !== true){
          account.password = '';
          account.passwordMechanism = false;
          account.emailVerified = true;
          account.sessionVersion += 1;
          for(const otherInstance of authInstances.values()){
            if(otherInstance.currentUser?.uid === account.uid){
              otherInstance.currentUser = null;
              notifyAuthObservers(otherInstance);
            }
          }
          authLog.push({
            operation: 'invalidateUnverifiedCredential',
            appName,
            uid: account.uid,
            sessionsRevoked: true
          });
        }

        sessionStorage.setItem(usedKey, 'true');
        const user = hydrateAuthUser({
          uid: account.uid,
          email: account.email,
          isAnonymous: false,
          emailVerified: true,
          signInProvider: 'password'
        }, appName);
        instance.currentUser = user;
        authLog.push({
          operation: 'signInWithEmailLink',
          appName,
          uid: user.uid,
          isNewUser
        });
        notifyAuthObservers(instance);
        return {
          user,
          additionalUserInfo: { isNewUser }
        };
      },
      async sendPasswordResetEmail(email){
        await applyAuthOperationControl('sendPasswordResetEmail', appName);
        authLog.push({
          operation: 'sendPasswordResetEmail',
          appName,
          email: String(email || '').toLowerCase()
        });
      },
      async signOut(){
        await applyAuthOperationControl('signOut', appName);
        if(seed.authSignOutFailure && !instance.__seedSignOutFailureUsed){
          instance.__seedSignOutFailureUsed = true;
          const error = new Error('Falha controlada ao encerrar a sessão.');
          error.code = 'fixture/sign-out-failed';
          throw error;
        }
        const uid = instance.currentUser?.uid || null;
        instance.currentUser = null;
        authLog.push({ operation: 'signOut', appName, uid });
        notifyAuthObservers(instance);
      },
      async updateCurrentUser(user){
        const uid = instance.currentUser?.uid || null;
        instance.currentUser = user ? hydrateAuthUser(clone(user), appName) : null;
        authLog.push({
          operation: 'updateCurrentUser',
          appName,
          uid,
          nextUid: instance.currentUser?.uid || null
        });
        notifyAuthObservers(instance);
      }
    };
    authInstances.set(appName, instance);
    return instance;
  }

  const firebase = {
    apps: [],
    initializeApp(config, requestedName){
      const name = requestedName || '[DEFAULT]';
      const existing = firebase.apps.find(candidate => candidate.name === name);
      if(existing) return existing;
      const app = {
        name,
        options: clone(config),
        auth(){ return authForApp(name); },
        firestore(){ return database; }
      };
      firebase.apps.push(app);
      return app;
    },
    auth(){ return authForApp('[DEFAULT]'); },
    firestore(){ return database; }
  };
  firebase.auth.Auth = {
    Persistence: {
      ...(seed.authPersistenceUnavailable ? {} : { SESSION: 'session' })
    }
  };
  firebase.firestore.FieldValue = {
    serverTimestamp(){ return { __serverTimestamp: true }; }
  };
  firebase.firestore.Timestamp = {
    fromMillis(value){ return makeTimestamp(new Date(Number(value)).toISOString()); },
    now(){ return makeTimestamp(); }
  };
  for(const appName of Object.keys(initialAuthByApp)) authForApp(appName);

  function seedCollection(path, values){
    for(const value of values || []) documents.set(`${path}/${value.id}`, materialize(clone(value)));
  }

  function seedStrictCollection(path, values){
    for(const value of values || []){
      const { id, ...documentData } = value;
      documents.set(`${path}/${id}`, materialize(clone(documentData)));
    }
  }

  const unit = seed.unit || 'emergencia';
  const root = `connect_hub_v55/${unit}`;
  seedCollection(`${root}/pacientes`, seed.patients);
  for(const [sectorUnit, patients] of Object.entries(seed.patientsByUnit || {})){
    seedCollection(`connect_hub_v55/${sectorUnit}/pacientes`, patients);
  }
  if(seed.meta) documents.set(`${root}/meta/atual`, materialize(clone(seed.meta)));
  seedCollection(`${root}/confirmacoes`, seed.confirmations);
  seedCollection(`${root}/closed_patients`, seed.closedPatients);
  seedCollection('historico_eventos', seed.historyEvents);
  seedCollection('admin_outcomes', seed.adminOutcomes);
  seedStrictCollection('admin_users', seed.adminUsers);
  seedStrictCollection('clinical_invites', seed.clinicalInvites);
  seedStrictCollection('access_audit', seed.accessAudit);
  for(const profile of seed.clinicalUsers || []){
    const { id, ...profileData } = profile;
    documents.set(`clinical_users/${id}`, materialize(clone(profileData)));
  }
  for(const delay of seed.readDelays || []){
    scheduleOperationControl({
      operation: 'get',
      pathIncludes: delay.pathIncludes || '',
      delayMs: delay.delayMs || 0
    });
  }
  for(const failure of seed.readFailures || []){
    scheduleOperationControl({
      operation: 'get',
      pathIncludes: failure.pathIncludes || '',
      failureMessage: failure.message || 'Falha de leitura simulada.',
      failureCode: failure.code || 'fixture/read-failed'
    });
  }

  window.firebase = firebase;
  window.__firebaseTestHarness = {
    snapshot(){
      return Object.fromEntries([...documents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, data]) => [path, serialize(data)]));
    },
    writes(){ return clone(writeLog); },
    reads(){ return clone(readLog); },
    subscriptions(){ return clone(subscriptionLog); },
    firestoreAccesses(){
      return clone([...readLog, ...subscriptionLog].sort((left, right) => left.at - right.at));
    },
    activeListeners(){
      return [
        ...[...listeners].map(listener => ({
          path: listener.query.path,
          query: true
        })),
        ...[...documentListeners].map(listener => ({
          path: listener.path,
          query: false
        }))
      ];
    },
    authLog(){ return clone(authLog); },
    listenerDeliveries(){ return clone(listenerDeliveryLog); },
    authState(){
      return Object.fromEntries([...authInstances.entries()].map(([name, instance]) => [
        name,
        instance.currentUser
          ? { uid: instance.currentUser.uid, email: instance.currentUser.email || '', isAnonymous: Boolean(instance.currentUser.isAnonymous) }
          : null
      ]));
    },
    clearWrites(){ writeLog.length = 0; },
    clearReads(){ readLog.length = 0; },
    clearFirestoreAccesses(){
      readLog.length = 0;
      subscriptionLog.length = 0;
    },
    document(path){ return serialize(documents.get(path)); },
    replaceDocumentSilently(path, data){
      documents.set(path, materialize(clone(data)));
    },
    replaceDocument(path, data){
      documents.set(path, materialize(clone(data)));
      scheduleListeners(path);
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
    failNextAuth(operation, appName = '', code = 'fixture/auth-failed', message = 'Falha de autenticação simulada.'){
      return scheduleAuthOperationControl({
        operation,
        appName,
        failureCode: code,
        failureMessage: message
      });
    },
    verifyAuthEmail(email){
      const account = authAccountByEmail(email);
      if(account) account.emailVerified = true;
      for(const instance of authInstances.values()){
        if(
          instance.currentUser &&
          String(instance.currentUser.email || '').toLowerCase() === String(email || '').toLowerCase()
        ){
          instance.currentUser.emailVerified = true;
        }
      }
      return Boolean(account);
    },
    failActiveListener(pathIncludes, code = 'permission-denied', message = 'Leitura negada pela regra simulada.'){
      const error = new Error(message);
      error.code = code;
      const matching = [
        ...[...listeners].filter(listener => listener.query.path.includes(pathIncludes)),
        ...[...documentListeners].filter(listener => listener.path.includes(pathIncludes))
      ];
      matching.forEach(listener => {
        if(typeof listener.error === 'function') setTimeout(() => listener.error(error), 0);
      });
      return matching.length;
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
