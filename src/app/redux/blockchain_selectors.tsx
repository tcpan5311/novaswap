import { createSelector } from '@reduxjs/toolkit'
import { RootState } from './store'

export const blockchainSelector = createSelector
(
    (state: RootState) => state.blockchain.account,
    (state: RootState) => state.blockchain.signer,
    (state: RootState) => state.blockchain.isConnected,
    (state: RootState) => state.blockchain.deploymentAddresses,
    (state: RootState) => state.blockchain.contracts,
    (state: RootState) => state.blockchain.positions,
    (state: RootState) => state.blockchain.cryptocurrencies,
    (state: RootState) => state.blockchain.token0Balance,
    (state: RootState) => state.blockchain.token1Balance,

    (account, signer, isConnected, deploymentAddresses, contracts, positions, cryptocurrencies, token0Balance, token1Balance) => 
    ({
        account,
        signer,
        isConnected,
        deploymentAddresses,
        contracts,
        positions,
        cryptocurrencies,
        token0Balance,
        token1Balance
    })
)
