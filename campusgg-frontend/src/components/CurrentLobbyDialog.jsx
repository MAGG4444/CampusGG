import ConfirmationModal from './ConfirmationModal.jsx'

export default function CurrentLobbyDialog({ lobby, onCancel, onView }) {
  return <ConfirmationModal
    title="Already in a lobby"
    message={`You can belong to only one active lobby. Your current lobby is ${lobby.lobbyName}.`}
    confirmLabel="View Current Lobby"
    onCancel={onCancel}
    onConfirm={() => onView(lobby.id)}
  />
}
