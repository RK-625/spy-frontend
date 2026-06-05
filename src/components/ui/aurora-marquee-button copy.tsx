'use client'

import { type ReactNode } from 'react'
import { useRef, useEffect, useState } from 'react'

export interface AuroraMarqueeButtonProps {
  children: ReactNode
  width?: number | string
  height?: number | string
  className?: string
}

export function AuroraMarqueeButton({
  children,
  width = 280,
  height = 52,
  className = '',
}: AuroraMarqueeButtonProps) {
  const textRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldMarquee, setShouldMarquee] = useState(false)

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current && containerRef.current) {
        const textWidth = textRef.current.scrollWidth
        const containerWidth = containerRef.current.clientWidth
        setShouldMarquee(textWidth > containerWidth)
      }
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [children])

  const widthStyle = typeof width === 'number' ? `${width}px` : width
  const heightStyle = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden cursor-pointer group ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
        borderRadius: '9999px',
        padding: '14px 28px',
        minWidth: '220px',
        maxWidth: '360px',
        fontSize: '15px',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
        transition: 'transform 0.15s ease-out, filter 0.3s ease',
      }}
    >
      {/* Aurora Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, #2E1092, #7D43EE, #1D9E75, #2E1092)',
          animation: 'aurora-rotate 6s ease-in-out infinite',
          filter: 'brightness(1)',
          transition: 'filter 0.3s ease',
        }}
      />

      {/* Text Content */}
      <div className="relative h-full flex items-center justify-center overflow-hidden">
        {shouldMarquee ? (
          <div className="whitespace-nowrap flex animate-marquee">
            <span
              ref={textRef}
              className="inline-block text-white font-semibold tracking-[0.04em]"
            >
              {children}
              <span className="mx-4">·</span>
              {children}
              <span className="mx-4">·</span>
            </span>
          </div>
        ) : (
          <span
            ref={textRef}
            className="text-white font-semibold tracking-[0.04em]"
          >
            {children}
          </span>
        )}
      </div>

      <style jsx>{`
        @keyframes aurora-rotate {
          0%, 100% {
            transform: rotate(0deg) scale(1.5);
          }
          50% {
            transform: rotate(180deg) scale(1.5);
          }
        }

        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 8s linear infinite;
        }

        .group:hover .absolute {
          filter: brightness(1.1);
        }

        .group:hover .animate-marquee {
          animation-duration: 10s;
        }

        .group:active {
          transform: scale(0.97);
        }
      `}</style>
    </div>
  )
}
