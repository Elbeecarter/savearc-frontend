import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

const VAULT_ADDRESS = '0x6eD021481140a6B385dfc45d9c8B4F5D583Da1ab'
const POOL_ADDRESS = '0x1a3729b5ddc9A0FC9d5D21857539bCE460ac91D2'
const EXPLORER = 'https://testnet.arcscan.app'

export default function TransactionHistory({ account }) {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (account) fetchHistory()
  }, [account])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network')

      const vaultABI = [
        'event GoalCreated(address indexed user, uint256 indexed goalId, string name, uint256 targetAmount)',
        'event Deposited(address indexed user, uint256 indexed goalId, uint256 amount, uint256 newBalance)',
        'event Withdrawn(address indexed user, uint256 indexed goalId, uint256 amount, bool isEmergency)',
      ]

      const poolABI = [
        'event PoolCreated(uint256 indexed poolId, address indexed creator, string name, uint256 contributionAmount)',
        'event MemberJoined(uint256 indexed poolId, address indexed member)',
      ]

      const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, provider)
      const pool = new ethers.Contract(POOL_ADDRESS, poolABI, provider)
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 9000)

      const [goalCreated, deposited, withdrawn, poolCreated, memberJoined] = await Promise.all([
        vault.queryFilter(vault.filters.GoalCreated(account), fromBlock),
        vault.queryFilter(vault.filters.Deposited(account), fromBlock),
        vault.queryFilter(vault.filters.Withdrawn(account), fromBlock),
        pool.queryFilter(pool.filters.PoolCreated(null, account), fromBlock),
        pool.queryFilter(pool.filters.MemberJoined(null, account), fromBlock),
      ])

      const all = [
        ...goalCreated.map(e => ({ type: 'Goal Created', icon: '🎯', detail: '"' + e.args.name + '" — Target: ' + ethers.formatUnits(e.args.targetAmount, 6) + ' USDC', hash: e.transactionHash, block: e.blockNumber })),
        ...deposited.map(e => ({ type: 'Deposit', icon: '💰', detail: '+' + ethers.formatUnits(e.args.amount, 6) + ' USDC to goal #' + e.args.goalId, hash: e.transactionHash, block: e.blockNumber })),
        ...withdrawn.map(e => ({ type: e.args.isEmergency ? 'Emergency Withdraw' : 'Withdraw', icon: e.args.isEmergency ? '⚠️' : '📤', detail: '-' + ethers.formatUnits(e.args.amount, 6) + ' USDC from goal #' + e.args.goalId, hash: e.transactionHash, block: e.blockNumber })),
        ...poolCreated.map(e => ({ type: 'Pool Created', icon: '🤝', detail: '"' + e.args.name + '" — ' + ethers.formatUnits(e.args.contributionAmount, 6) + ' USDC/cycle', hash: e.transactionHash, block: e.blockNumber })),
        ...memberJoined.map(e => ({ type: 'Joined Pool', icon: '👥', detail: 'Joined pool #' + e.args.poolId, hash: e.transactionHash, block: e.blockNumber })),
      ]

      all.sort((a, b) => b.block - a.block)
      setTxns(all)
    } catch (e) {
      console.error('History error:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{textAlign:'center',padding:'2rem',color:'#6B7280'}}>Loading history...</div>
  if (txns.length === 0) return <div style={{textAlign:'center',padding:'2rem',color:'#6B7280'}}>No transactions yet</div>

  return (
    <div style={{marginTop:'1rem'}}>
      {txns.map((tx, i) => (
        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.75rem 1rem',background:i%2===0?'#F9FAFB':'white',borderRadius:'8px',marginBottom:'0.5rem',border:'1px solid #E5E7EB'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <span style={{fontSize:'1.5rem'}}>{tx.icon}</span>
            <div>
              <div style={{fontWeight:600,fontSize:'0.9rem'}}>{tx.type}</div>
              <div style={{color:'#6B7280',fontSize:'0.8rem'}}>{tx.detail}</div>
            </div>
          </div>
          <a href={EXPLORER+'/tx/'+tx.hash} target="_blank" rel="noreferrer" style={{fontFamily:'Space Mono',fontSize:'0.75rem',color:'#FF6B35',textDecoration:'none',border:'1px solid #FF6B35',padding:'0.25rem 0.5rem',borderRadius:'4px'}}>
            View
          </a>
        </div>
      ))}
    </div>
  )
}
