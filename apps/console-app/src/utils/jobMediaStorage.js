const DB_NAME = 'hirekal_media';
const STORE = 'blobs';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      event.target.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function sourceToBlob(source) {
  if (source instanceof Blob) return source;
  const response = await fetch(source);
  return response.blob();
}

function introStorageKey(jobId) {
  return `${jobId}-intro`;
}

export function isLocalMediaUrl(url) {
  return typeof url === 'string' && (url.startsWith('data:') || url.startsWith('blob:'));
}

export async function saveIntroMedia(jobId, introMedia) {
  if (!introMedia?.url || !jobId) return introMedia;

  if (!isLocalMediaUrl(introMedia.url)) {
    return {
      type: introMedia.type,
      url: introMedia.url,
      fileName: introMedia.fileName,
    };
  }

  const key = introStorageKey(jobId);
  const blob = await sourceToBlob(introMedia.url);
  const db = await openDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(
      { blob, type: introMedia.type, fileName: introMedia.fileName },
      key
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return {
    type: introMedia.type,
    storageKey: key,
    fileName: introMedia.fileName,
  };
}

export async function copyIntroMedia(fromJobId, toJobId) {
  const fromKey = introStorageKey(fromJobId);
  const toKey = introStorageKey(toJobId);
  const db = await openDb();

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(fromKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record?.blob) return null;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record, toKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return {
    type: record.type,
    storageKey: toKey,
    fileName: record.fileName,
  };
}

export async function deleteIntroMedia(storageKey) {
  if (!storageKey) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(storageKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getIntroMediaObjectUrl(storageKey) {
  if (!storageKey) return null;
  const db = await openDb();

  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(storageKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function resolveIntroMedia(introMedia) {
  if (!introMedia) return null;
  if (introMedia.url) return introMedia;
  if (introMedia.storageKey) {
    const url = await getIntroMediaObjectUrl(introMedia.storageKey);
    if (!url) return introMedia;
    return { ...introMedia, url };
  }
  return introMedia;
}

export async function resolveJobMedia(job) {
  if (!job) return null;
  const introMedia = await resolveIntroMedia(job.introMedia);
  return { ...job, introMedia };
}

export async function persistIntroMediaForJob(jobId, introMedia, previousIntroMedia) {
  if (introMedia === null || introMedia === undefined) {
    if (previousIntroMedia?.storageKey) {
      await deleteIntroMedia(previousIntroMedia.storageKey);
    }
    return null;
  }

  if (introMedia.storageKey && introMedia.url && !isLocalMediaUrl(introMedia.url)) {
    return introMedia;
  }

  if (introMedia.storageKey && !introMedia.url) {
    return introMedia;
  }

  if (introMedia.url && isLocalMediaUrl(introMedia.url)) {
    if (previousIntroMedia?.storageKey) {
      await deleteIntroMedia(previousIntroMedia.storageKey);
    }
    return saveIntroMedia(jobId, introMedia);
  }

  return introMedia;
}
