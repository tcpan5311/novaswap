"use client"
import { configureStore } from "@reduxjs/toolkit"
import blockchainReducer from "./blockchain_slice"
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux"

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

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
