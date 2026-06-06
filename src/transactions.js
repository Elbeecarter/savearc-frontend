import { ethers } from 'ethers'
import { switchToArc, ARC_CHAIN_ID } from './utils.js'

const VAULT_ADDRESS = '0x6eD021481140a6B385dfc45d9c8B4F5D583Da1ab'
const POOL_ADDRESS = '0x1a3729b5ddc9A0FC9d5D21857539bCE460ac91D2'
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

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

const RPC = 'https://rpc.testnet.arc.network'
const getProvider = () => new ethers.JsonRpcProvider(RPC)
const getAccount = async () => {
  const accounts = await window.ethereum.request({ method: 'eth_accounts' })
  return accounts[0]
}

const sendTx = async (to, data) => {
  await switchToArc()
  const from = await getAccount()
  const provider = getProvider()
  const feeData = await provider.getFeeData()
  const nonce = await provider.getTransactionCount(from)
  const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei')
  const gasEstimate = await provider.estimateGas({ from, to, data })
  const gasLimit = (gasEstimate * 120n) / 100n

  const tx = {
    from,
    to,
    data,
    chainId: '0x' + ARC_CHAIN_ID.toString(16),
    nonce: '0x' + nonce.toString(16),
    gas: '0x' + gasLimit.toString(16),
    maxFeePerGas: '0x' + gasPrice.toString(16),
    maxPriorityFeePerGas: '0x' + (gasPrice / 10n).toString(16),
  }

  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [tx],
  })

  let receipt = null
  while (!receipt) {
    await new Promise(r => setTimeout(r, 1500))
    receipt = await provider.getTransactionReceipt(txHash)
  }
  return txHash
}

const encodeData = (abi, fn, args) => {
  const iface = new ethers.Interface(abi)
  return iface.encodeFunctionData(fn, args)
}

export const createGoal = async (name, target, days, lock) => {
  const data = encodeData(VAULT_ABI, 'createGoal', [
    name,
    ethers.parseUnits(target, 6),
    Math.floor(Date.now() / 1000) + parseInt(days) * 86400,
    parseInt(lock) * 86400
  ])
  return sendTx(VAULT_ADDRESS, data)
}

export const depositToGoal = async (goalId, amount, account) => {
  const parsedAmount = ethers.parseUnits(amount, 6)
  const provider = getProvider()
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
  const allowance = await usdc.allowance(account, VAULT_ADDRESS)
  if (allowance < parsedAmount) {
    const approveData = encodeData(USDC_ABI, 'approve', [VAULT_ADDRESS, parsedAmount])
    await sendTx(USDC_ADDRESS, approveData)
  }
  const data = encodeData(VAULT_ABI, 'deposit', [goalId, parsedAmount])
  return sendTx(VAULT_ADDRESS, data)
}

export const withdrawFromGoal = async (goalId) => {
  const data = encodeData(VAULT_ABI, 'withdraw', [goalId])
  return sendTx(VAULT_ADDRESS, data)
}

export const emergencyWithdrawFromGoal = async (goalId, amount) => {
  const data = encodeData(VAULT_ABI, 'emergencyWithdraw', [goalId, ethers.parseUnits(amount, 6)])
  return sendTx(VAULT_ADDRESS, data)
}

export const createPool = async (name, contribution, cycle, members) => {
  const data = encodeData(POOL_ABI, 'createPool', [
    name,
    ethers.parseUnits(contribution, 6),
    parseInt(cycle) * 86400,
    parseInt(members)
  ])
  return sendTx(POOL_ADDRESS, data)
}

export const joinPool = async (poolId) => {
  const data = encodeData(POOL_ABI, 'joinPool', [poolId])
  return sendTx(POOL_ADDRESS, data)
}

export const contributeToPool = async (poolId, amount, account) => {
  const parsedAmount = ethers.parseUnits(amount, 6)
  const provider = getProvider()
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider)
  const allowance = await usdc.allowance(account, POOL_ADDRESS)
  if (allowance < parsedAmount) {
    const approveData = encodeData(USDC_ABI, 'approve', [POOL_ADDRESS, parsedAmount])
    await sendTx(USDC_ADDRESS, approveData)
  }
  const data = encodeData(POOL_ABI, 'contribute', [poolId])
  return sendTx(POOL_ADDRESS, data)
}

export const fetchUserGoals = async (address) => {
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, getProvider())
  return await vault.getUserGoals(address)
}

export const fetchPools = async () => {
  const provider = getProvider()
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider)
  const count = await poolContract.poolCount()
  const allPools = []
  for (let i = 0; i < Number(count); i++) {
    try {
      const p = await poolContract.getPool(i)
      allPools.push({
        id: i,
        name: p.name || '',
        creator: p.creator || '',
        contributionAmount: p.contributionAmount || 0n,
        cycleDuration: p.cycleDuration || 0n,
        maxMembers: p.maxMembers || 0n,
        currentCycle: p.currentCycle || 0n,
        startTime: p.startTime || 0n,
        nextCycleTime: p.nextCycleTime || 0n,
        status: p.status || 0n,
        members: Array.isArray(p.members) ? p.members : [],
        currentRecipient: p.currentRecipient || '',
        poolBalance: p.poolBalance || 0n,
      })
    } catch (e) {
      console.error('Error fetching pool', i, e)
    }
  }
  return allPools
}

export const fetchUSDCBalance = async (address) => {
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, getProvider())
  const bal = await usdc.balanceOf(address)
  return ethers.formatUnits(bal, 6)
}
