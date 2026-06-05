import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import './App.css'

const ARC_CHAIN_ID = 5042002
const ARC_RPC = 'https://rpc.testnet.arc.network'
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
const VAULT_ADDRESS = '0x6eD021481140a6B385dfc45d9c8B4F5D583Da1ab'
const POOL_ADDRESS = '0x1a3729b5ddc9A0FC9d5D21857539bCE460ac91D2'

const VAULT_ABI = [
  'function createGoal(string,uint256,uint256,uint256) returns (uint256)',
  'function deposit(uint256,uint256)',
  'function withdraw(uint256)',
  'function emergencyWithdraw(uint256,uint256)',
  'function getUserGoals(address) view returns (tuple(string name,uint256 targetAmount,uint256 currentAmount,uint256 deadline,uint256 lockPeriod,uint256 createdAt,uint256 lastDepositTime,bool isActive)[])',
]

const POOL_ABI = [
  'function createPool(string,uint256,uint256,uint256) returns (uint256)',
  'function joinPool(uint256)',
  'function startPool(uint256)',
  'function contribute(uint256)',
  'function getPool(uint256) view returns (tuple(string name,address creator,uint256 contributionAmount,uint256 cycleDuration,uint256 maxMembers,uint256 currentCycle,uint256 startTime,uint256 nextCycleTime,uint8 status,address[] members,address currentRecipient,uint256 poolBalance))',
  'function poolCount() view returns (uint256)',
]

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
]

