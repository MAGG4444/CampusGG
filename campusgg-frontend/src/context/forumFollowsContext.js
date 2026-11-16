import { createContext, useContext } from 'react'
export const ForumFollowsContext = createContext(null)
export function useForumFollows() { return useContext(ForumFollowsContext) }
