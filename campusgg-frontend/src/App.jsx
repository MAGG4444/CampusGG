import './App.css'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { JoinedLobbiesProvider } from './context/JoinedLobbiesContext.jsx'
import Chat from './pages/Chat.jsx'
import CreateLobby from './pages/CreateLobby.jsx'
import CreatePost from './pages/CreatePost.jsx'
import Forum from './pages/Forum.jsx'
import Home from './pages/Home.jsx'
import Lobby from './pages/Lobby.jsx'
import LobbyDetail from './pages/LobbyDetail.jsx'
import PostDetail from './pages/PostDetail.jsx'
import Profile from './pages/Profile.jsx'

function App() {
  return (
    <JoinedLobbiesProvider>
      <BrowserRouter>
        <Routes>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </JoinedLobbiesProvider>
  )
}

export default App
