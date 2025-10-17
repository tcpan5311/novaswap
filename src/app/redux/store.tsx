"use client"
import { configureStore} from "@reduxjs/toolkit"
import blockchainReducer from "./blockchain_slice"

export const store = configureStore
({
    reducer: 
    {
        blockchain: blockchainReducer,
    },
    middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware
    ({
        serializableCheck: false,
        immutableCheck: false,   
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
