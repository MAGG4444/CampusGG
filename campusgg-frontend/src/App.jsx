import './App.css'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import NotificationProvider from './components/notifications/NotificationProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { JoinedLobbiesProvider } from './context/JoinedLobbiesContext.jsx'
import Chat from './pages/Chat.jsx'
import CreateLobby from './pages/CreateLobby.jsx'
import CreatePost from './pages/CreatePost.jsx'
import Drafts from './pages/Drafts.jsx'
import Forum from './pages/Forum.jsx'
import Home from './pages/Home.jsx'
import Lobby from './pages/Lobby.jsx'
import LobbyDetail from './pages/LobbyDetail.jsx'
import PostDetail from './pages/PostDetail.jsx'
import Profile from './pages/Profile.jsx'
import MyContent from './pages/MyContent.jsx'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="/lobby" element={<Lobby />} />
    <Route path="/lobby/:lobbyId" element={<LobbyDetail />} />
    <Route path="/create-lobby" element={<CreateLobby />} />
    <Route path="/forum" element={<Forum />} />
    <Route path="/forum/:postId" element={<PostDetail />} />
    <Route path="/create-post" element={<CreatePost />} />
    <Route path="/chat" element={<Chat />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/my-content" element={<MyContent />} />
    <Route path="/drafts" element={<Drafts />} />
    <Route path="/signin" element={<SignIn />} />
    <Route path="/signup" element={<SignUp />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
  </Route>
))

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <JoinedLobbiesProvider>
          <RouterProvider router={router} />
        </JoinedLobbiesProvider>
      </AuthProvider>
    </NotificationProvider>
  )
}

export default App
