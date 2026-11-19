import { createContext, useContext } from 'react'
export const ForumChannelsContext = createContext(null)
export const useForumChannels = () => useContext(ForumChannelsContext)
