export default function CollaborationBar({ connected, collaborators }) {
  const count = collaborators?.length || 0

  return (
    <div className="flex items-center gap-2 sm:gap-2">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full ${
          connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
        }`} />
        <span className="text-sm sm:text-xs text-shade">
          {connected ? 'live' : 'offline'}
        </span>
      </div>

      {/* User count */}
      {connected && count > 0 && (
        <div className="flex items-center gap-1">
          {/* User avatars - hidden on mobile */}
          <div className="hidden sm:flex -space-x-1.5">
            {collaborators.slice(0, 3).map((user, i) => (
              <div
                key={user.id || i}
                className="w-5 h-5 rounded-full border border-void text-[9px] flex items-center justify-center font-medium text-void"
                style={{ backgroundColor: user.color || '#958DF1' }}
                title={user.name || `User ${i + 1}`}
              >
                {(user.name || 'U')[0].toUpperCase()}
              </div>
            ))}
            {count > 3 && (
              <div className="w-5 h-5 rounded-full border border-void bg-glyph text-[9px] flex items-center justify-center font-medium text-void">
                +{count - 3}
              </div>
            )}
          </div>
          <span className="text-sm sm:text-xs text-shade sm:ml-0.5">
            {count} <span className="sm:hidden">online</span>
          </span>
        </div>
      )}
    </div>
  )
}
