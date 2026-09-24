import { ethers } from 'ethers'

export const ARC_CHAIN_ID = 5042
export const ARC_HEX = '0x13b2'

export const switchToArc = async () => {
  if (!window.ethereum) throw new Error('No wallet found')
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_HEX }],
    })
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: 5042,
          chainName: 'Arc Mainnet',
     nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
            rpcUrls: ['https://rpc.mainnet.arc.io'],
blockExplorerUrls: ['https://explorer.arc.io'],
        }],
      })
    }
  }
  await new Promise(resolve => setTimeout(resolve, 500))
}

export const getSigner = async () => {
  await switchToArc()
  // Use ethers with explicit network to avoid chain ID mismatch
  const provider = new ethers.BrowserProvider(window.ethereum, 'any')
  const signer = await provider.getSigner()
  return signer
}
