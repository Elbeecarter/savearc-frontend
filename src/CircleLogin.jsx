import { useState } from 'react'
import { sendOTP, verifyOTP } from './circleWallet.js'

export default function CircleLogin({ onSuccess }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)

  const handleSendOTP = async () => {
    if (!email) return setError('Enter your email')
    setLoading(true)
    setError('')
    try {
      const data = await sendOTP(email)
      if (data.error) throw new Error(data.error)
      setSession(data)
      setStep('otp')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp) return setError('Enter the OTP code')
    setLoading(true)
    setError('')
    try {
      const data = await verifyOTP({
        userToken: session.deviceToken,
        encryptionKey: session.deviceEncryptionKey,
        otpToken: otp
      })
      if (data.error) throw new Error(data.error)

      onSuccess({
        userId: session.userId,
        userToken: session.userToken,
        encryptionKey: session.encryptionKey,
        email
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'white',
      border: '3px solid #FF6B35',
      borderRadius: '16px',
      padding: '2rem',
      maxWidth: '400px',
      margin: '0 auto',
      boxShadow: '8px 8px 0 #0A0A0A'
    }}>
      <h2 style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: '1.3rem',
        marginBottom: '0.5rem'
      }}>
        {step === 'email' ? '📧 Sign in with Email' : '🔐 Enter OTP Code'}
      </h2>
      <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '1.5rem' }}>
        {step === 'email'
          ? 'No MetaMask needed. Enter your email to get started.'
          : `We sent a 6-digit code to ${email}. Check your inbox.`}
      </p>

      {step === 'email' && (
        <>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Email Address
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
            style={{
              width: '100%', padding: '0.75rem',
              border: '2px solid #E5E7EB', borderRadius: '8px',
              fontSize: '1rem', marginTop: '0.35rem',
              marginBottom: '1rem', boxSizing: 'border-box'
            }}
          />
          <button
            onClick={handleSendOTP}
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem',
              background: '#FF6B35', color: 'white',
              border: '2px solid #0A0A0A', borderRadius: '8px',
              fontFamily: 'Space Mono, monospace', fontSize: '0.9rem',
              fontWeight: 700, cursor: 'pointer',
              boxShadow: '4px 4px 0 #0A0A0A'
            }}
          >
            {loading ? 'Sending...' : 'Send Code →'}
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            6-Digit Code
          </label>
          <input
            type="text"
            placeholder="ABC-123456"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
            style={{
              width: '100%', padding: '0.75rem',
              border: '2px solid #E5E7EB', borderRadius: '8px',
              fontSize: '1.2rem', marginTop: '0.35rem',
              marginBottom: '1rem', boxSizing: 'border-box',
              textAlign: 'center', letterSpacing: '0.2em'
            }}
          />
          <button
            onClick={handleVerifyOTP}
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem',
              background: '#FF6B35', color: 'white',
              border: '2px solid #0A0A0A', borderRadius: '8px',
              fontFamily: 'Space Mono, monospace', fontSize: '0.9rem',
              fontWeight: 700, cursor: 'pointer',
              boxShadow: '4px 4px 0 #0A0A0A'
            }}
          >
            {loading ? 'Verifying...' : 'Verify & Create Wallet →'}
          </button>
          <button
            onClick={() => setStep('email')}
            style={{
              width: '100%', padding: '0.5rem',
              background: 'none', border: 'none',
              color: '#6B7280', cursor: 'pointer',
              marginTop: '0.5rem', fontSize: '0.85rem'
            }}
          >
            ← Use different email
          </button>
        </>
      )}

      {error && (
        <p style={{ color: '#EF4444', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          ❌ {error}
        </p>
      )}

      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '1rem', textAlign: 'center' }}>
        Powered by Circle Wallets · No seed phrase needed
      </p>
    </div>
  )
}