import { createContext, useContext } from 'react'
export const ApplicationContext = createContext(null)
export function useApplications() { return useContext(ApplicationContext) }
