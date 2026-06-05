'use client'

import { useEffect, useRef, type RefObject } from 'react'
import {
  INITIAL_PULSE_RING_STATE,
  type PulseRingState,
} from '@/lib/pulse-ring-state'

const GRID_SPACING = 50

const SHAFT_LEN    = 25
const HEAD_SIZE    = 15
// const DECAY_DIST = 320
// const LERP_FAST  = 0.12
// const LERP_MIN   = 0.006
const IDLE_LERP    = 0.05
const LOCK_LERP    = 0.05
const WOBBLE_AMP   = 0.75
const WOBBLE_FREQ  = 0.9

/** Arrow color — warm off-white (brief / knowledge graph). */
const ARROW_RGB  = '200, 195, 184'
const ARROW_ALPHA = 0.5

interface Arrow {
  gx: number
  gy: number
  angle: number
  phase: number
  /** Locked toward center after the pulse wave has passed this point. */
  locked?: boolean
}

function flowAngle(gx: number, gy: number, t: number): number {
  return (
    Math.sin(gx * 0.007 + t) * Math.PI +
    Math.cos(gy * 0.007 + t * 0.6) * Math.PI
  )
}

function lerpAngle(current: number, target: number, speed: number): number {
  let diff = target - current
  while (diff >  Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * speed
}

interface NoiseFieldProps {
  pulseRef?: RefObject<PulseRingState>
}

export default function NoiseField({ pulseRef }: NoiseFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  // const mouseRef    = useRef<{ x: number; y: number } | null>(null)
  const arrowsRef   = useRef<Arrow[]>([])

  // ── Mouse tracking (disabled — arrows flow passively) ──
  // useEffect(() => {
  //   const canvas = canvasRef.current
  //   if (!canvas) return
  //   const onMove = (e: MouseEvent) => {
  //     const rect = canvas.getBoundingClientRect()
  //     mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  //   }
  //   const onLeave = () => { mouseRef.current = null }
  //   canvas.addEventListener('mousemove', onMove)
  //   canvas.addEventListener('mouseleave', onLeave)
  //   return () => {
  //     canvas.removeEventListener('mousemove', onMove)
  //     canvas.removeEventListener('mouseleave', onLeave)
  //   }
  // }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let t = 0

    function buildGrid(W: number, H: number) {
      const prev = new Map<string, Arrow>()
      for (const a of arrowsRef.current) prev.set(`${a.gx},${a.gy}`, a)
      const next: Arrow[] = []
      for (let gx = GRID_SPACING / 2; gx < W; gx += GRID_SPACING) {
        for (let gy = GRID_SPACING / 2; gy < H; gy += GRID_SPACING) {
          const existing = prev.get(`${gx},${gy}`)
          next.push({
            gx,
            gy,
            angle: existing?.angle ?? flowAngle(gx, gy, t),
            phase: existing?.phase ?? Math.random() * Math.PI * 2,
          })
        }
      }
      arrowsRef.current = next
    }

    const resize = () => {
      const w   = container.clientWidth  || 480
      const h   = container.clientHeight || 480
      const dpr = window.devicePixelRatio || 1
      canvas.width  = w * dpr
      canvas.height = h * dpr
      canvas.style.width  = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildGrid(w, h)
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    function draw() {
      const W = container!.clientWidth  || 480
      const H = container!.clientHeight || 480
      // const mouse = mouseRef.current

      ctx!.clearRect(0, 0, W, H)

      ctx!.lineCap  = 'round'
      ctx!.lineJoin = 'round'

      const pulse = pulseRef?.current ?? INITIAL_PULSE_RING_STATE
      const cx = pulse.cx > 0 ? pulse.cx : W / 2
      const cy = pulse.cy > 0 ? pulse.cy : H / 2

      for (const arrow of arrowsRef.current) {
        const { gx, gy } = arrow
        const dist = Math.hypot(gx - cx, gy - cy)

        // Swept = outside the shrinking interior (dist > ringRadius), within the
        // band envelope (dist <= outerR). Once passed, stay locked toward center.
        if (pulse.active) {
          if (pulse.complete || dist > pulse.ringRadius) {
            arrow.locked = true
          }
        }

        if (arrow.locked) {
          const targetAngle = Math.atan2(cy - gy, cx - gx)
          arrow.angle = lerpAngle(arrow.angle, targetAngle, LOCK_LERP)
        } else {
          const noiseAngle =
            flowAngle(gx, gy, t) +
            WOBBLE_AMP * 0.5 * Math.sin(t * WOBBLE_FREQ * 0.8 + arrow.phase)
          arrow.angle = lerpAngle(arrow.angle, noiseAngle, IDLE_LERP)
        }

        const angle = arrow.angle
        const cos   = Math.cos(angle)
        const sin   = Math.sin(angle)

        // ── Cursor-reactive alpha (disabled) ──
        // let alpha: number
        // if (mouse) {
        //   const dx = mouse.x - gx, dy = mouse.y - gy
        //   const dist2 = dx * dx + dy * dy
        //   const proximity = Math.exp(-dist2 / (200 * 200))
        //   alpha = 0.06 + proximity * 0.84
        // } else {
        //   alpha = 0.18
        // }

        const color = `rgba(${ARROW_RGB}, ${ARROW_ALPHA.toFixed(3)})`

        ctx!.strokeStyle = color
        const tipX = gx + cos * SHAFT_LEN
        const tipY = gy + sin * SHAFT_LEN
        const tailX = gx - cos * SHAFT_LEN
        const tailY = gy - sin * SHAFT_LEN

        ctx!.lineWidth = 1.8
        ctx!.beginPath()
        ctx!.moveTo(tailX, tailY)
        ctx!.lineTo(tipX, tipY)
        ctx!.stroke()

        const headAngle = Math.PI - Math.PI / 5
        ctx!.lineWidth = 1.5
        ctx!.beginPath()
        ctx!.moveTo(tipX, tipY)
        ctx!.lineTo(
          tipX + Math.cos(angle + headAngle) * HEAD_SIZE,
          tipY + Math.sin(angle + headAngle) * HEAD_SIZE,
        )
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.moveTo(tipX, tipY)
        ctx!.lineTo(
          tipX + Math.cos(angle - headAngle) * HEAD_SIZE,
          tipY + Math.sin(angle - headAngle) * HEAD_SIZE,
        )
        ctx!.stroke()
      }

      t += 0.05
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [pulseRef])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'transparent' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
