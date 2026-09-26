export const sendOTP = async (email) => {
  const response = await fetch('/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  return response.json()
}

export const verifyOTP = async ({ userToken, encryptionKey, otpToken }) => {
  const response = await fetch('/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userToken, encryptionKey, otpToken })
  })
  return response.json()
}

export const getUserWallet = async (userId) => {
  const response = await fetch(`/api/wallet?userId=${userId}`)
  return response.json()
}