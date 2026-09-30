// Sends the login token with every call to this site's /api addresses.
//
// Instead of changing the dozens of fetch('/api/...') calls around the app,
// this wraps the browser's fetch once, when the page starts. Any request to
// /api/... gets the token added as an "x-adk-auth" header; every other
// request (Sanity images, fonts, etc.) is left alone.
//
// If the server says the token is missing or expired, the saved login is
// cleared and the page reloads to the PIN screen.

const ADMIN_KEY = 'adkAdminToken'
const EMPLOYEE_KEY = 'adkEmployeeToken'
// The old "unlocked" flag from before tokens existed — cleared on logout.
const OLD_UNLOCK_KEY = 'invoicePinVerified'

let mode = null // 'admin' | 'employee'

function safeGet(storage, key) {
    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

function safeSet(storage, key, value) {
    try {
        if (value) storage.setItem(key, value)
        else storage.removeItem(key)
    } catch {
        // Private browsing or blocked storage — the login just won't be remembered.
    }
}

export function getAdminToken() {
    return safeGet(localStorage, ADMIN_KEY)
}

export function setAdminToken(token) {
    safeSet(localStorage, ADMIN_KEY, token)
}

// Employee logins last only as long as the browser tab.
export function setEmployeeToken(token) {
    safeSet(sessionStorage, EMPLOYEE_KEY, token)
}

function currentToken() {
    if (mode === 'admin') return getAdminToken()
    if (mode === 'employee') return safeGet(sessionStorage, EMPLOYEE_KEY)
    return null
}

function isOwnApi(input) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
    if (!url) return false
    if (url.startsWith('/api/')) return true
    try {
        const parsed = new URL(url, window.location.origin)
        return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
    } catch {
        return false
    }
}

// Call once, before the app renders. kind is 'admin' (Desktop, /invoice)
// or 'employee' (/employee).
export function installApiAuth(kind) {
    if (mode) return
    mode = kind
    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input, init = {}) => {
        if (!isOwnApi(input)) return originalFetch(input, init)

        const token = currentToken()
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
        if (token) headers.set('x-adk-auth', token)
        const response = await originalFetch(input, { ...init, headers })

        if (response.status === 401) {
            const body = await response.clone().json().catch(() => ({}))
            if (body.needsLogin) {
                if (mode === 'admin') {
                    setAdminToken(null)
                    safeSet(localStorage, OLD_UNLOCK_KEY, null)
                } else {
                    setEmployeeToken(null)
                }
                window.location.reload()
            }
        }
        return response
    }
}
