"use client"

import { useState, useEffect } from "react"
import { Trophy, Clock, Gift, Zap, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { database } from "@/lib/firebase"
import { ref, onValue, set, push, off } from "firebase/database"

interface PlayerState {
  isRunning: boolean
  startTime: number | null
  endTime: number | null
  finalTime: number | null
}

interface GameState {
  arnav: PlayerState
  meera: PlayerState
  points: {
    arnav: number
    meera: number
  }
  winner: string | null
  showWinner: boolean
  redeemedRewards: {
    arnav: string[]
    meera: string[]
  }
}

interface Reward {
  id: string
  name: string
  cost: number
  icon: string
  description: string
}

const REWARDS: Reward[] = [
  { id: "dinner", name: "Pick Dinner", cost: 3, icon: "🍽️", description: "Choose what we eat tonight" },
  { id: "massage", name: "Get a Massage", cost: 5, icon: "💆", description: "15-minute shoulder massage" },
  { id: "netflix", name: "Netflix Pick", cost: 2, icon: "📺", description: "Choose the next show/movie" },
  { id: "coffee", name: "Free Coffee", cost: 1, icon: "☕", description: "Other person buys your coffee" },
  { id: "chores", name: "Skip Chores", cost: 4, icon: "🧹", description: "Skip your turn doing dishes" },
  { id: "music", name: "Music Control", cost: 2, icon: "🎵", description: "Control playlist for the day" },
]

export default function LeetCodeBattle() {
  const [gameState, setGameState] = useState<GameState>({
    arnav: { isRunning: false, startTime: null, endTime: null, finalTime: null },
    meera: { isRunning: false, startTime: null, endTime: null, finalTime: null },
    points: { arnav: 0, meera: 0 },
    winner: null,
    showWinner: false,
    redeemedRewards: { arnav: [], meera: [] },
  })

  const [showRewards, setShowRewards] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState("")
  const [currentPlayer, setCurrentPlayer] = useState<"arnav" | "meera" | null>(null)

  // Initialize Firebase data if it doesn't exist
  useEffect(() => {
    const gameRef = ref(database, 'game')
    onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Initialize with default values
        const initialData = {
          arnav: { isRunning: false, startTime: null, endTime: null, finalTime: null },
          meera: { isRunning: false, startTime: null, endTime: null, finalTime: null },
          points: { arnav: 0, meera: 0 },
          winner: null,
          showWinner: false,
          redeemedRewards: { arnav: [], meera: [] },
        }
        set(ref(database, 'game'), initialData)
      }
    }, { onlyOnce: true })
  }, [])

  // Listen for real-time updates from Firebase
  useEffect(() => {
    const gameRef = ref(database, 'game')
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setGameState(prev => ({
          ...prev,
          arnav: data.arnav || prev.arnav,
          meera: data.meera || prev.meera,
          winner: data.winner || null,
          showWinner: data.showWinner || false,
          points: data.points || prev.points,
          redeemedRewards: data.redeemedRewards || prev.redeemedRewards,
        }))
      }
    })

    return () => {
      off(gameRef)
      unsubscribe()
    }
  }, [])

  // Check for winner when both timers are stopped
  useEffect(() => {
    if (gameState.arnav.finalTime !== null && gameState.meera.finalTime !== null && !gameState.showWinner) {
      const winner = gameState.arnav.finalTime < gameState.meera.finalTime ? "arnav" : "meera"
      const newPoints = {
        ...gameState.points,
        [winner]: gameState.points[winner] + 1,
      }
      
      const winnerState = {
        winner,
        showWinner: true,
        points: newPoints,
      }
      
      // Update local state
      setGameState((prev) => ({
        ...prev,
        ...winnerState,
      }))
      
      // Update Firebase
      set(ref(database, 'game'), {
        arnav: gameState.arnav,
        meera: gameState.meera,
        ...winnerState,
      })
    }
  }, [gameState.arnav.finalTime, gameState.meera.finalTime, gameState.showWinner])

  const startTimer = (player: "arnav" | "meera") => {
    const newState = {
      ...gameState[player],
      isRunning: true,
      startTime: Date.now(),
      endTime: null,
      finalTime: null,
    }
    
    // Update local state
    setGameState((prev) => ({
      ...prev,
      [player]: newState,
    }))
    
    // Update Firebase
    set(ref(database, `game/${player}`), newState)
  }

  const stopTimer = (player: "arnav" | "meera") => {
    const endTime = Date.now()
    const newState = {
      ...gameState[player],
      isRunning: false,
      endTime,
      finalTime: gameState[player].startTime ? endTime - gameState[player].startTime : null,
    }
    
    // Update local state
    setGameState((prev) => ({
      ...prev,
      [player]: newState,
    }))
    
    // Update Firebase
    set(ref(database, `game/${player}`), newState)
  }

  const resetRound = () => {
    const resetState = {
      arnav: { isRunning: false, startTime: null, endTime: null, finalTime: null },
      meera: { isRunning: false, startTime: null, endTime: null, finalTime: null },
      winner: null,
      showWinner: false,
      points: gameState.points, // Keep points
      redeemedRewards: gameState.redeemedRewards, // Keep rewards
    }
    
    // Update local state
    setGameState((prev) => ({
      ...prev,
      ...resetState,
    }))
    
    // Update Firebase
    set(ref(database, 'game'), resetState)
  }

  const redeemReward = (reward: Reward, player: "arnav" | "meera") => {
    if (gameState.points[player] >= reward.cost) {
      const newPoints = {
        ...gameState.points,
        [player]: gameState.points[player] - reward.cost,
      }
      const newRedeemedRewards = {
        ...gameState.redeemedRewards,
        [player]: [...gameState.redeemedRewards[player], reward.id],
      }
      
      // Update local state
      setGameState((prev) => ({
        ...prev,
        points: newPoints,
        redeemedRewards: newRedeemedRewards,
      }))
      
      // Update Firebase
      set(ref(database, 'game'), {
        arnav: gameState.arnav,
        meera: gameState.meera,
        winner: gameState.winner,
        showWinner: gameState.showWinner,
        points: newPoints,
        redeemedRewards: newRedeemedRewards,
      })
      
      setRedeemMessage(`${player.charAt(0).toUpperCase() + player.slice(1)} redeemed: ${reward.name}!`)
      setTimeout(() => setRedeemMessage(""), 3000)
    }
  }

  const formatTime = (ms: number | null) => {
    if (!ms) return "00:00"
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const PlayerTimer = ({ player, name }: { player: "arnav" | "meera"; name: string }) => {
    const playerState = gameState[player]
    const [currentTime, setCurrentTime] = useState(0)

    useEffect(() => {
      let interval: NodeJS.Timeout
      if (playerState.isRunning && playerState.startTime) {
        interval = setInterval(() => {
          setCurrentTime(Date.now() - playerState.startTime!)
        }, 100)
      }
      return () => clearInterval(interval)
    }, [playerState.isRunning, playerState.startTime])

    const displayTime = playerState.finalTime || currentTime

    return (
      <Card className={`relative overflow-hidden ${playerState.isRunning ? "ring-2 ring-blue-500 ring-pulse" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Crown className={`w-5 h-5 ${player === "arnav" ? "text-blue-500" : "text-pink-500"}`} />
            {name}
          </CardTitle>
          <CardDescription>
            Points: <Badge variant="secondary">{gameState.points[player]}</Badge>
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
          <div className="flex gap-2">
            <Button
              onClick={() => startTimer(player)}
              disabled={playerState.isRunning || playerState.finalTime !== null || currentPlayer !== player}
              className="flex-1"
              variant={playerState.isRunning ? "secondary" : "default"}
            >
              <Clock className="w-4 h-4 mr-2" />
              {currentPlayer === player ? "Start" : "Waiting..."}
            </Button>
            <Button
              onClick={() => stopTimer(player)}
              disabled={!playerState.isRunning || currentPlayer !== player}
              variant="outline"
              className="flex-1"
            >
              {currentPlayer === player ? "Stop" : "Waiting..."}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Player selection dialog
  if (!currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Choose Your Player</CardTitle>
            <CardDescription className="text-center">
              Select which player you are to enable real-time synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setCurrentPlayer("arnav")} 
              className="w-full h-16 text-lg"
              variant="outline"
            >
              <Crown className="w-6 h-6 mr-3 text-blue-500" />
              I'm Arnav
            </Button>
            <Button 
              onClick={() => setCurrentPlayer("meera")} 
              className="w-full h-16 text-lg"
              variant="outline"
            >
              <Crown className="w-6 h-6 mr-3 text-pink-500" />
              I'm Meera
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
            LeetCode Battle Arena
          </h1>
          <p className="text-muted-foreground">Arnav vs Meera • May the fastest coder win!</p>
          <div className="flex justify-center gap-4">
            <Badge variant="secondary" className="text-sm">
              You are: {currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCurrentPlayer(null)}
            >
              Change Player
            </Button>
          </div>
        </div>

        {/* Winner Announcement */}
        {gameState.showWinner && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
                <h2 className="text-2xl font-bold text-yellow-700">
                  🎉 {gameState.winner ? gameState.winner.charAt(0).toUpperCase() + gameState.winner.slice(1) : ""} Wins! 🎉
                </h2>
                <p className="text-yellow-600">
                  Finished in{" "}
                  {gameState.winner && formatTime(gameState[gameState.winner as "arnav" | "meera"].finalTime)}
                </p>
                <Button onClick={resetRound} className="mt-4">
                  <Zap className="w-4 h-4 mr-2" />
                  New Round
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timers */}
        <div className="grid md:grid-cols-2 gap-6">
          <PlayerTimer player="arnav" name="Arnav" />
          <PlayerTimer player="meera" name="Meera" />
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
          <Button 
            onClick={() => {
              const resetState = {
                arnav: { isRunning: false, startTime: null, endTime: null, finalTime: null },
                meera: { isRunning: false, startTime: null, endTime: null, finalTime: null },
                points: { arnav: 0, meera: 0 },
                winner: null,
                showWinner: false,
                redeemedRewards: { arnav: [], meera: [] },
              }
              
              // Update local state
              setGameState(resetState)
              
              // Update Firebase
              set(ref(database, 'game'), resetState)
            }} 
            variant="destructive"
          >
            Reset All Data
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

        {/* Reward Store Dialog */}
        <Dialog open={showRewards} onOpenChange={setShowRewards}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Reward Store
              </DialogTitle>
              <DialogDescription>Redeem your hard-earned points for awesome rewards!</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              {REWARDS.map((reward) => (
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => redeemReward(reward, "arnav")}
                          disabled={gameState.points.arnav < reward.cost || gameState.redeemedRewards.arnav.includes(reward.id)}
                          variant={gameState.redeemedRewards.arnav.includes(reward.id) ? "secondary" : "outline"}
                        >
                          {gameState.redeemedRewards.arnav.includes(reward.id) ? "✓ Redeemed" : `Arnav (${gameState.points.arnav})`}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => redeemReward(reward, "meera")}
                          disabled={gameState.points.meera < reward.cost || gameState.redeemedRewards.meera.includes(reward.id)}
                          variant={gameState.redeemedRewards.meera.includes(reward.id) ? "secondary" : "outline"}
                        >
                          {gameState.redeemedRewards.meera.includes(reward.id) ? "✓ Redeemed" : `Meera (${gameState.points.meera})`}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 