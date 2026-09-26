const express = require('express')
const cors = require('cors')
require('dotenv').config({ path: '.env.local' })

const app = express()
app.use(cors())
app.use(express.json())

const CIRCLE_API_KEY = process.env.VITE_CIRCLE_API_KEY
const CIRCLE_BASE = 'https://api.circle.com/v1/w3s'

const circleHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${CIRCLE_API_KEY}`
}

app.post('/api/circle/send-otp', async (req, res) => {
  console.log('OTP request for:', req.body.email)
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
    console.log('Token response:', JSON.stringify(tokenData))

    const userToken = tokenData.data?.userToken
    const encryptionKey = tokenData.data?.encryptionKey

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
    console.log('OTP response:', JSON.stringify(otpData))

    const deviceToken = otpData.data?.deviceToken
const deviceEncryptionKey = otpData.data?.deviceEncryptionKey
const otpToken = otpData.data?.otpToken
res.json({ userId, deviceToken, deviceEncryptionKey, otpToken })
  } catch (e) {
    console.error('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/circle/verify-otp', async (req, res) => {
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
    console.log('Verify OTP response:', JSON.stringify(data))
    res.json({ ...data, encryptionKey })
  } catch (e) {
    console.error('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/circle/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params

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
    res.json({ ...walletData, userToken })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = 3001
app.listen(PORT, () => console.log(`Circle API server running on port ${PORT}`))