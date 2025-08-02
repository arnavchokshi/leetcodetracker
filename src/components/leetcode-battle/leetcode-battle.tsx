"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Trophy,
  Clock,
  Gift,
  Crown,
  Users,
  History,
  Copy,
  Settings,
  Zap,
  Star,
  Target,
  Sparkles,
  Save,
  SkipForward,
  Flame,
  CheckCircle,
  RotateCcw,
  BarChart3,
  Swords,
  Calendar,
  Coins,
  Gem,
  Edit,
  Trash2,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Info,
  X,
  Plus,
  Minus,
  Play,
  RefreshCw,
  TrendingUp,
  Award,
  Heart,
  Shield,
  Eye,
  EyeOff,
  Share2,
  Download,
  Upload,
  Filter,
  Search,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Home,
  LogOut,
  User,
  Users2,
  Timer,
  StopCircle,
  PlayCircle,
  PauseCircle,
  SkipBack,
  FastForward,
  Rewind,
  Volume1,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Signal,
  Battery,
  BatteryCharging,
  Sun,
  Moon,
  Palette,
  Music,
  Gamepad2,
  Medal,
  Rainbow,
  Sparkle,
  Wand,
  Book,
  Scroll,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface PlayerStats {
  totalMatches: number
  wins: number
  losses: number
  averageTime: number
  bestTime: number
  totalPoints: number
  streak: number
  achievements: Achievement[]
  lastActive: number
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt: number
  rarity: "common" | "rare" | "epic" | "legendary"
}

interface GameSettings {
  soundEnabled: boolean
  notificationsEnabled: boolean
  darkMode: boolean
  showTutorial: boolean
  keyboardShortcuts: boolean
  problemSuggestions: boolean
  countdownEnabled: boolean
  countdownDuration: number
  maxPlayers: number
  timeLimit: number
  difficultyFilter: ("Easy" | "Medium" | "Hard")[]
}

interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info" | "warning"
  duration: number
  timestamp: number
}

interface KeyboardShortcut {
  key: string
  description: string
  action: () => void
  category: "game" | "ui" | "navigation"
}

interface ProblemSuggestion {
  name: string
  difficulty: "Easy" | "Medium" | "Hard"
  category: string
  description: string
  leetcodeUrl: string
}

const DEFAULT_REWARDS: Reward[] = [
  { id: "dinner", name: "Pick Dinner", cost: 3, icon: "🍽️", description: "Choose what we eat tonight" },
  { id: "massage", name: "Get a Massage", cost: 5, icon: "💆", description: "15-minute shoulder massage" },
  { id: "netflix", name: "Netflix Pick", cost: 2, icon: "📺", description: "Choose the next show/movie" },
  { id: "coffee", name: "Free Coffee", cost: 1, icon: "☕", description: "Other person buys your coffee" },
]

const PLAYER_COLORS = [
  "from-blue-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-green-500 to-emerald-600",
  "from-orange-500 to-red-600",
  "from-indigo-500 to-blue-600",
  "from-purple-500 to-pink-600",
]

