import { io, Socket } from 'socket.io-client'
import { WS_URL } from './constants'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('accessToken')

    socket = io(WS_URL, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token },
      autoConnect: false,
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
    })

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
    })
  }

  return socket
}

export function connectSocket(): void {
  const s = getSocket()
  // Update auth token before connecting
  s.auth = { token: localStorage.getItem('accessToken') }
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}

export function resetSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
