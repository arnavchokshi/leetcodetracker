"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Trophy, Clock, Gift, Crown, Users, Edit, Trash2, History, Copy, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { database } from "@/lib/firebase"
import { ref, onValue, set, update } from "firebase/database"

interface PlayerState {
  isRunning: boolean
  startTime: number | null
  endTime: number | null
  finalTime: number | null
}

interface Player {
  id: string
  name: string
  points: number
}

interface Reward {
  id: string
  name: string
  cost: number
  icon: string
  description: string
}

interface BoughtReward {
  id: string
  rewardId: string
  playerId: string
  playerName: string
  rewardName: string
  rewardIcon: string
  rewardDescription: string
  boughtAt: number
  used: boolean
}

interface Match {
  id: string
  timestamp: number
  problemName: string
  difficulty: "Easy" | "Medium" | "Hard"
  players: {
    [playerId: string]: {
      name: string
      time: number
    }
  }
  winner: string
  winnerName: string
}

interface Room {
  id: string
  name: string
  players: Player[]
  rewards: Reward[]
  matches: Match[]
  playerStates?: { [playerId: string]: PlayerState }
  isRoundReset?: boolean
  createdAt: number
  gameCreator: string | null
  gameStatus: 'waiting' | 'active' | 'finished'
  boughtRewards?: BoughtReward[]
}

const DEFAULT_REWARDS: Reward[] = [
  { id: "dinner", name: "Pick Dinner", cost: 3, icon: "🍽️", description: "Choose what we eat tonight" },
  { id: "massage", name: "Get a Massage", cost: 5, icon: "💆", description: "15-minute shoulder massage" },
  { id: "netflix", name: "Netflix Pick", cost: 2, icon: "📺", description: "Choose the next show/movie" },
  { id: "coffee", name: "Free Coffee", cost: 1, icon: "☕", description: "Other person buys your coffee" },
]

