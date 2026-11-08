'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Full-bleed WebGL aurora: layered FBM noise in the brand mint and cyan on black, with film grain,
 * drifting slowly and leaning toward the cursor. One cheap fragment shader, dpr capped, no postprocessing.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uRes;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 13.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
    float t = uTime * 0.07;
    vec2 m = (uMouse - 0.5) * 0.35;

    float n1 = fbm(p * 1.5 + vec2(t, -t * 0.6) + m);
    float n2 = fbm(p * 2.6 - vec2(t * 0.5, t * 0.35) - m * 0.5 + n1 * 1.2);
    float band = smoothstep(0.32, 0.78, n2);
    float split = smoothstep(0.25, 0.85, n1);
    vec3 col = mix(uA, uB, split) * band;

    // keep the bottom dark so copy stays readable, soften the top edge
    col *= smoothstep(0.02, 0.45, uv.y) * smoothstep(1.05, 0.55, uv.y);
    // soft vignette left/right
    col *= smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x) * 0.9 + 0.1;

    float grain = (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.07;
    gl_FragColor = vec4(col * uIntensity + grain * band, 1.0);
  }
`

function AuroraPlane({ intensity }: { intensity: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const mouse = useRef(new THREE.Vector2(0.5, 0.5))
  const target = useRef(new THREE.Vector2(0.5, 0.5))
  const { size } = useThree()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uA: { value: new THREE.Color('#4dfca9') },
      uB: { value: new THREE.Color('#05edfa') },
      uIntensity: { value: intensity },
    }),
    [intensity],
  )
  useEffect(() => {
    const onMove = (e: PointerEvent) => target.current.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  useFrame((_, dt) => {
    const u = mat.current?.uniforms
    if (!u) return
    u.uTime.value += dt
    u.uRes.value.set(size.width, size.height)
    mouse.current.lerp(target.current, 0.04)
    u.uMouse.value.copy(mouse.current)
  })
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} depthWrite={false} />
    </mesh>
  )
}

export const AuroraCanvas = memo(function AuroraCanvas({ className = '', intensity = 0.9 }: { className?: string; intensity?: number }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }} frameloop={reduce ? 'demand' : 'always'} camera={{ position: [0, 0, 1] }}>
        <AuroraPlane intensity={intensity} />
      </Canvas>
    </div>
  )
})
