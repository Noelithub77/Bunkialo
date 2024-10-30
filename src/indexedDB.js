const DB_NAME = 'BunkialoDB';
const DB_VERSION = 1;
const STORE_NAME = 'dataStore';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = event => {
      resolve(event.target.result);
    };

    request.onerror = event => {
      reject(event.target.error);
    };
  });
}

function saveData(data) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(data);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = event => {
        reject(event.target.error);
      };
    });
  });
}

function getData(id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = event => {
        reject(event.target.error);
      };
    });
  });
}

export { saveData, getData };