const DIFFICULTY_COLORS = {
  Easy: "from-green-400 to-green-600",
  Medium: "from-yellow-400 to-orange-500",
  Hard: "from-red-400 to-red-600",
}

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

  // Enhanced UI state
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [autoSave, setAutoSave] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("info")
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [selectedProblem, setSelectedProblem] = useState<ProblemSuggestion | null>(null)
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdownTime, setCountdownTime] = useState(3)
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [showPlayerStats, setShowPlayerStats] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [showMatchDetails, setShowMatchDetails] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [showExportData, setShowExportData] = useState(false)
  const [showImportData, setShowImportData] = useState(false)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [showInvitePlayers, setShowInvitePlayers] = useState(false)
  const [showKickPlayer, setShowKickPlayer] = useState(false)
  const [playerToKick, setPlayerToKick] = useState<string | null>(null)
  const [showTransferOwnership, setShowTransferOwnership] = useState(false)
  const [newOwner, setNewOwner] = useState<string | null>(null)
  const [showDeleteRoom, setShowDeleteRoom] = useState(false)
  const [showConfirmAction, setShowConfirmAction] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
  } | null>(null)

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

  // Utility functions for enhanced features
  const playSound = (soundType: "start" | "stop" | "win" | "lose" | "notification" | "click") => {
    if (!soundEnabled) return
    
    if (typeof window !== "undefined" && window.AudioContext) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      const frequencies = {
        start: 800,
        stop: 400,
        win: [523, 659, 784, 1047], // C major chord
        lose: [200, 150],
        notification: 600,
        click: 300
      }
      
      const frequency = frequencies[soundType]
      const duration = soundType === "win" ? 0.5 : 0.1
      
      if (Array.isArray(frequency)) {
        frequency.forEach((freq, index) => {
          setTimeout(() => {
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime)
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + duration)
          }, index * 100)
        })
      } else {
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + duration)
      }
    }
  }

  const showNotification = (title: string, body: string, icon?: string) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon })
    }
  }

  const displayToast = (message: string, type: "success" | "error" | "info" | "warning" = "info", duration: number = 3000) => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), duration)
  }

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        displayToast("Notifications enabled!", "success")
      }
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      displayToast("Copied to clipboard!", "success")
    } catch (err) {
      displayToast("Failed to copy to clipboard", "error")
    }
  }

  const exportRoomData = () => {
    if (!room) return
    
    const data = {
      room,
      exportDate: new Date().toISOString(),
      version: "1.0.0"
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leetcode-battle-${room.id}-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    displayToast("Room data exported!", "success")
  }

  const importRoomData = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.room && data.version) {
          setRoom(data.room)
          displayToast("Room data imported successfully!", "success")
        } else {
          displayToast("Invalid file format", "error")
        }
      } catch (err) {
        displayToast("Failed to import room data", "error")
      }
    }
    reader.readAsText(file)
  }

  const calculatePlayerStats = (playerId: string): PlayerStats => {
    if (!room) return {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      averageTime: 0,
      bestTime: 0,
      totalPoints: 0,
      streak: 0,
      achievements: [],
      lastActive: Date.now()
    }
    
    const playerMatches = room.matches.filter(match => 
      Object.keys(match.players).includes(playerId)
    )
    
    const wins = playerMatches.filter(match => match.winner === playerId).length
    const totalTime = playerMatches.reduce((sum, match) => sum + match.players[playerId]?.time || 0, 0)
    const times = playerMatches.map(match => match.players[playerId]?.time || 0).filter(time => time > 0)
    
    return {
      totalMatches: playerMatches.length,
      wins,
      losses: playerMatches.length - wins,
      averageTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      bestTime: times.length > 0 ? Math.min(...times) : 0,
      totalPoints: room.players.find(p => p.id === playerId)?.points || 0,
      streak: 0, // TODO: Calculate streak
      achievements: [], // TODO: Implement achievements
      lastActive: Date.now()
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return // Don't handle shortcuts when typing in input fields
      }

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          if (currentPlayer && room) {
            const playerState = playerStates[currentPlayer.id]
            if (playerState?.isRunning) {
              stopTimer(currentPlayer.id)
              playSound("stop")
            } else if (!playerState?.finalTime) {
              startTimer(currentPlayer.id)
              playSound("start")
            }
          }
          break
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            resetRound()
            displayToast("Round reset!", "info")
          }
          break
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            if (showWinner && winner) {
              saveMatch()
              displayToast("Match saved!", "success")
            }
          }
          break
        case 'g':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            setShowRewards(true)
          }
          break
        case 'h':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            setShowHelp(true)
          }
          break
        case 'escape':
          setShowRewards(false)
          setShowRewardEditor(false)
          setShowBoughtRewards(false)
          setShowSettings(false)
          setShowHelp(false)
          setShowStats(false)
          setShowLeaderboard(false)
          setShowTutorial(false)
          setShowKeyboardShortcuts(false)
          setShowPauseMenu(false)
          setShowPlayerStats(false)
          setShowMatchDetails(false)
          setShowExportData(false)
          setShowImportData(false)
          setShowRoomSettings(false)
          setShowInvitePlayers(false)
          setShowKickPlayer(false)
          setShowTransferOwnership(false)
          setShowDeleteRoom(false)
          setShowConfirmAction(false)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentPlayer, room, playerStates, showWinner, winner])

  // Enhanced timer functionality with sound effects
  const enhancedStartTimer = (playerId: string) => {
    startTimer(playerId)
    playSound("start")
    showNotification("Timer Started", `${room?.players.find(p => p.id === playerId)?.name} started coding!`, "🏃")
  }

  const enhancedStopTimer = (playerId: string) => {
    stopTimer(playerId)
    playSound("stop")
    const player = room?.players.find(p => p.id === playerId)
    showNotification("Timer Stopped", `${player?.name} finished coding!`, "🏁")
  }

  // Enhanced winner detection with confetti
  useEffect(() => {
    if (showWinner && winner) {
      playSound("win")
      setShowConfetti(true)
      showNotification("Winner!", `${winner.playerName} wins the battle!`, "🏆")
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }, [showWinner, winner])



  // Request notification permission on first load
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission()
    }
  }, [notificationsEnabled])

  // Update sessionId ref when sessionId changes
  useEffect(() => {
    sessionIdRef.current = Date.now().toString()
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
      copyToClipboard(room.id)
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-20"></div>
        <div className="relative max-w-md mx-auto space-y-6 pt-20">
          <div className="text-center space-y-4">
            <div className="relative">
              <h1 className="text-6xl font-black bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-2xl">
                LeetCode
              </h1>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                Battle Arena
              </h2>
              <div className="absolute -top-2 -right-2">
                <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
              </div>
            </div>
            <p className="text-white/90 text-lg font-medium">Create or join a coding battle room</p>
          </div>

          <Card className="backdrop-blur-sm bg-white/95 border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="w-6 h-6" />
                Join the Battle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div>
                <Label htmlFor="playerName" className="text-gray-700 font-semibold">
                  Your Battle Name
                </Label>
                <Input
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your warrior name"
                  className="mt-2 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                />
              </div>

              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-purple-100 to-pink-100">
                  <TabsTrigger
                    value="create"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
                  >
                    Create Room
                  </TabsTrigger>
                  <TabsTrigger
                    value="join"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                  >
                    Join Room
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4 mt-6">
                  <div>
                    <Label htmlFor="roomName" className="text-gray-700 font-semibold">
                      Battle Arena Name
                    </Label>
                    <Input
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter arena name"
                      className="mt-2 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                    />
                  </div>
                  <Button
                    onClick={createRoom}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                    disabled={!playerName.trim() || !roomName.trim()}
                  >
                    <Crown className="w-5 h-5 mr-2" />
                    Create Battle Arena
                  </Button>
                </TabsContent>

                <TabsContent value="join" className="space-y-4 mt-6">
                  <div>
                    <Label htmlFor="joinCode" className="text-gray-700 font-semibold">
                      Arena Code
                    </Label>
                    <Input
                      id="joinCode"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="mt-2 border-2 border-blue-200 focus:border-blue-500 rounded-lg font-mono text-center text-lg"
                    />
                  </div>
                  <Button
                    onClick={joinRoom}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                    disabled={!playerName.trim() || !joinCode.trim()}
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Join Battle
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Battle View
  if (currentView === "battle" && room && currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-20"></div>
        <div className="relative max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
                {room.name}
              </h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-white/80 text-lg">
                  Arena Code: <span className="font-mono font-bold text-yellow-300 text-xl">{room.id}</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(room.id)}
                  className="text-yellow-300 hover:text-yellow-200 hover:bg-white/10"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowHelp(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Info className="w-4 h-4 mr-2" />
                Help
              </Button>
              <Button
                variant="outline"
                onClick={leaveRoom}
                className="bg-red-500/20 border-red-400 text-red-200 hover:bg-red-500/30"
              >
                Leave Arena
              </Button>
            </div>
          </div>

          {/* Problem Input */}
          {!showWinner && (
            <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-sm border-indigo-400/50 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="problemName" className="text-white font-semibold text-lg">
                      LeetCode Problem
                    </Label>
                    <Input
                      id="problemName"
                      value={problemName}
                      onChange={(e) => setProblemName(e.target.value)}
                      placeholder="e.g., Two Sum, Valid Parentheses, Merge Sort"
                      className="mt-2 border-2 border-purple-300 focus:border-purple-500 rounded-lg bg-white/10 text-white placeholder-white/60"
                    />

                  </div>
                  <div>
                    <Label htmlFor="difficulty" className="text-white font-semibold text-lg">
                      Difficulty
                    </Label>
                    <select
                      id="difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                      className="mt-2 border-2 border-purple-300 focus:border-purple-500 rounded-lg bg-white/10 text-white px-3 py-2"
                    >
                      <option value="Easy" className="bg-purple-900 text-white">Easy</option>
                      <option value="Medium" className="bg-purple-900 text-white">Medium</option>
                      <option value="Hard" className="bg-purple-900 text-white">Hard</option>
                    </select>
                  </div>
                  <div className="flex gap-2">

                    <Button
                      onClick={() => setShowCountdown(true)}
                      variant="outline"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    >
                      <Timer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Winner Announcement */}
          {showWinner && winner && !isRoundReset && (
            <Card className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 backdrop-blur-sm border-yellow-400/50 shadow-2xl">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-6">
                  <div className="relative">
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto animate-bounce" />
                    <div className="absolute -top-2 -right-2">
                      <Star className="w-8 h-8 text-yellow-300 animate-spin" />
                    </div>
                  </div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
                    {winner.playerName} WINS!
                  </h2>
                  <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-white text-xl font-semibold">
                      Problem: <span className="text-yellow-300">{problemName}</span>
                    </p>
                    <Badge
                      className={`mt-2 text-white font-bold px-4 py-1 bg-gradient-to-r ${DIFFICULTY_COLORS[difficulty]}`}
                    >
                      {difficulty}
                    </Badge>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={saveMatch}
                      disabled={!problemName.trim()}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                    >
                      <Save className="w-5 h-5 mr-2" />
                      Save Victory
                    </Button>
                    <Button
                      onClick={resetRound}
                      variant="outline"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold px-8 py-3"
                    >
                      <SkipForward className="w-5 h-5 mr-2" />
                      Skip Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Player Timers */}
          <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${room.players.length}, 1fr)` }}>
            {room.players.map((player, index) => {
              const playerState = playerStates[player.id] || {
                isRunning: false,
                startTime: null,
                endTime: null,
                finalTime: null,
              }
              const currentTime = playerTimers[player.id] || 0
              const displayTime = playerState.finalTime || currentTime
              const isCurrentPlayer = player.id === currentPlayer.id
              const colorGradient = PLAYER_COLORS[index % PLAYER_COLORS.length]

              return (
                <Card
                  key={player.id}
                  className={`relative overflow-hidden backdrop-blur-sm border-2 transition-all duration-300 ${
                    playerState.isRunning
                      ? "ring-4 ring-yellow-400 ring-opacity-75 animate-pulse shadow-2xl shadow-yellow-400/25"
                      : "shadow-xl"
                  } ${
                    isCurrentPlayer
                      ? "border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-orange-500/20"
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-10`}></div>
                  <CardHeader className="pb-4 relative z-10">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className={`p-2 rounded-full bg-gradient-to-r ${colorGradient}`}>
                        <Crown className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="text-xl font-bold">{player.name}</div>
                        {isCurrentPlayer && (
                          <div className="text-sm text-yellow-300 font-semibold">
                            <Star className="inline w-4 h-4 mr-1" />
                            YOU
                          </div>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge className={`bg-gradient-to-r ${colorGradient} text-white font-bold px-3 py-1`}>
                        {player.points} points
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 relative z-10">
                    <div className="text-center">
                      <div
                        className={`text-6xl font-mono font-black ${
                          playerState.isRunning
                            ? "text-yellow-300 animate-pulse"
                            : playerState.finalTime
                              ? "text-green-400"
                              : "text-white/70"
                        }`}
                      >
                        {formatTime(displayTime)}
                      </div>
                      {playerState.finalTime && (
                        <div className="text-lg text-green-300 font-semibold mt-2 bg-green-500/20 rounded-lg px-3 py-1 inline-block">
                          <Zap className="inline w-4 h-4 mr-1" />
                          {(playerState.finalTime / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                    {isCurrentPlayer && (
                      <div className="flex gap-3">
                        <Button
                          onClick={() => enhancedStartTimer(player.id)}
                          disabled={playerState.isRunning || playerState.finalTime !== null}
                          className={`flex-1 font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all ${
                            playerState.isRunning ? "bg-gray-500" : `bg-gradient-to-r ${colorGradient} hover:shadow-xl`
                          } text-white`}
                        >
                          <Clock className="w-5 h-5 mr-2" />
                          {playerState.isRunning ? "Running..." : "START"}
                        </Button>
                        <Button
                          onClick={() => enhancedStopTimer(player.id)}
                          disabled={!playerState.isRunning}
                          className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all disabled:opacity-50"
                        >
                          STOP
                        </Button>
                      </div>
                    )}
                    {!isCurrentPlayer && (
                      <div className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-lg px-4 py-2 ${
                            playerState.isRunning
                              ? "border-yellow-400 text-yellow-300 bg-yellow-400/10 animate-pulse"
                              : playerState.finalTime
                                ? "border-green-400 text-green-300 bg-green-400/10"
                                : "border-white/30 text-white/60 bg-white/5"
                          }`}
                        >
                          {playerState.isRunning ? (
                            <>
                              <Flame className="inline w-4 h-4 mr-1" />
                              Coding...
                            </>
                          ) : playerState.finalTime ? (
                            <>
                              <CheckCircle className="inline w-4 h-4 mr-1" />
                              Finished
                            </>
                          ) : (
                            <>
                              <Clock className="inline w-4 h-4 mr-1" />
                              Waiting...
                            </>
                          )}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-6">
            <Button
              onClick={resetRound}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset Round
            </Button>
            <Button
              onClick={() => setShowRewards(true)}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
            >
              <Gift className="w-5 h-5 mr-2" />
              Reward Store
            </Button>
            <Button
              onClick={() => setShowBoughtRewards(true)}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 font-bold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
            >
              <History className="w-5 h-5 mr-2" />
              My Rewards
            </Button>

          </div>

          {/* Redeem Message */}
          {redeemMessage && (
            <Card className="bg-gradient-to-r from-green-400/20 to-emerald-500/20 backdrop-blur-sm border-green-400/50 shadow-xl">
              <CardContent className="pt-6">
                <p className="text-center text-green-200 font-bold text-xl">{redeemMessage}</p>
              </CardContent>
            </Card>
          )}

          {/* Match History */}
          <Card className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border-indigo-400/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-white text-2xl">
                <div className="p-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600">
                  <History className="w-6 h-6 text-white" />
                </div>
                Battle History
              </CardTitle>
              <CardDescription className="text-white/70 text-lg">
                <BarChart3 className="inline w-5 h-5 mr-1" />
                {room.matches?.length || 0} battles fought
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!room.matches || room.matches.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">
                    <Swords className="w-12 h-12 mx-auto" />
                  </div>
                  <p className="text-white/60 text-xl">No battles yet. Time to make history!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {(room.matches || []).slice(0, 10).map((match, index) => (
                    <Card
                      key={match.id}
                      className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all"
                    >
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-white text-lg">{match.problemName}</h3>
                              <Badge
                                className={`font-bold text-white bg-gradient-to-r ${DIFFICULTY_COLORS[match.difficulty]}`}
                              >
                                {match.difficulty}
                              </Badge>
                            </div>
                            <p className="text-white/60 text-sm">
                              <Calendar className="inline w-4 h-4 mr-1" />
                              {new Date(match.timestamp).toLocaleDateString()} at{" "}
                              {new Date(match.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right space-y-2">
                            <div className="flex items-center gap-2 justify-end">
                              <Trophy className="w-5 h-5 text-yellow-400" />
                              <span className="font-bold text-yellow-300 text-lg">{match.winnerName}</span>
                            </div>
                            <div className="space-y-1">
                              {Object.entries(match.players).map(([playerId, playerData]) => (
                                <div
                                  key={playerId}
                                  className={`text-sm ${
                                    playerId === match.winner ? "font-bold text-yellow-300" : "text-white/70"
                                  }`}
                                >
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
                    <p className="text-white/60 text-center py-4">
                      Showing latest 10 battles of {(room.matches || []).length} total epic encounters
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reward Store Dialog */}
        <Dialog open={showRewards} onOpenChange={setShowRewards}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 justify-between text-white text-3xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-white text-3xl font-bold">Reward Marketplace</div>
                    <div className="text-white/60 text-lg">Spend your hard-earned points on amazing rewards!</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowRewardEditor(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-6 py-3"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Manage Rewards
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-6">
              {/* Player Points Summary */}
              <Card className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20">
                <CardContent className="p-6">
                  <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                    <Coins className="w-6 h-6 text-yellow-400" />
                    Player Points
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {room.players.map((player, index) => (
                      <div
                        key={player.id}
                        className={`p-4 rounded-lg border-2 ${
                          player.id === currentPlayer.id
                            ? "border-yellow-400 bg-gradient-to-r from-yellow-500/20 to-orange-500/20"
                            : "border-white/20 bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${PLAYER_COLORS[index % PLAYER_COLORS.length].split(' ')[1]}`}></div>
                            <span className="font-bold text-white text-lg">{player.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gem className="w-5 h-5 text-yellow-400" />
                            <span className="font-bold text-yellow-300 text-xl">{player.points}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Available Rewards */}
              <div className="space-y-4">
                <h3 className="text-white text-2xl font-bold flex items-center gap-2">
                  <Gift className="w-6 h-6" />
                  Available Rewards ({room.rewards?.length || 0})
                </h3>
                
                {!room.rewards || room.rewards.length === 0 ? (
                  <Card className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20">
                    <CardContent className="text-center py-12">
                      <Gift className="w-16 h-16 text-white/40 mx-auto mb-4" />
                      <p className="text-white/60 text-xl">No rewards available</p>
                      <p className="text-white/40 text-lg">Create some rewards to get started!</p>
                      <Button
                        onClick={() => setShowRewardEditor(true)}
                        className="mt-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create First Reward
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-6">
                    {room.rewards.map((reward, index) => (
                      <Card
                        key={reward.id}
                        className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className="text-5xl p-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg">
                                {reward.icon}
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-white text-2xl mb-2">{reward.name}</h3>
                                <p className="text-white/70 text-lg mb-3">{reward.description}</p>
                                <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-4 py-2 text-lg">
                                  <Gem className="inline w-5 h-5 mr-2" />
                                  {reward.cost} points
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 min-w-[200px]">
                              {room.players.map((player, playerIndex) => {
                                const canAfford = player.points >= reward.cost
                                return (
                                  <Button
                                    key={player.id}
                                    size="lg"
                                    onClick={() => redeemReward(reward, player.id)}
                                    disabled={!canAfford}
                                    className={`font-bold px-6 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all ${
                                      canAfford
                                        ? `bg-gradient-to-r ${PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]} hover:shadow-xl text-white`
                                        : "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${PLAYER_COLORS[playerIndex % PLAYER_COLORS.length].split(' ')[1]}`}></div>
                                      <span>{player.name}</span>
                                      <span className="text-sm opacity-80">({player.points})</span>
                                    </div>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white text-2xl">
                <div className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <Gift className="inline w-5 h-5 mr-1" />
                My Bought Rewards
              </DialogTitle>
              <DialogDescription className="text-white/80 text-lg">View and manage your purchased rewards</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              {!room.boughtRewards || room.boughtRewards.length === 0 ? (
                <Card className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-3">
                      <div className="text-6xl mb-4">
                        <Gift className="w-12 h-12 mx-auto text-white/60" />
                      </div>
                      <p className="text-white/60 text-xl">No rewards purchased yet.</p>
                      <p className="text-sm text-white/40">Buy some rewards from the store to see them here!</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                room.boughtRewards.map((boughtReward) => (
                  <Card
                    key={boughtReward.id}
                    className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all"
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl p-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500">
                            {boughtReward.rewardIcon}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">{boughtReward.rewardName}</h3>
                            <p className="text-white/70 text-sm">{boughtReward.rewardDescription}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-2 py-1">
                                Bought by {boughtReward.playerName}
                              </Badge>
                              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-2 py-1">
                                {new Date(boughtReward.boughtAt).toLocaleDateString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="lg"
                          onClick={() => markRewardAsUsed(boughtReward.id)}
                          className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold px-6 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
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

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 z-50">
            <Card className={`backdrop-blur-sm border-0 shadow-2xl ${
              toastType === "success" ? "bg-gradient-to-r from-green-500/90 to-emerald-600/90 border-green-400/50" :
              toastType === "error" ? "bg-gradient-to-r from-red-500/90 to-pink-600/90 border-red-400/50" :
              toastType === "warning" ? "bg-gradient-to-r from-yellow-500/90 to-orange-600/90 border-yellow-400/50" :
              "bg-gradient-to-r from-blue-500/90 to-purple-600/90 border-blue-400/50"
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl ${
                    toastType === "success" ? "text-green-200" :
                    toastType === "error" ? "text-red-200" :
                    toastType === "warning" ? "text-yellow-200" :
                    "text-blue-200"
                  }`}>
                    {toastType === "success" ? "✓" :
                     toastType === "error" ? "✗" :
                     toastType === "warning" ? "⚠" : "ℹ"}
                  </div>
                  <p className="text-white font-semibold">{toastMessage}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowToast(false)}
                    className="text-white hover:text-white/80"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confetti Effect */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-40">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              >
                <div className={`text-2xl ${
                  ['text-yellow-400', 'text-pink-400', 'text-purple-400', 'text-blue-400', 'text-green-400'][Math.floor(Math.random() * 5)]
                }`}>
                  {['🎉', '🎊', '🏆', '⭐', '✨', '💫', '🌟', '🎈'][Math.floor(Math.random() * 8)]}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-2xl bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Settings</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">Customize your experience</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-white" />
                    <div>
                      <p className="text-white font-semibold">Sound Effects</p>
                      <p className="text-white/60 text-sm">Play sounds for actions</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={soundEnabled ? "text-green-400" : "text-gray-400"}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-white" />
                    <div>
                      <p className="text-white font-semibold">Notifications</p>
                      <p className="text-white/60 text-sm">Show browser notifications</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={notificationsEnabled ? "text-green-400" : "text-gray-400"}
                  >
                    {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5 text-white" />
                    <div>
                      <p className="text-white font-semibold">Dark Mode</p>
                      <p className="text-white/60 text-sm">Use dark theme</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDarkMode(!darkMode)}
                    className={darkMode ? "text-green-400" : "text-gray-400"}
                  >
                    {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Save className="w-5 h-5 text-white" />
                    <div>
                      <p className="text-white font-semibold">Auto Save</p>
                      <p className="text-white/60 text-sm">Automatically save progress</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAutoSave(!autoSave)}
                    className={autoSave ? "text-green-400" : "text-gray-400"}
                  >
                    {autoSave ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    exportRoomData()
                    setShowSettings(false)
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Data
                </Button>
                <Button
                  onClick={() => {
                    setShowImportData(true)
                    setShowSettings(false)
                  }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Help Dialog */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Help & Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">Learn how to use LeetCode Battle</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Game Controls</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Start/Stop Timer</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Space</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Reset Round</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Ctrl+R</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Save Match</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Ctrl+S</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Open Rewards</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Ctrl+G</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Open Help</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Ctrl+H</kbd>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white">Close Dialogs</span>
                      <kbd className="px-2 py-1 bg-white/20 text-white rounded text-sm">Escape</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-bold text-lg mb-4">Features</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold">Real-time Multiplayer</h4>
                      <p className="text-white/60 text-sm">Compete with friends in real-time coding battles</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold">Reward System</h4>
                      <p className="text-white/60 text-sm">Earn points and redeem rewards for winning</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold">Match History</h4>
                      <p className="text-white/60 text-sm">Track your performance and see past battles</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold">Sound Effects</h4>
                      <p className="text-white/60 text-sm">Immerse yourself with audio feedback</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold">Auto Save</h4>
                      <p className="text-white/60 text-sm">Your progress is automatically saved</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>



        {/* Import Data Dialog */}
        <Dialog open={showImportData} onOpenChange={setShowImportData}>
          <DialogContent className="max-w-md bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Import Room Data</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">Load previously exported room data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-white/60 mx-auto mb-4" />
                <p className="text-white/80 mb-2">Drop your JSON file here or click to browse</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      importRoomData(file)
                      setShowImportData(false)
                    }
                  }}
                  className="hidden"
                  id="import-file"
                />
                <label
                  htmlFor="import-file"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg cursor-pointer inline-block"
                >
                  Choose File
                </label>
              </div>
              <p className="text-white/60 text-sm text-center">
                Select a previously exported room data file to restore your game state.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Countdown Dialog */}
        <Dialog open={showCountdown} onOpenChange={setShowCountdown}>
          <DialogContent className="max-w-md bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Countdown Timer</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">Set a countdown before starting the battle</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-white mb-4">{countdownTime}</div>
                <p className="text-white/60">seconds</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => setCountdownTime(Math.max(1, countdownTime - 1))}
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setCountdownTime(countdownTime + 1)}
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    setShowCountdown(false)
                    // Start countdown logic here
                    displayToast(`Countdown set to ${countdownTime} seconds!`, "info")
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                >
                  Set Countdown
                </Button>
                <Button
                  onClick={() => setShowCountdown(false)}
                  variant="outline"
                  className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tutorial Dialog */}
        <Dialog open={showTutorial} onOpenChange={setShowTutorial}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl">Welcome to LeetCode Battle!</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">Learn how to play and win</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-white font-bold text-lg">Getting Started</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        1. Join or Create a Room
                      </h4>
                      <p className="text-white/60 text-sm mt-1">Enter your name and either create a new battle room or join an existing one using the room code.</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        2. Set the Problem
                      </h4>
                      <p className="text-white/60 text-sm mt-1">Enter the LeetCode problem name and select the difficulty level.</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Play className="w-5 h-5" />
                        3. Start Coding
                      </h4>
                      <p className="text-white/60 text-sm mt-1">Click START when you begin coding. Click STOP when you finish or want to pause.</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-white font-bold text-lg">Winning & Rewards</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Fastest Wins
                      </h4>
                      <p className="text-white/60 text-sm mt-1">The player who completes the problem fastest wins the round and earns points.</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Gift className="w-5 h-5" />
                        Redeem Rewards
                      </h4>
                      <p className="text-white/60 text-sm mt-1">Use your earned points to buy rewards from the reward store.</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-lg">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Track Progress
                      </h4>
                      <p className="text-white/60 text-sm mt-1">View your match history and statistics to improve your performance.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Button
                  onClick={() => setShowTutorial(false)}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-8 py-3"
                >
                  Let&apos;s Battle!
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Fallback - show setup view if nothing else is rendered
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 p-4">
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="relative max-w-md mx-auto space-y-6 pt-20">
        <div className="text-center space-y-4">
          <div className="relative">
            <h1 className="text-6xl font-black bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-2xl">
              LeetCode
            </h1>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              Battle Arena
            </h2>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
            </div>
          </div>
          <p className="text-white/90 text-lg font-medium">Create or join a coding battle room</p>
        </div>

        <Card className="backdrop-blur-sm bg-white/95 border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-6 h-6" />
              Join the Battle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div>
              <Label htmlFor="playerName" className="text-gray-700 font-semibold">
                Your Battle Name
              </Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your warrior name"
                className="mt-2 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
              />
            </div>

            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-purple-100 to-pink-100">
                <TabsTrigger
                  value="create"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
                >
                  Create Room
                </TabsTrigger>
                <TabsTrigger
                  value="join"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                >
                  Join Room
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="roomName" className="text-gray-700 font-semibold">
                    Battle Arena Name
                  </Label>
                  <Input
                    id="roomName"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Enter arena name"
                    className="mt-2 border-2 border-purple-200 focus:border-purple-500 rounded-lg"
                  />
                </div>
                <Button
                  onClick={createRoom}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                  disabled={!playerName.trim() || !roomName.trim()}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Create Battle Arena
                </Button>
              </TabsContent>

              <TabsContent value="join" className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="joinCode" className="text-gray-700 font-semibold">
                    Arena Code
                  </Label>
                  <Input
                    id="joinCode"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="mt-2 border-2 border-blue-200 focus:border-blue-500 rounded-lg font-mono text-center text-lg"
                  />
                </div>
                <Button
                  onClick={joinRoom}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all"
                  disabled={!playerName.trim() || !joinCode.trim()}
                >
                  <Target className="w-5 h-5 mr-2" />
                  Join Battle
                </Button>
              </TabsContent>
            </Tabs>
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
  const [showAddForm, setShowAddForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleSave = () => {
    if (!newReward.name.trim() || !newReward.description.trim()) {
      return
    }
    
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
    setShowAddForm(false)
  }

  const startEdit = (reward: Reward) => {
    setEditingReward(reward)
    setNewReward({
      name: reward.name,
      cost: reward.cost,
      icon: reward.icon,
      description: reward.description,
    })
    setShowAddForm(true)
  }

  const cancelEdit = () => {
    setEditingReward(null)
    setNewReward({ name: "", cost: 1, icon: "🎁", description: "" })
    setShowAddForm(false)
  }

  const handleDelete = (rewardId: string) => {
    onDeleteReward(rewardId)
    setConfirmDelete(null)
  }

  const popularIcons = ["🎁", "🏆", "⭐", "💎", "🔥", "⚡", "🌟", "💫", "🎯", "🎪", "🎨", "🎭", "🎪", "🎪", "🎪", "🎪"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white text-3xl">
            <div className="p-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="text-white text-3xl font-bold">Reward Manager</div>
              <div className="text-white/60 text-lg">Create and manage battle rewards</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Reward Button */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all"
            >
              <Plus className="w-6 h-6 mr-3" />
              Add New Reward
            </Button>
          )}

          {/* Add/Edit Form */}
          {showAddForm && (
            <Card className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-2xl flex items-center gap-2">
                  {editingReward ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  {editingReward ? "Edit Reward" : "Create New Reward"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name" className="text-white font-semibold text-lg">
                      Reward Name *
                    </Label>
                    <Input
                      id="name"
                      value={newReward.name}
                      onChange={(e) => setNewReward((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter reward name"
                      className="mt-2 bg-white/10 border-white/20 text-white text-lg"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost" className="text-white font-semibold text-lg">
                      Cost (Points) *
                    </Label>
                    <Input
                      id="cost"
                      type="number"
                      min="1"
                      value={newReward.cost}
                      onChange={(e) => setNewReward((prev) => ({ ...prev, cost: Math.max(1, Number.parseInt(e.target.value) || 1) }))}
                      className="mt-2 bg-white/10 border-white/20 text-white text-lg"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-white font-semibold text-lg">Icon</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {popularIcons.map((icon) => (
                      <Button
                        key={icon}
                        variant="outline"
                        size="sm"
                        onClick={() => setNewReward((prev) => ({ ...prev, icon }))}
                        className={`text-2xl p-3 ${
                          newReward.icon === icon
                            ? "bg-gradient-to-r from-pink-500 to-purple-600 border-pink-400 text-white"
                            : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                        }`}
                      >
                        {icon}
                      </Button>
                    ))}
                  </div>
                  <Input
                    value={newReward.icon}
                    onChange={(e) => setNewReward((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="Or type custom icon"
                    className="mt-2 bg-white/10 border-white/20 text-white text-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-white font-semibold text-lg">
                    Description *
                  </Label>
                  <Textarea
                    id="description"
                    value={newReward.description}
                    onChange={(e) => setNewReward((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this reward does..."
                    className="mt-2 bg-white/10 border-white/20 text-white text-lg min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/10">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!newReward.name.trim() || !newReward.description.trim()}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-8 py-3"
                  >
                    {editingReward ? "Update Reward" : "Create Reward"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Rewards */}
          <div className="space-y-4">
            <h3 className="text-white text-2xl font-bold flex items-center gap-2">
              <Gift className="w-6 h-6" />
              Existing Rewards ({rewards.length})
            </h3>
            
            {rewards.length === 0 ? (
              <Card className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20">
                <CardContent className="text-center py-12">
                  <Gift className="w-16 h-16 text-white/40 mx-auto mb-4" />
                  <p className="text-white/60 text-xl">No rewards created yet</p>
                  <p className="text-white/40 text-lg">Create your first reward to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {rewards.map((reward) => (
                  <Card
                    key={reward.id}
                    className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-white/20 hover:border-white/40 transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl p-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg">
                            {reward.icon}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-white text-xl">{reward.name}</h3>
                            <p className="text-white/70 text-lg mt-1">{reward.description}</p>
                            <Badge className="mt-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-4 py-2 text-lg">
                              <Gem className="inline w-5 h-5 mr-2" />
                              {reward.cost} points
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => startEdit(reward)}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-4 py-2"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setConfirmDelete(reward.id)}
                            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold px-4 py-2"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="bg-gradient-to-br from-red-900 to-pink-900 border-red-400/50">
            <DialogHeader>
              <DialogTitle className="text-white text-2xl flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-red-400" />
                Confirm Delete
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-white/80 text-lg">
                Are you sure you want to delete this reward? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="text-white hover:bg-white/10">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDelete(confirmDelete!)}
                  className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold"
                >
                  Delete Reward
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}