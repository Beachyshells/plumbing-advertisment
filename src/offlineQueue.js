// Lightweight IndexedDB wrapper for offline support.
// Keeps a local copy of customers + inventory so Michael can search them
// with no signal, and queues any customer/invoice he saves while offline
// so it uploads automatically the next time the phone has a connection.

const DATABASE_NAME = 'adk-offline-store'
const DATABASE_VERSION = 1

const STORE_NAMES = {
    cachedCustomers: 'cachedCustomers',
    cachedInventory: 'cachedInventory',
    pendingCustomers: 'pendingCustomers',
    pendingInvoices: 'pendingInvoices',
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE_NAMES.cachedCustomers)) {
                db.createObjectStore(STORE_NAMES.cachedCustomers, { keyPath: '_id' })
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.cachedInventory)) {
                db.createObjectStore(STORE_NAMES.cachedInventory, { keyPath: '_id' })
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.pendingCustomers)) {
                db.createObjectStore(STORE_NAMES.pendingCustomers, { keyPath: 'localId', autoIncrement: true })
            }
            if (!db.objectStoreNames.contains(STORE_NAMES.pendingInvoices)) {
                db.createObjectStore(STORE_NAMES.pendingInvoices, { keyPath: 'localId', autoIncrement: true })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function getAllFromStore(storeName) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const request = tx.objectStore(storeName).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })
}

async function replaceAllInStore(storeName, records) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        store.clear()
        records.forEach((record) => store.put(record))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

async function addToStore(storeName, record) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const request = tx.objectStore(storeName).add(record)
        request.onsuccess = () => resolve(request.result) // the new localId
        tx.onerror = () => reject(tx.error)
    })
}

async function deleteFromStore(storeName, localId) {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).delete(localId)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// ---- Cache: refreshed from the server whenever we're online ----
export const cacheCustomers = (customers) => replaceAllInStore(STORE_NAMES.cachedCustomers, customers)
export const getCachedCustomers = () => getAllFromStore(STORE_NAMES.cachedCustomers)
export const cacheInventory = (items) => replaceAllInStore(STORE_NAMES.cachedInventory, items)
export const getCachedInventory = () => getAllFromStore(STORE_NAMES.cachedInventory)

// ---- Pending queue: saved offline, waiting to sync ----
export const queuePendingCustomer = (payload) => addToStore(STORE_NAMES.pendingCustomers, { payload })
export const getPendingCustomers = () => getAllFromStore(STORE_NAMES.pendingCustomers)
export const removePendingCustomer = (localId) => deleteFromStore(STORE_NAMES.pendingCustomers, localId)

export const queuePendingInvoice = (payload) => addToStore(STORE_NAMES.pendingInvoices, { payload })
export const getPendingInvoices = () => getAllFromStore(STORE_NAMES.pendingInvoices)
export const removePendingInvoice = (localId) => deleteFromStore(STORE_NAMES.pendingInvoices, localId)

export async function countPendingItems() {
    const [customers, invoices] = await Promise.all([getPendingCustomers(), getPendingInvoices()])
    return customers.length + invoices.length
}

// Pushes every queued customer and invoice to the server. Customers sync
// first — an invoice created offline for a brand-new customer references a
// temporary "local-..." id until the real customer exists in Sanity, so
// that swap has to happen before the invoice can go out for real.
export async function syncPendingData() {
    const localIdToRealId = {}

    const pendingCustomers = await getPendingCustomers()
    for (const pending of pendingCustomers) {
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pending.payload),
            })
            if (!res.ok) continue
            const { id } = await res.json()
            localIdToRealId[pending.payload.localCustomerId] = id
            await removePendingCustomer(pending.localId)
        } catch (err) {
            console.error('Sync failed for a pending customer, will retry later:', err)
        }
    }

    const pendingInvoices = await getPendingInvoices()
    for (const pending of pendingInvoices) {
        const payload = { ...pending.payload }
        if (typeof payload.customerId === 'string' && payload.customerId.startsWith('local-')) {
            const realId = localIdToRealId[payload.customerId]
            if (!realId) continue // matching customer hasn't synced yet — try again next time
            payload.customerId = realId
        }
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) continue
            await removePendingInvoice(pending.localId)
        } catch (err) {
            console.error('Sync failed for a pending invoice, will retry later:', err)
        }
    }
}