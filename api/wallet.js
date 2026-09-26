const CIRCLE_API_KEY = process.env.CIRCLEAPIKEY
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s'
const circleHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CIRCLE_API_KEY}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const userId = req.query.userId

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
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}