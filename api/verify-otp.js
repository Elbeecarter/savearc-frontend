const CIRCLE_API_KEY = process.env.CIRCLEAPIKEY
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s'
const circleHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CIRCLE_API_KEY}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
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
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}