export default function LeetCodeBattle() {
  const [currentView, setCurrentView] = useState<"setup" | "battle">("setup")
  const [room, setRoom] = useState<Room | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [joinCode, setJoinCode] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [roomName, setRoomName] = useState("")

  // Battle state
  const [playerStates, setPlayerStates] = useState<{ [playerId: string]: PlayerState }>({})
  const [winner, setWinner] = useState<{ playerId: string; playerName: string } | null>(null)
  const [showWinner, setShowWinner] = useState(false)
  const [problemName, setProblemName] = useState("")
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium")

  // UI state
  const [showRewards, setShowRewards] = useState(false)
  const [showRewardEditor, setShowRewardEditor] = useState(false)
  const [showBoughtRewards, setShowBoughtRewards] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState("")
  const [isRoundReset, setIsRoundReset] = useState(false)

  // State for player timers
  const [playerTimers, setPlayerTimers] = useState<{ [playerId: string]: number }>({})

  // Firebase state
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Refs to prevent race conditions
  const isUpdatingRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)
  const sessionIdRef = useRef<string>(Date.now().toString())
  const isClearingDataRef = useRef(false)

  // Update sessionId ref when sessionId changes
  useEffect(() => {
    sessionIdRef.current = Date.now().toString()
  }, [])

  // Firebase update function
  const updateFirebase = useCallback((updates: Record<string, unknown>) => {
    if (isUpdatingRef.current) return
    
    isUpdatingRef.current = true
    const now = Date.now()
    
    if (now - lastUpdateRef.current < 50) {
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 50)
      return
    }
    
    lastUpdateRef.current = now
    
    const updatesWithSession = {
      ...updates,
      sessionId: sessionIdRef.current,
      lastUpdate: now
    }
    
    update(ref(database, 'game'), updatesWithSession)
      .then(() => {
        setTimeout(() => {
          isUpdatingRef.current = false
        }, 50)
      })
      .catch((error) => {
        console.error('Firebase update error:', error)
        isUpdatingRef.current = false
        setError('Failed to save changes. Please try again.')
      })
  }, [])

  // Initialize Firebase data if it doesn't exist
  useEffect(() => {
    console.log('Starting Firebase initialization...')
    const gameRef = ref(database, 'game')
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      try {
        if (!snapshot.exists()) {
          // Initialize with default values
          const freshData = {
            room: null,
            sessionId: sessionIdRef.current,
            lastReset: Date.now()
          }
          set(ref(database, 'game'), freshData)
        } else {
      const data = snapshot.val()
          console.log('Firebase data received:', data)
          
          // Check if this is old data from a previous session
          const isOldData = !data.sessionId || data.sessionId !== sessionIdRef.current
          
          if (isOldData && !isClearingDataRef.current) {
            console.log('Detected old Firebase data, preserving data...')
            isClearingDataRef.current = true
            // Preserve room data but update session info
            const preservedData = {
              room: data.room || null,
              sessionId: sessionIdRef.current,
              lastReset: Date.now()
            }
            set(ref(database, 'game'), preservedData).then(() => {
              setTimeout(() => {
                isClearingDataRef.current = false
              }, 100)
            })
            // Don't return early - continue to set loading state
          }
          
          if (data && !isUpdatingRef.current) {
            console.log('Processing Firebase data:', data)
            if (data.room) {
              console.log('Setting room data:', data.room)
              setRoom(data.room)
              setCurrentView("battle")
              
              // Handle round reset from other players
              if (data.room.isRoundReset) {
                console.log('Received round reset from Firebase')
                setPlayerStates({})
                setWinner(null)
                setShowWinner(false)
                setProblemName("")
                setDifficulty("Medium")
                setPlayerTimers({})
                setIsRoundReset(true)
                setRedeemMessage("")
              }
              
              // Sync player states from Firebase
              if (data.room.playerStates) {
                setPlayerStates(data.room.playerStates)
                
                // Also sync player timers based on the states
                const newTimers = { ...playerTimers }
                for (const player of data.room.players) {
                  const playerState = data.room.playerStates[player.id]
                  if (playerState?.isRunning && playerState.startTime) {
                    newTimers[player.id] = Date.now() - playerState.startTime
                  } else {
                    newTimers[player.id] = 0
                  }
                }
                setPlayerTimers(newTimers)
              }
              
              // Restore current player if available
              const savedPlayerId = localStorage.getItem("current-player-id")
              if (savedPlayerId) {
                const player = data.room.players.find((p: Player) => p.id === savedPlayerId)
                if (player) {
                  setCurrentPlayer(player)
                }
              }
            } else {
              console.log('No room data found in Firebase')
            }
          }
        }
        console.log('Firebase initialization completed successfully')
        setIsInitialized(true)
        setIsLoading(false)
        setError(null)
      } catch (err) {
        console.error('Firebase initialization error:', err)
        setError('Failed to connect to database. Please refresh the page.')
        setIsLoading(false)
      }
    }, (error) => {
      console.error('Firebase connection error:', error)
      setError('Connection error. Please check your internet connection.')
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Check for winner when all players have finished
  useEffect(() => {
    if (!room || showWinner || room.players.length < 2) return

    const finishedPlayers = room.players.filter((player) => {
      const playerState = playerStates[player.id]
      const hasFinished = playerState && playerState.finalTime !== null && playerState.finalTime > 0 && !playerState.isRunning
      console.log(`Player ${player.name}: finalTime=${playerState?.finalTime}, isRunning=${playerState?.isRunning}, hasFinished=${hasFinished}`)
      return hasFinished
    })

    console.log('Finished players:', finishedPlayers.length, 'Total players:', room.players.length)
    console.log('Player states:', playerStates)

    if (finishedPlayers.length === room.players.length && finishedPlayers.length >= 2) {
      const winner = finishedPlayers.reduce((fastest, current) =>
        (playerStates[current.id]?.finalTime || Number.POSITIVE_INFINITY) <
        (playerStates[fastest.id]?.finalTime || Number.POSITIVE_INFINITY)
          ? current
          : fastest,
      )

      console.log('Winner determined:', winner.name, 'with time:', playerStates[winner.id]?.finalTime)
      setWinner({ playerId: winner.id, playerName: winner.name })
      setShowWinner(true)

      // Update points
      setRoom((prev) =>
        prev
          ? {
        ...prev,
              players: (prev.players || []).map((p) => (p.id === winner.id ? { ...p, points: p.points + 1 } : p)),
            }
          : null,
      )
      
      // Update Firebase
      updateFirebase({ room: room })
    }
  }, [playerStates, room, showWinner, updateFirebase])

  // Update player timers
  useEffect(() => {
    if (!room) return

    const interval = setInterval(() => {
      const newTimers = { ...playerTimers }
      let hasChanges = false
      
      for (const player of room.players) {
        const playerState = playerStates[player.id]
        if (playerState?.isRunning && playerState.startTime) {
          const newTime = Date.now() - playerState.startTime
          if (newTimers[player.id] !== newTime) {
            newTimers[player.id] = newTime
            hasChanges = true
          }
        } else if (newTimers[player.id] !== 0) {
          newTimers[player.id] = 0
          hasChanges = true
        }
      }
      
      if (hasChanges) {
        setPlayerTimers(newTimers)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [room, playerStates])

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = () => {
    if (!playerName.trim() || !roomName.trim()) return

    const playerId = Math.random().toString(36).substring(2, 15)
    const roomId = generateRoomCode()

    const newPlayer: Player = {
      id: playerId,
      name: playerName.trim(),
      points: 0,
    }

    const newRoom: Room = {
      id: roomId,
      name: roomName.trim(),
      players: [newPlayer],
      rewards: [...DEFAULT_REWARDS],
      matches: [],
      boughtRewards: [],
      createdAt: Date.now(),
      gameCreator: sessionIdRef.current,
      gameStatus: 'waiting',
    }

    setRoom(newRoom)
    setCurrentPlayer(newPlayer)
    localStorage.setItem("current-player-id", playerId)
    setCurrentView("battle")

    // Update Firebase
    updateFirebase({ room: newRoom })
  }

  const joinRoom = () => {
    if (!playerName.trim() || !joinCode.trim()) return

    console.log('Joining room with code:', joinCode)
    
    // Create a new player for joining
    const playerId = Math.random().toString(36).substring(2, 15)
    const newPlayer: Player = {
      id: playerId,
      name: playerName.trim(),
      points: 0,
    }

    // Check if we're already in a room with this code
    if (room && room.id === joinCode.toUpperCase()) {
      // We're already in this room, just add the new player
      const updatedRoom = {
        ...room,
        players: [...(room.players || []), newPlayer]
      }
      
      setRoom(updatedRoom)
      setCurrentPlayer(newPlayer)
      localStorage.setItem("current-player-id", playerId)
      setCurrentView("battle")
      setError(null)

      // Update Firebase
      updateFirebase({ room: updatedRoom })
    } else {
      // Try to join existing room by updating Firebase with new player
      // First, let's check if there's an existing room in Firebase
      const gameRef = ref(database, 'game')
      
      // Get current Firebase data
      onValue(gameRef, (snapshot) => {
        const data = snapshot.val()
        if (data && data.room && data.room.id === joinCode.toUpperCase()) {
          // Join existing room
          const existingRoom = data.room
          const updatedRoom = {
            ...existingRoom,
            players: [...(existingRoom.players || []), newPlayer]
          }
          
          setRoom(updatedRoom)
          setCurrentPlayer(newPlayer)
          localStorage.setItem("current-player-id", playerId)
          setCurrentView("battle")
          setError(null)

          // Update Firebase
          updateFirebase({ room: updatedRoom })
        } else {
          // Create new room
          const newRoom: Room = {
            id: joinCode.toUpperCase(),
            name: `Room ${joinCode.toUpperCase()}`,
            players: [newPlayer],
            rewards: [...DEFAULT_REWARDS],
            matches: [],
            boughtRewards: [],
            createdAt: Date.now(),
            gameCreator: sessionIdRef.current,
            gameStatus: 'waiting',
          }

          setRoom(newRoom)
          setCurrentPlayer(newPlayer)
          localStorage.setItem("current-player-id", playerId)
          setCurrentView("battle")
          setError(null)

          // Update Firebase
          updateFirebase({ room: newRoom })
        }
      }, { onlyOnce: true })
    }
  }

  const startTimer = (playerId: string) => {
    const newPlayerStates = {
      ...playerStates,
      [playerId]: {
        ...playerStates[playerId],
        isRunning: true,
        startTime: Date.now(),
        endTime: null,
        finalTime: null,
      },
    }
    
    setPlayerStates(newPlayerStates)
    setIsRoundReset(false)
    
    // Update Firebase with timer state
    if (room) {
      const updatedRoom = {
        ...room,
        playerStates: newPlayerStates,
        isRoundReset: false
      }
      updateFirebase({ room: updatedRoom })
    }
  }

  const stopTimer = (playerId: string) => {
    const endTime = Date.now()
    const playerState = playerStates[playerId]
    if (!playerState?.startTime) return

    const finalTime = endTime - playerState.startTime
    const newPlayerStates = {
      ...playerStates,
      [playerId]: {
        ...playerState,
        isRunning: false,
        endTime,
        finalTime,
      },
    }
    
    setPlayerStates(newPlayerStates)
    
    // Update Firebase with timer state
    if (room) {
      const updatedRoom = {
        ...room,
        playerStates: newPlayerStates
      }
      updateFirebase({ room: updatedRoom })
    }
  }

  const saveMatch = () => {
    if (!room || !winner || !problemName.trim()) return

    const match: Match = {
      id: Math.random().toString(36).substring(2, 15),
      timestamp: Date.now(),
      problemName: problemName.trim(),
      difficulty,
      players: Object.fromEntries(
        room.players.map((player) => [
          player.id,
          {
            name: player.name,
            time: playerStates[player.id]?.finalTime || 0,
          },
        ]),
      ),
      winner: winner.playerId,
      winnerName: winner.playerName,
    }

    setRoom((prev) =>
      prev
        ? {
      ...prev,
            matches: [match, ...(prev.matches || [])],
          }
        : null,
    )
    
    // Update Firebase
    updateFirebase({ room: room })

    resetRound()
  }

  const resetRound = () => {
    console.log('Resetting round locally')
    const emptyPlayerStates = {}
    setPlayerStates(emptyPlayerStates)
    setWinner(null)
    setShowWinner(false)
    setProblemName("")
    setDifficulty("Medium")
    setPlayerTimers({})
    setIsRoundReset(true)
    setRedeemMessage("")
    
    // Update Firebase with reset state - bypass the update lock for reset
    if (room) {
      const updatedRoom = {
        ...room,
        playerStates: emptyPlayerStates,
        isRoundReset: true
      }
      console.log('Sending reset to Firebase:', updatedRoom)
      
      // Force update for reset
      const now = Date.now()
      const updatesWithSession = {
        room: updatedRoom,
        sessionId: sessionIdRef.current,
        lastUpdate: now
      }
      
      set(ref(database, 'game'), updatesWithSession)
        .then(() => {
          console.log('Reset sent to Firebase successfully')
        })
        .catch((error) => {
          console.error('Firebase reset error:', error)
          setError('Failed to reset round. Please try again.')
        })
    }
  }

  const addReward = (reward: Omit<Reward, "id">) => {
    const newReward = { ...reward, id: Math.random().toString(36).substring(2, 15) }
    setRoom((prev) => {
      if (prev) {
        const newRoom = {
      ...prev,
          rewards: [...(prev.rewards || []), newReward],
        }
    // Update Firebase
        updateFirebase({ room: newRoom })
        return newRoom
      }
      return null
    })
  }

  const updateReward = (rewardId: string, updatedReward: Omit<Reward, "id">) => {
    setRoom((prev) => {
      if (prev) {
        const newRoom = {
          ...prev,
          rewards: (prev.rewards || []).map((r) => (r.id === rewardId ? { ...updatedReward, id: rewardId } : r)),
        }
        // Update Firebase
        updateFirebase({ room: newRoom })
        return newRoom
      }
      return null
    })
  }

  const deleteReward = (rewardId: string) => {
    setRoom((prev) => {
      if (prev) {
        const newRoom = {
          ...prev,
          rewards: (prev.rewards || []).filter((r) => r.id !== rewardId),
        }
        // Update Firebase
        updateFirebase({ room: newRoom })
        return newRoom
      }
      return null
    })
  }

  const redeemReward = (reward: Reward, playerId: string) => {
    const player = room?.players.find((p) => p.id === playerId)
    if (!player || player.points < reward.cost) return

    setRoom((prev) => {
      if (prev) {
        const newRoom = {
        ...prev,
          players: (prev.players || []).map((p) => (p.id === playerId ? { ...p, points: p.points - reward.cost } : p)),
          boughtRewards: [...(prev.boughtRewards || []), {
            id: Math.random().toString(36).substring(2, 15),
            rewardId: reward.id,
            playerId: playerId,
            playerName: player.name,
            rewardName: reward.name,
            rewardIcon: reward.icon,
            rewardDescription: reward.description,
            boughtAt: Date.now(),
            used: false
          }]
        }
      // Update Firebase
        updateFirebase({ room: newRoom })
        return newRoom
      }
      return null
    })

    setRedeemMessage(`${player.name} redeemed: ${reward.name}!`)
      setTimeout(() => setRedeemMessage(""), 3000)
  }

  const markRewardAsUsed = (boughtRewardId: string) => {
    setRoom((prev) => {
      if (prev) {
        const newRoom = {
          ...prev,
          boughtRewards: (prev.boughtRewards || []).filter((br) => br.id !== boughtRewardId)
        }
        // Update Firebase
        updateFirebase({ room: newRoom })
        return newRoom
      }
      return null
    })
  }

  const formatTime = (ms: number | null) => {
    if (!ms) return "00:00"
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const copyJoinCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.id)
      setError('Join code copied to clipboard!')
      setTimeout(() => setError(null), 2000)
    }
  }

  const leaveRoom = () => {
    localStorage.removeItem("current-room-id")
    localStorage.removeItem("current-player-id")
    setRoom(null)
    setCurrentPlayer(null)
    setCurrentView("setup")
  }

  // Debug logging
  console.log('Component state:', {
    isInitialized,
    isLoading,
    error,
    currentView,
    room: room ? 'exists' : 'null',
    currentPlayer: currentPlayer ? 'exists' : 'null'
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-muted-foreground">Connecting to game...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-red-500 text-4xl">⚠️</div>
              <h2 className="text-xl font-semibold text-red-700">Connection Error</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Setup View
  if (currentView === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4">
        <div className="max-w-md mx-auto space-y-6 pt-20">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
              LeetCode Battle
            </h1>
            <p className="text-muted-foreground">Create or join a coding battle room</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Join Battle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="playerName">Your Name</Label>
                <Input
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomName">Room Name</Label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter room name"
                  />
                </div>
                <Button onClick={createRoom} className="w-full" disabled={!playerName.trim() || !roomName.trim()}>
                  Create Room
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="joinCode">Join Code</Label>
                  <Input
                    id="joinCode"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
                <Button onClick={joinRoom} className="w-full" disabled={!playerName.trim() || !joinCode.trim()}>
                  Join Room
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Battle View
  if (currentView === "battle" && room && currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
                {room.name}
              </h1>
              <p className="text-muted-foreground">
                Room Code: <span className="font-mono font-bold">{room.id}</span>
                <Button variant="ghost" size="sm" onClick={copyJoinCode} className="ml-2">
                  <Copy className="w-4 h-4" />
                </Button>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={leaveRoom}>
                Leave Room
              </Button>
            </div>
          </div>

          {/* Problem Input */}
          {!showWinner && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="problemName">LeetCode Problem</Label>
                    <Input
                      id="problemName"
                      value={problemName}
                      onChange={(e) => setProblemName(e.target.value)}
                      placeholder="e.g., Two Sum, Valid Parentheses"
                    />
                  </div>
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <select
                      id="difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                      className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Winner Announcement */}
          {showWinner && winner && !isRoundReset && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
                  <h2 className="text-2xl font-bold text-yellow-700">🎉 {winner.playerName} Wins! 🎉</h2>
                  <p className="text-yellow-600">
                    Problem: {problemName} ({difficulty})
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={saveMatch} disabled={!problemName.trim()}>
                      Save Match
                    </Button>
                    <Button onClick={resetRound} variant="outline">
                      Skip Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Player Timers */}
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${room.players.length}, 1fr)` }}>
            {room.players.map((player) => {
              const playerState = playerStates[player.id] || {
                isRunning: false,
                startTime: null,
                endTime: null,
                finalTime: null,
              }
              const currentTime = playerTimers[player.id] || 0
              const displayTime = playerState.finalTime || currentTime
              const isCurrentPlayer = player.id === currentPlayer.id

              return (
                <Card
                  key={player.id}
                  className={`relative overflow-hidden ${playerState.isRunning ? "ring-2 ring-blue-500" : ""} ${isCurrentPlayer ? "border-2 border-blue-300" : ""}`}
                >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
                      <Crown className={`w-5 h-5 text-blue-500`} />
                      {player.name} {isCurrentPlayer && "(You)"}
          </CardTitle>
          <CardDescription>
                      Points: <Badge variant="secondary">{player.points}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div
              className={`text-4xl font-mono font-bold ${playerState.isRunning ? "text-blue-600" : "text-gray-700"}`}
            >
              {formatTime(displayTime)}
            </div>
            {playerState.finalTime && (
              <div className="text-sm text-muted-foreground mt-1">
                Final: {(playerState.finalTime / 1000).toFixed(2)}s
              </div>
            )}
          </div>
                    {isCurrentPlayer && (
          <div className="flex gap-2">
            <Button
                          onClick={() => startTimer(player.id)}
                          disabled={playerState.isRunning || playerState.finalTime !== null}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
                          Start
            </Button>
            <Button
                          onClick={() => stopTimer(player.id)}
                          disabled={!playerState.isRunning}
              variant="outline"
              className="flex-1"
            >
                          Stop
            </Button>
          </div>
                    )}
                    {!isCurrentPlayer && (
                      <div className="text-center text-sm text-muted-foreground">
                        {playerState.isRunning ? "Solving..." : playerState.finalTime ? "Finished" : "Waiting..."}
                      </div>
                    )}
        </CardContent>
      </Card>
    )
            })}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <Button onClick={resetRound} variant="outline">
            Reset Round
          </Button>
          <Button onClick={() => setShowRewards(true)} variant="secondary">
            <Gift className="w-4 h-4 mr-2" />
            Reward Store
          </Button>
          <Button onClick={() => setShowBoughtRewards(true)} variant="outline">
            <History className="w-4 h-4 mr-2" />
            My Rewards
          </Button>
        </div>

        {/* Redeem Message */}
        {redeemMessage && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-center text-green-700 font-medium">{redeemMessage}</p>
            </CardContent>
          </Card>
        )}

          {/* Match History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Match History
              </CardTitle>
              <CardDescription>{room.matches?.length || 0} matches played</CardDescription>
            </CardHeader>
            <CardContent>
              {!room.matches || room.matches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No matches played yet. Start your first battle!
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {(room.matches || []).slice(0, 10).map((match) => (
                    <Card key={match.id} className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{match.problemName}</h3>
                            <Badge
                              variant={
                                match.difficulty === "Easy"
                                  ? "secondary"
                                  : match.difficulty === "Medium"
                                    ? "default"
                                    : "destructive"
                              }
                              className="mt-1"
                            >
                              {match.difficulty}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {new Date(match.timestamp).toLocaleDateString()} at{" "}
                              {new Date(match.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-2">
                              <Trophy className="w-4 h-4 text-yellow-500" />
                              <span className="font-semibold text-sm">{match.winnerName}</span>
                            </div>
                            <div className="text-xs space-y-1">
                              {Object.entries(match.players).map(([playerId, playerData]) => (
                                <div key={playerId} className={playerId === match.winner ? "font-semibold" : ""}>
                                  {playerData.name}: {(playerData.time / 1000).toFixed(2)}s
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(room.matches || []).length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                                              Showing latest 10 matches of {(room.matches || []).length} total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reward Store Dialog */}
        <Dialog open={showRewards} onOpenChange={setShowRewards}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Reward Store
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRewardEditor(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Rewards
                </Button>
              </DialogTitle>
              <DialogDescription>Redeem your hard-earned points for awesome rewards!</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              {(room.rewards || []).map((reward) => (
                <Card key={reward.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{reward.icon}</span>
                        <div>
                          <h3 className="font-semibold">{reward.name}</h3>
                          <p className="text-sm text-muted-foreground">{reward.description}</p>
                          <Badge variant="outline" className="mt-1">
                            {reward.cost} points
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {room.players.map((player) => (
                        <Button
                            key={player.id}
                          size="sm"
                            onClick={() => redeemReward(reward, player.id)}
                            disabled={player.points < reward.cost}
                            variant="outline"
                          >
                            {player.name} ({player.points})
                        </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reward Editor Dialog */}
        <RewardEditor
          open={showRewardEditor}
          onOpenChange={setShowRewardEditor}
          rewards={room.rewards || []}
          onAddReward={addReward}
          onUpdateReward={updateReward}
          onDeleteReward={deleteReward}
        />

        {/* Bought Rewards Dialog */}
        <Dialog open={showBoughtRewards} onOpenChange={setShowBoughtRewards}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                My Bought Rewards
              </DialogTitle>
              <DialogDescription>View and manage your purchased rewards</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              {!room.boughtRewards || room.boughtRewards.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-3">
                      <Gift className="w-12 h-12 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">No rewards purchased yet.</p>
                      <p className="text-sm text-muted-foreground">Buy some rewards from the store to see them here!</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                room.boughtRewards.map((boughtReward) => (
                  <Card key={boughtReward.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{boughtReward.rewardIcon}</span>
                          <div>
                            <h3 className="font-semibold">{boughtReward.rewardName}</h3>
                            <p className="text-sm text-muted-foreground">{boughtReward.rewardDescription}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">
                                Bought by {boughtReward.playerName}
                              </Badge>
                              <Badge variant="secondary">
                                {new Date(boughtReward.boughtAt).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => markRewardAsUsed(boughtReward.id)}
                          variant="destructive"
                        >
                          Used
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Fallback - show setup view if nothing else is rendered
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4">
      <div className="max-w-md mx-auto space-y-6 pt-20">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
            LeetCode Battle
          </h1>
          <p className="text-muted-foreground">Create or join a coding battle room</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Join Battle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="playerName">Your Name</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name"
                />
              </div>
              <Button onClick={createRoom} className="w-full" disabled={!playerName.trim() || !roomName.trim()}>
                Create Room
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="joinCode">Join Code</Label>
                <Input
                  id="joinCode"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>
              <Button onClick={joinRoom} className="w-full" disabled={!playerName.trim() || !joinCode.trim()}>
                Join Room
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Reward Editor Component
function RewardEditor({
  open,
  onOpenChange,
  rewards,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rewards: Reward[]
  onAddReward: (reward: Omit<Reward, "id">) => void
  onUpdateReward: (id: string, reward: Omit<Reward, "id">) => void
  onDeleteReward: (id: string) => void
}) {
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [newReward, setNewReward] = useState({ name: "", cost: 1, icon: "🎁", description: "" })

  const handleSave = () => {
    if (editingReward) {
      onUpdateReward(editingReward.id, {
        name: newReward.name,
        cost: newReward.cost,
        icon: newReward.icon,
        description: newReward.description,
      })
    } else {
      onAddReward(newReward)
    }
    setNewReward({ name: "", cost: 1, icon: "🎁", description: "" })
    setEditingReward(null)
  }

  const startEdit = (reward: Reward) => {
    setEditingReward(reward)
    setNewReward({
      name: reward.name,
      cost: reward.cost,
      icon: reward.icon,
      description: reward.description,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Rewards</DialogTitle>
          <DialogDescription>Add, edit, or remove custom rewards for your room.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>{editingReward ? "Edit Reward" : "Add New Reward"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rewardName">Name</Label>
                  <Input
                    id="rewardName"
                    value={newReward.name}
                    onChange={(e) => setNewReward((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Reward name"
                  />
                </div>
                <div>
                  <Label htmlFor="rewardCost">Cost (points)</Label>
                  <Input
                    id="rewardCost"
                    type="number"
                    min="1"
                    value={newReward.cost}
                    onChange={(e) => setNewReward((prev) => ({ ...prev, cost: Number.parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="rewardIcon">Icon (emoji)</Label>
                <Input
                  id="rewardIcon"
                  value={newReward.icon}
                  onChange={(e) => setNewReward((prev) => ({ ...prev, icon: e.target.value }))}
                  placeholder="🎁"
                  maxLength={2}
                />
              </div>
              <div>
                <Label htmlFor="rewardDescription">Description</Label>
                <Textarea
                  id="rewardDescription"
                  value={newReward.description}
                  onChange={(e) => setNewReward((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this reward..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!newReward.name.trim()}>
                  {editingReward ? "Update" : "Add"} Reward
                </Button>
                {editingReward && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingReward(null)
                      setNewReward({ name: "", cost: 1, icon: "🎁", description: "" })
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Existing Rewards */}
          <div className="space-y-2">
            <h3 className="font-semibold">Current Rewards</h3>
            {rewards.map((reward) => (
              <Card key={reward.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{reward.icon}</span>
                      <div>
                        <h4 className="font-medium">{reward.name}</h4>
                        <p className="text-sm text-muted-foreground">{reward.description}</p>
                        <Badge variant="outline" className="mt-1">
                          {reward.cost} points
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(reward)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDeleteReward(reward.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 