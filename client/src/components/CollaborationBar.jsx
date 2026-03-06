import { useState, useEffect } from 'react'

export default function CollaborationBar({ provider, user }) {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('disconnected')

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness

    // Update connection status
    const updateStatus = () => {
      if (provider.wsconnected) {
        setStatus('connected')
      } else if (provider.wsconnecting) {
        setStatus('connecting')
      } else {
        setStatus('disconnected')
      }
    }

    // Update users list when awareness changes
    const updateUsers = () => {
      const states = Array.from(awareness.getStates().values())
      const uniqueUsers = states
        .filter(state => state.user)
        .reduce((acc, state) => {
          // Deduplicate by clientId or user name
          const key = state.user.name
          if (!acc.find(u => u.name === key)) {
            acc.push(state.user)
          }
          return acc
        }, [])
      
      setUsers(uniqueUsers)
    }

    // Set current user
    if (user) {
      awareness.setLocalStateField('user', user)
    }

    // Listen to events
    provider.on('status', updateStatus)
    awareness.on('change', updateUsers)

    // Initial update
    updateStatus()
    updateUsers()

    // Cleanup
    return () => {
      provider.off('status', updateStatus)
      awareness.off('change', updateUsers)
    }
  }, [provider, user])

  if (!provider) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-green-500 animate-pulse' :
          status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
          'bg-red-500'
        }`} />
        <span className="text-xs text-zinc-400">
          {status === 'connected' ? 'Conectado' :
           status === 'connecting' ? 'Conectando...' :
           'Desconectado'}
        </span>
      </div>

      {/* Users online */}
      {users.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">•</span>
          <div className="flex items-center gap-1">
            {users.slice(0, 5).map((user, idx) => (
              <div
                key={idx}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-zinc-900"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.name ? user.name[0].toUpperCase() : '?'}
              </div>
            ))}
            {users.length > 5 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-zinc-700 text-zinc-300 border-2 border-zinc-900">
                +{users.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-zinc-400">
            {users.length} {users.length === 1 ? 'pessoa' : 'pessoas'} editando
          </span>
        </div>
      )}
    </div>
  )
}
