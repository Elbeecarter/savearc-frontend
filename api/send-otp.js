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

    return res.json({
      userId,
      deviceToken: otpData.data?.deviceToken,
      deviceEncryptionKey: otpData.data?.deviceEncryptionKey
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}