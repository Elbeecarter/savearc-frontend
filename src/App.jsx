import TransactionHistory from "./TransactionHistory.jsx"
import { useState, useEffect } from 'react'
import { switchToArc } from './utils.js'
import {
  createGoal, depositToGoal, withdrawFromGoal, emergencyWithdrawFromGoal,
  createPool, joinPool, contributeToPool,
  fetchUserGoals, fetchPools, fetchUSDCBalance
} from './transactions.js'
import './App.css'

export default function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState('0')
  const [goals, setGoals] = useState([])
  const [pools, setPools] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showPoolModal, setShowPoolModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(null)
  const [showWithdrawModal, setShowWithdrawModal] = useState(null)
  const [showContributeModal, setShowContributeModal] = useState(null)
  const [goalForm, setGoalForm] = useState({ name: '', target: '', days: '180', lock: '30' })
  const [poolForm, setPoolForm] = useState({ name: '', contribution: '', cycle: '7', members: '5' })
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const connectWallet = async () => {
    if (!window.ethereum) return showToast('Please install MetaMask!', 'error')
    try {
      setLoading(true)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      await switchToArc()
      setAccount(accounts[0])
      showToast('Connected to Arc Testnet!')
    } catch (e) {
      showToast('Connection failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    if (!account) return
    try {
      const [bal, userGoals, allPools] = await Promise.all([
        fetchUSDCBalance(account),
        fetchUserGoals(account),
        fetchPools()
      ])
      setBalance(bal)
      setGoals(userGoals)
      setPools(allPools)
    } catch (e) {
      console.error('Refresh error:', e)
    }
  }

  useEffect(() => {
    if (account) refreshData()
  }, [account])

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) setAccount(accounts[0])
        else setAccount(null)
      })
      window.ethereum.on('chainChanged', () => window.location.reload())
    }
  }, [])

  const handleCreateGoal = async () => {
    if (!goalForm.name || !goalForm.target) return showToast('Fill all fields', 'error')
    try {
      setLoading(true)
      showToast('Creating goal on Arc Network...')
      const hash = await createGoal(goalForm.name, goalForm.target, goalForm.days, goalForm.lock)
      showToast('Goal created! Tx: ' + hash.slice(0, 16) + '...')
      setShowGoalModal(false)
      setGoalForm({ name: '', target: '', days: '180', lock: '30' })
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!depositAmount) return showToast('Enter amount', 'error')
    try {
      setLoading(true)
      showToast('Approving USDC...')
      const hash = await depositToGoal(showDepositModal, depositAmount, account)
      showToast('Deposited! Tx: ' + hash.slice(0, 16) + '...')
      setShowDepositModal(null)
      setDepositAmount('')
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async (goalId) => {
    try {
      setLoading(true)
      showToast('Withdrawing...')
      const hash = await withdrawFromGoal(goalId)
      showToast('Withdrawn! Tx: ' + hash.slice(0, 16) + '...')
      setShowWithdrawModal(null)
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEmergencyWithdraw = async (goalId) => {
    if (!withdrawAmount) return showToast('Enter amount', 'error')
    try {
      setLoading(true)
      showToast('Emergency withdraw (10% penalty)...')
      const hash = await emergencyWithdrawFromGoal(goalId, withdrawAmount)
      showToast('Done! Tx: ' + hash.slice(0, 16) + '...')
      setShowWithdrawModal(null)
      setWithdrawAmount('')
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePool = async () => {
    if (!poolForm.name || !poolForm.contribution) return showToast('Fill all fields', 'error')
    try {
      setLoading(true)
      showToast('Creating pool on Arc Network...')
      const hash = await createPool(poolForm.name, poolForm.contribution, poolForm.cycle, poolForm.members)
      showToast('Pool created! Tx: ' + hash.slice(0, 16) + '...')
      setShowPoolModal(false)
      setPoolForm({ name: '', contribution: '', cycle: '7', members: '5' })
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleStartPool = async (poolId) => {
    try {
      setLoading(true)
      showToast("Starting pool...")
      const { ethers } = await import("ethers")
      const POOL = "0x1a3729b5ddc9A0FC9d5D21857539bCE460ac91D2"
      const iface = new ethers.Interface(["function startPool(uint256)"])
      const data = iface.encodeFunctionData("startPool", [poolId])
      const from = (await window.ethereum.request({ method: "eth_accounts" }))[0]
      const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network")
      const feeData = await provider.getFeeData()
      const nonce = await provider.getTransactionCount(from)
      const gasPrice = feeData.gasPrice
      const gasEstimate = await provider.estimateGas({ from, to: POOL, data })
      const gasLimit = (gasEstimate * 120n) / 100n
      const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from, to: POOL, data, chainId: "0x4cef52", nonce: "0x" + nonce.toString(16), gas: "0x" + gasLimit.toString(16), maxFeePerGas: "0x" + gasPrice.toString(16), maxPriorityFeePerGas: "0x" + (gasPrice / 10n).toString(16) }] })
      let receipt = null
      while (!receipt) { await new Promise(r => setTimeout(r, 1500)); receipt = await provider.getTransactionReceipt(txHash) }
      showToast("Pool started!")
      await refreshData()
    } catch(e) { showToast("Failed: " + e.message, "error") }
    finally { setLoading(false) }
  }

  const handleJoinPool = async (poolId) => {
    try {
      setLoading(true)
      showToast('Joining pool...')
      const hash = await joinPool(poolId)
      showToast('Joined! Tx: ' + hash.slice(0, 16) + '...')
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleContribute = async (poolId, amount) => {
    try {
      setLoading(true)
      showToast('Contributing to pool...')
      const hash = await contributeToPool(poolId, amount, account)
      showToast('Contributed! Tx: ' + hash.slice(0, 16) + '...')
      setShowContributeModal(null)
      await refreshData()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (val) => {
    try {
      const { ethers } = require('ethers')
      return parseFloat(ethers.formatUnits(val, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } catch {
      return '0.00'
    }
  }

  const fmtBigInt = (val) => {
    if (!val) return '0.00'
    return parseFloat((BigInt(val.toString()) / BigInt(1e4)).toString()) / 100
  }

  const progress = (current, target) => {
    if (!current || !target) return 0
    const c = Number(current.toString()) / 1e6
    const t = Number(target.toString()) / 1e6
    return Math.min((c / t) * 100, 100).toFixed(1)
  }

  const formatUSDC = (val) => {
    if (!val) return '0.00'
    return (Number(val.toString()) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const statusLabel = (s) => ['Open', 'Active', 'Completed'][Number(s)] || 'Unknown'
  const statusColor = (s) => ['#2E7D32', '#1565C0', '#6B7280'][Number(s)] || '#6B7280'

  return (
    <div className="app">
      {/* NAV */}
      <nav className="nav">
        <div className="logo">💰 SaveArc</div>
        <div className="nav-links">
          {['dashboard', 'goals', 'pools'].map(t => (
            <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className={`connect-btn ${account ? 'connected' : ''}`} onClick={connectWallet} disabled={loading}>
          {loading ? '...' : account ? account.slice(0, 6) + '...' + account.slice(-4) : 'Connect Wallet'}
        </button>
      </nav>

      {/* HERO */}
      {!account && (
        <div className="hero">
          <h1>Save Smart.<br />Save Together.</h1>
          <p>Inflation-proof savings for Africa, built on Arc Network</p>
          <div className="hero-stats">
            <div className="hstat"><span>$92.1B</span><small>Nigeria On-chain Volume</small></div>
            <div className="hstat"><span>0%</span><small>Inflation on USDC</small></div>
            <div className="hstat"><span>&lt;1s</span><small>Arc Finality</small></div>
          </div>
          <button className="connect-btn big" onClick={connectWallet}>Get Started →</button>
        </div>
      )}

      {/* DASHBOARD */}
      {account && activeTab === 'dashboard' && (
        <div className="dashboard">
          <div className="balance-card">
            <small>USDC Balance on Arc Testnet</small>
            <h2>{parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</h2>
            <small>{account}</small>
          </div>
          <div className="summary-grid">
            <div className="scard orange"><h3>{goals.filter(g => g.isActive).length}</h3><p>Active Goals</p></div>
            <div className="scard green"><h3>{pools.length}</h3><p>Community Pools</p></div>
            <div className="scard blue">
              <h3>{goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0) / 1e6 > 0
                ? (goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0) / 1e6).toFixed(2)
                : '0.00'}
              </h3>
              <p>Total Saved</p>
            </div>
          </div>
          <div className="quick-actions">
            <button className="btn orange" onClick={() => { setActiveTab('goals'); setShowGoalModal(true) }}>+ New Goal</button>
            <button className="btn green" onClick={() => { setActiveTab('pools'); setShowPoolModal(true) }}>+ New Pool</button>
            <a className="btn gray" href={`https://testnet.arcscan.app/address/${account}`} target="_blank" rel="noreferrer">View on Explorer</a>
          </div>

          {/* Transaction History */}
          <div style={{marginTop:'2rem'}}>
            <h3 style={{fontFamily:'Space Mono', marginBottom:'1rem'}}>📜 Transaction History</h3>
            <TransactionHistory account={account} />
          </div>

          {/* Recent Goals Preview */}
          {goals.length > 0 && (
            <div style={{marginTop: '2rem'}}>
              <h3 style={{fontFamily: 'Space Mono', marginBottom: '1rem'}}>Your Goals</h3>
              <div className="goals-grid">
                {goals.slice(0, 2).map((g, i) => (
                  <div key={i} className="goal-card">
                    <div className="goal-top">
                      <h3>{g.name}</h3>
                      <span className={`badge ${g.isActive ? 'active' : 'done'}`}>{g.isActive ? 'Active' : 'Done'}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: progress(g.currentAmount, g.targetAmount) + '%' }} />
                    </div>
                    <div className="goal-amounts">
                      <span>{formatUSDC(g.currentAmount)} USDC</span>
                      <span>{progress(g.currentAmount, g.targetAmount)}%</span>
                      <span>{formatUSDC(g.targetAmount)} USDC</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GOALS TAB */}
      {account && activeTab === 'goals' && (
        <div className="section">
          <div className="section-header">
            <h2>🎯 Savings Goals</h2>
            <button className="btn orange" onClick={() => setShowGoalModal(true)}>+ Create Goal</button>
          </div>
          {goals.length === 0 ? (
            <div className="empty">No goals yet. Create your first savings goal!</div>
          ) : (
            <div className="goals-grid">
              {goals.map((g, i) => (
                <div key={i} className="goal-card">
                  <div className="goal-top">
                    <h3>{g.name}</h3>
                    <span className={`badge ${g.isActive ? 'active' : 'done'}`}>{g.isActive ? 'Active' : 'Done'}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: progress(g.currentAmount, g.targetAmount) + '%' }} />
                  </div>
                  <div className="goal-amounts">
                    <span>{formatUSDC(g.currentAmount)} USDC</span>
                    <span>{progress(g.currentAmount, g.targetAmount)}%</span>
                    <span>{formatUSDC(g.targetAmount)} USDC</span>
                  </div>
                  <div className="goal-meta">
                    <small>⏳ Unlocks: {new Date((Number(g.lastDepositTime) + Number(g.lockPeriod)) * 1000).toLocaleDateString()}</small>
                    <small>🔒 Lock: {(Number(g.lockPeriod) / 86400).toFixed(0)} days</small>
                    <small style={{marginLeft: '1rem'}}>📅 Deadline: {new Date(Number(g.deadline) * 1000).toLocaleDateString()}</small>
                  </div>
                  <div className="goal-actions">
                    {g.isActive && (
                      <button className="btn orange sm" onClick={() => setShowDepositModal(i)}>💰 Deposit</button>
                    )}
                    {g.isActive && Number(g.currentAmount) > 0 && (
                      <button className="btn gray sm" onClick={() => setShowWithdrawModal(i)}>📤 Withdraw</button>
                    )}
                    <a className="btn gray sm" href={`https://testnet.arcscan.app/address/0x6eD021481140a6B385dfc45d9c8B4F5D583Da1ab`} target="_blank" rel="noreferrer">🔍 Explorer</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POOLS TAB */}
      {account && activeTab === 'pools' && (
        <div className="section">
          <div className="section-header">
            <h2>🤝 Community Pools (Ajo)</h2>
            <button className="btn green" onClick={() => setShowPoolModal(true)}>+ Create Pool</button>
          </div>
          {pools.length === 0 ? (
            <div className="empty">No pools yet. Start a community savings group!</div>
          ) : (
            <div className="pools-grid">
              {pools.map((p, i) => (
                <div key={i} className="pool-card">
                  <h3>{p.name}</h3>
                  <div className="pool-info">
                    <div><small>Contribution</small><strong>{formatUSDC(p.contributionAmount)} USDC</strong></div>
                    <div><small>Cycle</small><strong>{(Number(p.cycleDuration) / 86400).toFixed(0)} days</strong></div>
                    <div><small>Members</small><strong>{p.members.length}/{p.maxMembers.toString()}</strong></div>
                    <div><small>Status</small><strong style={{color: statusColor(p.status)}}>{statusLabel(p.status)}</strong></div>
                  </div>
                  {Number(p.status) === 0 && p.creator?.toLowerCase() === account?.toLowerCase() && (
                    <button className="btn orange sm" onClick={() => handleStartPool(p.id)} disabled={loading} style={{marginBottom:"0.5rem",width:"100%", opacity: p.members.length >= 3 ? 1 : 0.5}}>
                      {loading ? "..." : "🚀 Start Pool (" + p.members.length + "/" + Number(p.maxMembers) + " members)"}
                    </button>
                  )}
                  {Number(p.status) === 0 && p.creator?.toLowerCase() !== account?.toLowerCase() && (
                    <button className="btn green sm" onClick={() => handleJoinPool(p.id)} disabled={loading}>
                      {loading ? '...' : 'Join Pool'}
                    </button>
                  )}
                  {Number(p.status) === 1 && (
                    <button className="btn orange sm" onClick={() => setShowContributeModal(p)} disabled={loading}>
                      💰 Contribute
                    </button>
                  )}
                  <a className="btn gray sm" style={{marginLeft: '0.5rem'}} href={`https://testnet.arcscan.app/address/0x1a3729b5ddc9A0FC9d5D21857539bCE460ac91D2`} target="_blank" rel="noreferrer">🔍 Explorer</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE GOAL MODAL */}
      {showGoalModal && (
        <div className="overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Savings Goal</h2>
            <label>Goal Name</label>
            <input placeholder="e.g. Emergency Fund" value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} />
            <label>Target Amount (USDC)</label>
            <input type="number" placeholder="500" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} />
            <label>Duration</label>
            <select value={goalForm.days} onChange={e => setGoalForm({ ...goalForm, days: e.target.value })}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
            <label>Lock Period</label>
            <select value={goalForm.lock} onChange={e => setGoalForm({ ...goalForm, lock: e.target.value })}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowGoalModal(false)}>Cancel</button>
              <button className="btn orange" onClick={handleCreateGoal} disabled={loading}>
                {loading ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {showDepositModal !== null && (
        <div className="overlay" onClick={() => setShowDepositModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>💰 Deposit to "{goals[showDepositModal]?.name}"</h2>
            <label>Amount (USDC)</label>
            <input type="number" placeholder="100" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            <small style={{color:'#666', display:'block', marginTop:'0.5rem'}}>Your balance: {parseFloat(balance).toFixed(2)} USDC</small>
            <small style={{color:'#666', display:'block'}}>Fee: 0.5% (max $5)</small>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowDepositModal(null)}>Cancel</button>
              <button className="btn orange" onClick={handleDeposit} disabled={loading}>
                {loading ? 'Processing...' : 'Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {showWithdrawModal !== null && (
        <div className="overlay" onClick={() => setShowWithdrawModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📤 Withdraw from "{goals[showWithdrawModal]?.name}"</h2>
            <div style={{background:'#FFF3EE', padding:'1rem', borderRadius:'8px', marginBottom:'1rem', border:'2px solid #FF6B35'}}>
              <strong>Full Withdraw</strong> — available after lock period expires
            </div>
            <button className="btn orange" style={{width:'100%', marginBottom:'1rem'}} onClick={() => handleWithdraw(showWithdrawModal)} disabled={loading}>
              {loading ? 'Processing...' : 'Withdraw All'}
            </button>
            <div style={{background:'#FFF3EE', padding:'1rem', borderRadius:'8px', marginBottom:'1rem', border:'2px solid #EF4444'}}>
              <strong>⚠️ Emergency Withdraw</strong> — 10% penalty applies
            </div>
            <label>Emergency Amount (USDC)</label>
            <input type="number" placeholder="100" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowWithdrawModal(null)}>Cancel</button>
              <button className="btn gray" style={{background:'#EF4444', color:'white'}} onClick={() => handleEmergencyWithdraw(showWithdrawModal)} disabled={loading}>
                {loading ? 'Processing...' : '⚠️ Emergency Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POOL MODAL */}
      {showPoolModal && (
        <div className="overlay" onClick={() => setShowPoolModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Community Pool</h2>
            <label>Pool Name</label>
            <input placeholder="e.g. Lagos Traders Ajo" value={poolForm.name} onChange={e => setPoolForm({ ...poolForm, name: e.target.value })} />
            <label>Contribution per Cycle (USDC)</label>
            <input type="number" placeholder="50" value={poolForm.contribution} onChange={e => setPoolForm({ ...poolForm, contribution: e.target.value })} />
            <label>Cycle Duration</label>
            <select value={poolForm.cycle} onChange={e => setPoolForm({ ...poolForm, cycle: e.target.value })}>
              <option value="1">Daily</option>
              <option value="7">Weekly</option>
              <option value="14">Bi-weekly</option>
              <option value="30">Monthly</option>
            </select>
            <label>Max Members</label>
            <input type="number" placeholder="5" min="3" max="50" value={poolForm.members} onChange={e => setPoolForm({ ...poolForm, members: e.target.value })} />
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowPoolModal(false)}>Cancel</button>
              <button className="btn green" onClick={handleCreatePool} disabled={loading}>
                {loading ? 'Creating...' : 'Create Pool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTRIBUTE MODAL */}
      {showContributeModal !== null && (
        <div className="overlay" onClick={() => setShowContributeModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>💰 Contribute to "{showContributeModal?.name}"</h2>
            <div style={{background:'#F0FDF4', padding:'1rem', borderRadius:'8px', marginBottom:'1rem', border:'2px solid #2E7D32'}}>
              <strong>Contribution Amount: {formatUSDC(showContributeModal?.contributionAmount)} USDC</strong>
              <p style={{fontSize:'0.85rem', color:'#666', marginTop:'0.25rem'}}>This cycle's contribution to the Ajo pool</p>
            </div>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowContributeModal(null)}>Cancel</button>
              <button className="btn green" onClick={() => handleContribute(showContributeModal.id, (Number(showContributeModal.contributionAmount) / 1e6).toString())} disabled={loading}>
                {loading ? 'Processing...' : 'Contribute Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
