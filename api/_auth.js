import crypto from 'node:crypto'

// Shared login check for the API. Files in /api that start with "_" are not
// turned into their own web addresses by Vercel, so this is only code the
// other API files import.
//
// How it works: when the Desktop/Invoice PIN (or an employee's own PIN) is
// entered correctly, the server hands back a signed "token" — a small note
// saying who unlocked it and when it expires, stamped with a secret only
// the server knows. The app sends that token with every API call, and each
// API checks the stamp before doing anything. Nobody can make a valid token
// without the secret, so the /api addresses are useless to outsiders.
//
// Roles:
//   admin    — Michael's Desktop and the /invoice wizard (the site PIN)
//   employee — the /employee portal (that employee's own PIN)

const HEADER = 'x-adk-auth'
const ADMIN_DAYS = 30
const EMPLOYEE_DAYS = 1

// A dedicated secret can be set in Vercel as ADMIN_TOKEN_SECRET. Until then,
// the Sanity write token (already a secret that only the server has) is used.
function secret() {
    const value = process.env.ADMIN_TOKEN_SECRET || process.env.SANITY_WRITE_TOKEN
    if (!value) throw new Error('No token secret configured (set ADMIN_TOKEN_SECRET)')
    return value
}

function sign(data) {
    return crypto.createHmac('sha256', secret()).update(data).digest('base64url')
}

export function makeToken({ role, employeeId }) {
    const days = role === 'admin' ? ADMIN_DAYS : EMPLOYEE_DAYS
    const payload = { role, exp: Date.now() + days * 24 * 60 * 60 * 1000 }
    if (employeeId) payload.employeeId = employeeId
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return `${data}.${sign(data)}`
}

// Returns { role, employeeId } for a valid, unexpired token — otherwise null.
export function readToken(req) {
    const header = req.headers?.[HEADER]
    if (typeof header !== 'string' || !header.includes('.')) return null
    const [data, stamp] = header.split('.')
    const expected = sign(data)
    const a = Buffer.from(stamp || '')
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
        if (!payload.exp || payload.exp < Date.now()) return null
        if (payload.role !== 'admin' && payload.role !== 'employee') return null
        return payload
    } catch {
        return null
    }
}

// Michael only. Sends the 401 itself and returns false if not allowed.
export function requireAdmin(req, res) {
    const who = readToken(req)
    if (who?.role === 'admin') return true
    res.status(401).json({ error: 'Please unlock with the access PIN again', needsLogin: true })
    return false
}

// Michael or a logged-in employee.
export function requireStaff(req, res) {
    const who = readToken(req)
    if (who?.role === 'admin' || who?.role === 'employee') return true
    res.status(401).json({ error: 'Please log in again', needsLogin: true })
    return false
}