export default function App() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState('0')
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [goals, setGoals] = useState([])
  const [pools, setPools] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showPoolModal, setShowPoolModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(null)
  const [goalForm, setGoalForm] = useState({ name: '', target: '', days: '180', lock: '30' })
  const [poolForm, setPoolForm] = useState({ name: '', contribution: '', cycle: '7', members: '5' })
  const [depositAmount, setDepositAmount] = useState('')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const connectWallet = async () => {
    if (!window.ethereum) return showToast('Please install MetaMask!', 'error')
    try {
      setLoading(true)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })

      // Switch to Arc Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x4CF772' }],
        })
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x4CF772',
              chainName: 'Arc Testnet',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
              rpcUrls: [ARC_RPC],
              blockExplorerUrls: ['https://testnet.arcscan.app'],
            }],
          })
        }
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum)
      const web3Signer = await web3Provider.getSigner()
      setProvider(web3Provider)
      setSigner(web3Signer)
      setAccount(accounts[0])
      showToast('Connected to Arc Testnet!')
    } catch (e) {
      showToast('Connection failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    if (!account || !provider) return
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
    const bal = await usdc.balanceOf(account)
    setBalance(ethers.formatUnits(bal, 6))
  }

  const fetchGoals = async () => {
    if (!account || !provider) return
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider)
    const data = await vault.getUserGoals(account)
    setGoals(data)
  }

  const fetchPools = async () => {
    if (!provider) return
    const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider)
    const count = await pool.poolCount()
    const allPools = []
    for (let i = 0; i < count; i++) {
      const p = await pool.getPool(i)
      allPools.push({ ...p, id: i })
    }
    setPools(allPools)
  }

  useEffect(() => {
    if (account && provider) {
      fetchBalance()
      fetchGoals()
      fetchPools()
    }
  }, [account, provider])

  const createGoal = async () => {
    if (!signer) return showToast('Connect wallet first', 'error')
    try {
      setLoading(true)
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer)
      const target = ethers.parseUnits(goalForm.target, 6)
      const deadline = Math.floor(Date.now() / 1000) + parseInt(goalForm.days) * 86400
      const lock = parseInt(goalForm.lock) * 86400
      const tx = await vault.createGoal(goalForm.name, target, deadline, lock)
      showToast('Creating goal... waiting for confirmation')
      await tx.wait()
      showToast('Goal created! Tx: ' + tx.hash.slice(0, 20) + '...')
      setShowGoalModal(false)
      setGoalForm({ name: '', target: '', days: '180', lock: '30' })
      await fetchGoals()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const depositToGoal = async (goalId) => {
    if (!signer || !depositAmount) return
    try {
      setLoading(true)
      const amount = ethers.parseUnits(depositAmount, 6)
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer)

      // Check allowance
      const allowance = await usdc.allowance(account, VAULT_ADDRESS)
      if (allowance < amount) {
        showToast('Approving USDC...')
        const approveTx = await usdc.approve(VAULT_ADDRESS, amount)
        await approveTx.wait()
      }

      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer)
      showToast('Depositing...')
      const tx = await vault.deposit(goalId, amount)
      await tx.wait()
      showToast('Deposit successful!')
      setShowDepositModal(null)
      setDepositAmount('')
      await fetchGoals()
      await fetchBalance()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const createPool = async () => {
    if (!signer) return showToast('Connect wallet first', 'error')
    try {
      setLoading(true)
      const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer)
      const contribution = ethers.parseUnits(poolForm.contribution, 6)
      const cycle = parseInt(poolForm.cycle) * 86400
      const tx = await pool.createPool(poolForm.name, contribution, cycle, parseInt(poolForm.members))
      showToast('Creating pool...')
      await tx.wait()
      showToast('Pool created!')
      setShowPoolModal(false)
      setPoolForm({ name: '', contribution: '', cycle: '7', members: '5' })
      await fetchPools()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const joinPool = async (poolId) => {
    if (!signer) return showToast('Connect wallet first', 'error')
    try {
      setLoading(true)
      const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer)
      const tx = await pool.joinPool(poolId)
      showToast('Joining pool...')
      await tx.wait()
      showToast('Joined pool successfully!')
      await fetchPools()
    } catch (e) {
      showToast('Failed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const progress = (current, target) => {
    const pct = (Number(ethers.formatUnits(current, 6)) / Number(ethers.formatUnits(target, 6))) * 100
    return Math.min(pct, 100).toFixed(1)
  }

  const fmt = (val) => parseFloat(ethers.formatUnits(val, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const statusLabel = (s) => ['Open', 'Active', 'Completed'][s] || 'Unknown'

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
            <small>USDC Balance</small>
            <h2>{parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</h2>
            <small>Arc Testnet · {account.slice(0, 10)}...</small>
          </div>
          <div className="summary-grid">
            <div className="scard orange"><h3>{goals.filter(g => g.isActive).length}</h3><p>Active Goals</p></div>
            <div className="scard green"><h3>{pools.length}</h3><p>Community Pools</p></div>
            <div className="scard blue"><h3>6.2%</h3><p>Est. APY</p></div>
          </div>
          <div className="quick-actions">
            <button className="btn orange" onClick={() => { setActiveTab('goals'); setShowGoalModal(true) }}>+ New Goal</button>
            <button className="btn green" onClick={() => { setActiveTab('pools'); setShowPoolModal(true) }}>+ New Pool</button>
            <a className="btn gray" href={`https://testnet.arcscan.app/address/${account}`} target="_blank">View on Explorer</a>
          </div>
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
                    <span>{fmt(g.currentAmount)} USDC</span>
                    <span>{progress(g.currentAmount, g.targetAmount)}%</span>
                    <span>{fmt(g.targetAmount)} USDC</span>
                  </div>
                  <div className="goal-meta">
                    <small>Lock: {(Number(g.lockPeriod) / 86400).toFixed(0)} days</small>
                  </div>
                  <div className="goal-actions">
                    <button className="btn orange sm" onClick={() => setShowDepositModal(i)}>Deposit</button>
                    <a className="btn gray sm" href={`https://testnet.arcscan.app/address/${VAULT_ADDRESS}`} target="_blank">Explorer</a>
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
                    <div><small>Contribution</small><strong>{fmt(p.contributionAmount)} USDC</strong></div>
                    <div><small>Cycle</small><strong>{(Number(p.cycleDuration) / 86400).toFixed(0)} days</strong></div>
                    <div><small>Members</small><strong>{p.members.length}/{p.maxMembers.toString()}</strong></div>
                    <div><small>Status</small><strong>{statusLabel(p.status)}</strong></div>
                  </div>
                  <button className="btn green sm" onClick={() => joinPool(p.id)}>Join Pool</button>
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
            <label>Duration (days)</label>
            <select value={goalForm.days} onChange={e => setGoalForm({ ...goalForm, days: e.target.value })}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
            <label>Lock Period (days)</label>
            <select value={goalForm.lock} onChange={e => setGoalForm({ ...goalForm, lock: e.target.value })}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowGoalModal(false)}>Cancel</button>
              <button className="btn orange" onClick={createGoal} disabled={loading}>
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
            <h2>Deposit to "{goals[showDepositModal]?.name}"</h2>
            <label>Amount (USDC)</label>
            <input type="number" placeholder="100" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            <small style={{color:'#666'}}>Your balance: {parseFloat(balance).toFixed(2)} USDC</small>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setShowDepositModal(null)}>Cancel</button>
              <button className="btn orange" onClick={() => depositToGoal(showDepositModal)} disabled={loading}>
                {loading ? 'Depositing...' : 'Deposit'}
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
              <button className="btn green" onClick={createPool} disabled={loading}>
                {loading ? 'Creating...' : 'Create Pool'}
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
