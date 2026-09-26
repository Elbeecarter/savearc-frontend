const CIRCLE_API_KEY = process.env.VITE_CIRCLE_API_KEY
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s'

const circleHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CIRCLE_API_KEY}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const path = req.url.replace('/api/circle', '')

  try {
    if (req.method === 'POST' && path === '/send-otp') {
      const { email } = req.body
      const userId = email.replace(/[^a-zA-Z0-9]/g, '_')

      await fetch(`${CIRCLE_BASE}/users`, {
        method: 'POST',
        headers: circleHeaders,
        body: JSON.stringify({ userId })
      })

      const tokenRes = await fetch(`${CIRCLE_BASE}/users/token`, {
        method: 'POST',
        headers: circleHeaders,
        body: JSON.stringify({ userId })
      })
      const tokenData = await tokenRes.json()
      const userToken = tokenData.data?.userToken

      const otpRes = await fetch(`${CIRCLE_BASE}/users/email/token`, {
        method: 'POST',
        headers: { ...circleHeaders, 'X-User-Token': userToken },
        body: JSON.stringify({
          deviceId: userId,
          email,
          idempotencyKey: crypto.randomUUID()
        })
      })
      const otpData = await otpRes.json()
      const deviceToken = otpData.data?.deviceToken
      const deviceEncryptionKey = otpData.data?.deviceEncryptionKey

      return res.json({ userId, deviceToken, deviceEncryptionKey })
    }

    if (req.method === 'POST' && path === '/verify-otp') {
      const { userToken, encryptionKey, otpToken } = req.body

      const response = await fetch(`${CIRCLE_BASE}/user/initialize`, {
        method: 'POST',
        headers: { ...circleHeaders, 'X-User-Token': userToken },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          accountType: 'SCA',
          blockchains: ['ARC-MAINNET'],
          otpToken
        })
      })
      const data = await response.json()
      return res.json({ ...data, encryptionKey })
    }

    if (req.method === 'GET' && path.startsWith('/wallet/')) {
      const userId = path.replace('/wallet/', '')
      const tokenRes = await fetch(`${CIRCLE_BASE}/users/token`, {
        method: 'POST',
        headers: circleHeaders,
        body: JSON.stringify({ userId })
      })
      const tokenData = await tokenRes.json()
      const userToken = tokenData.data?.userToken

      const walletRes = await fetch(`${CIRCLE_BASE}/wallets?userId=${userId}`, {
        headers: { ...circleHeaders, 'X-User-Token': userToken }
      })
      const walletData = await walletRes.json()
      return res.json({ ...walletData, userToken })
    }

    return res.status(404).json({ error: 'Not found' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}