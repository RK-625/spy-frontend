'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { GradientBackground } from '@/components/ui/gradient-background'
import ChromeButton from '@/components/ui/chrome-button'
import NoiseField from './noise-field'
import {
  INITIAL_PULSE_RING_STATE,
  RING_HALF_WIDTH,
  type PulseRingState,
} from '@/lib/pulse-ring-state'

const PULSE_DELAY = 5000
const PULSE_DURATION = 2400
const RING_WIDTH = 75
const PATTERN_SIZE = 100
const COLOR = '#2E1092'

function generatePattern(
  ctx: CanvasRenderingContext2D,
  r1: number, r2: number,
  g1: number, g2: number,
  b1: number, b2: number,
  alpha: number
) {
  const data = ctx.createImageData(PATTERN_SIZE, PATTERN_SIZE)
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i]     = Math.floor(Math.random() * (r2 - r1 + 1) + r1)
    data.data[i + 1] = Math.floor(Math.random() * (g2 - g1 + 1) + g1)
    data.data[i + 2] = Math.floor(Math.random() * (b2 - b1 + 1) + b1)
    data.data[i + 3] = alpha
  }
  ctx.putImageData(data, 0, 0)
}

export default function NoiseFieldBg() {
  const [showText, setShowText] = useState(false)
  const [showPhase2, setShowPhase2] = useState(false)
  const [clipRadius, setClipRadius] = useState(9999)
  const startTimeRef = useRef<number | null>(null)
  const completeRef = useRef(false)

  const darkCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cleanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pulseRef = useRef<PulseRingState>({ ...INITIAL_PULSE_RING_STATE })

  useEffect(() => {
    const timer = setTimeout(() => setShowText(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  // Poll pulseRef to shrink clip-path with the ring sweep
  useEffect(() => {
    let rafId: number
    const poll = () => {
      const ringR = pulseRef.current.ringRadius
      if (pulseRef.current.active && ringR < clipRadius) {
        // Shrink clip circle in sync with ring + smooth CSS transition
        setClipRadius(Math.max(0, ringR - 100))
      }
      if (!pulseRef.current.complete) {
        rafId = requestAnimationFrame(poll)
      } else {
        // 2s after pulse completes, show phase 2 text
        setTimeout(() => setShowPhase2(true), 2000)
      }
    }
    rafId = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const regenerateTimer = setInterval(() => {
      if (completeRef.current && cleanCanvasRef.current) {
        const cleanCtx = cleanCanvasRef.current.getContext('2d')!
        generatePattern(cleanCtx, 180, 235, 170, 220, 190, 240, 35)
      }
    }, 800)
    return () => clearInterval(regenerateTimer)
  }, [])

  const postDraw = useCallback((
    ctx: CanvasRenderingContext2D,
    frame: number,
    timestamp: number,
    cssW: number,
    cssH: number
  ) => {
    const cx = cssW / 2
    const cy = cssH / 2
    const diagonal = Math.sqrt(cssW * cssW + cssH * cssH)

    if (!startTimeRef.current && timestamp > 0) {
      startTimeRef.current = timestamp
    }
    if (!startTimeRef.current) return

    const elapsed = timestamp - startTimeRef.current
    const startRing = diagonal * 0.6
    const halfW = RING_HALF_WIDTH

    if (elapsed < PULSE_DELAY) {
      pulseRef.current = {
        active: false,
        complete: completeRef.current,
        ringRadius: startRing,
        outerR: startRing + halfW,
        startRing,
        cx,
        cy,
      }
      return
    }

    const animElapsed = elapsed - PULSE_DELAY
    const complete = animElapsed >= PULSE_DURATION

    // Initialize pattern canvases on first entry
    if (!darkCanvasRef.current) {
      darkCanvasRef.current = document.createElement('canvas')
      darkCanvasRef.current.width = PATTERN_SIZE
      darkCanvasRef.current.height = PATTERN_SIZE
      const dCtx = darkCanvasRef.current.getContext('2d')!
      generatePattern(dCtx, 8, 25, 6, 20, 20, 45, 50)
    }
    if (!cleanCanvasRef.current) {
      cleanCanvasRef.current = document.createElement('canvas')
      cleanCanvasRef.current.width = PATTERN_SIZE
      cleanCanvasRef.current.height = PATTERN_SIZE
      const cCtx = cleanCanvasRef.current.getContext('2d')!
      generatePattern(cCtx, 180, 235, 170, 220, 190, 240, 35)
    }

    // Regenerate grain during animation (every 6 frames)
    if (frame % 6 === 0 && !complete) {
      const dCtx = darkCanvasRef.current.getContext('2d')!
      generatePattern(dCtx, 8, 25, 6, 20, 20, 45, 50)
      const cCtx = cleanCanvasRef.current.getContext('2d')!
      generatePattern(cCtx, 180, 235, 170, 220, 190, 240, 35)
    }

    // Ring radius: sweeps from screen edge → 0
    let ringRadius: number
    if (complete) {
      ringRadius = 0
      completeRef.current = true
    } else {
      const progress = animElapsed / PULSE_DURATION
      const eased = 1 - Math.pow(1 - progress, 3)
      ringRadius = startRing * (1 - eased)
    }

    const outerR = Math.max(halfW, ringRadius + halfW)

    pulseRef.current = {
      active: true,
      complete,
      ringRadius,
      outerR,
      startRing,
      cx,
      cy,
    }

    // ===== DRAW ORDER =====
    // Layers: clean noise → dark noise (clipped inside ring) → ring/wave fill

    // 1. Clean noise fills entire canvas
    const cleanPattern = ctx.createPattern(cleanCanvasRef.current, 'repeat')!
    ctx.fillStyle = cleanPattern
    ctx.fillRect(0, 0, cssW, cssH)

    // 2. Dark noise clipped inside ringRadius (unreformed inner zone)
    if (ringRadius > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2)
      ctx.clip()

      const darkPattern = ctx.createPattern(darkCanvasRef.current, 'repeat')!
      ctx.fillStyle = darkPattern
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.restore()
    }

    // 3. Ring band — annulus only (no center fill disc)
    //    Inner-lip morph 00→FF, 44→CC follows ring sweep (not a center-growing circle)
    {
      const outerR = Math.max(halfW, ringRadius + halfW)
      const innerR = Math.max(0, ringRadius - halfW)
      const fillProgress = ringRadius < 1 ? 1 : Math.min(1, 1 - ringRadius / startRing)

      const innerAlpha    = Math.round(fillProgress * 0xFF)                   // 00→FF
      const midInnerAlpha = Math.round(0x44 + fillProgress * (0xCC - 0x44))   // 44→CC
      const innerHex    = innerAlpha.toString(16).padStart(2, '0')
      const midInnerHex = midInnerAlpha.toString(16).padStart(2, '0')

      const ringGradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
      ringGradient.addColorStop(0, `${COLOR}${innerHex}`)
      ringGradient.addColorStop(0.35, `${COLOR}${midInnerHex}`)
      ringGradient.addColorStop(0.5, `${COLOR}99`)
      ringGradient.addColorStop(0.65, `${COLOR}44`)
      ringGradient.addColorStop(1, `${COLOR}00`)

      ctx.save()
      // Clip to annulus: outer clockwise → inner counterclockwise → even-odd hole
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2, false)
      if (innerR > 0) {
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true)
      }
      ctx.clip()

      ctx.fillStyle = ringGradient
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // 3c. Mask clean noise in swept area (outside outerR) with background gradient
    //     So arrows in the swept zone see clean gradient, not noisy texture
    {
      const outerR = Math.max(halfW, ringRadius + halfW)
      const bgGrad = ctx.createRadialGradient(
        cx, cy,
        Math.max(0.001, outerR),
        cx, cy,
        Math.max(outerR + 1, Math.max(cssW, cssH))
      )
      bgGrad.addColorStop(0, 'rgba(20,20,35,1)')
      bgGrad.addColorStop(0.35, 'rgba(45,35,65,1)')
      bgGrad.addColorStop(1, 'rgba(25,25,45,1)')

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, cssW, cssH)
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2, true) // CCW hole
      ctx.clip('evenodd')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.restore()
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <GradientBackground
        gradientOrigin="center"
        colors={[
          { color: 'rgba(20,20,35,1)', stop: '0%' },
          { color: 'rgba(45,35,65,1)', stop: '40%' },
          { color: 'rgba(25,25,45,1)', stop: '100%' }
        ]}
        noiseIntensity={2}
        noisePatternSize={25}
        noisePatternRefreshInterval={1}
        noisePatternAlpha={100}
        postDraw={postDraw}
      />
      <NoiseField pulseRef={pulseRef} />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          opacity: showText ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
          clipPath: `circle(${clipRadius}px at 50% 50%)`,
        }}
      >
        <span
          style={{
            color: '#e8e4df',
            fontSize:  65,
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-terminal)'
          }}
        >
          Knowledge unstructured is just{' '}
          <span style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #c8c3b8 40%, #8a8580 70%, #c8c3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>NOISE!!!</span>
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          opacity: showPhase2 ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
        }}>
          <span style={{
            position: 'absolute',
            top: '50%',
            right: '50%',
            marginRight: 34,
            transform: 'translateY(-50%)',
            color: '#e8e4df',
            fontSize: 65,
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-terminal)',
            background: 'linear-gradient(180deg, #ffffff 0%, #c8c3b8 40%, #8a8580 70%, #c8c3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            whiteSpace: 'nowrap',
          }}>MANAGE CHA</span>
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: 42,
            transform: 'translateY(-50%)',
            color: '#e8e4df',
            fontSize: 65,
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-terminal)',
            background: 'linear-gradient(180deg, #ffffff 0%, #c8c3b8 40%, #8a8580 70%, #c8c3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            whiteSpace: 'nowrap',
          }}>S</span>
          <div style={{
            position: 'absolute',
            top: 'calc(50% + 76px)',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
          }}>
            <ChromeButton>START WEAVING</ChromeButton>
          </div>
        </div>
      </div>
    </div>
  )
}
