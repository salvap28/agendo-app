"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFocusStore } from "@/lib/stores/focusStore";

export interface InteractiveNebulaShaderProps {
  mode?: "default" | "gym";
  className?: string;
}

/**
 * Full-screen liquid nebula shader background.
 * Replaces the previous canvas wave background with a premium WebGL fluid simulation.
 * Adapted to Agendo's color palette (Default: Violet/Indigo, Gym: Emerald/Teal).
 */
export function FocusWaveBackground({ mode = "default", className = "" }: InteractiveNebulaShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const targetValuesRef = useRef({ themeMode: mode === "gym" ? 1.0 : 0.0, isPaused: 0.0 });
  const { session } = useFocusStore();

  const isPaused = session?.isPaused || false;

  // Sync props into target values for smooth interpolation
  useEffect(() => {
    targetValuesRef.current.themeMode = mode === "gym" ? 1.0 : 0.0;
    targetValuesRef.current.isPaused = isPaused ? 1.0 : 0.0;
  }, [mode, isPaused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer, scene, camera, clock
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock = new THREE.Clock();

    // Vertex shader: pass UVs
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    // Ray-marched nebula fragment shader with Agendo palettes
    const fragmentShader = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;
      uniform float themeMode; // 0.0 = Default, 1.0 = Gym
      uniform float isPaused; // 0.0 to 1.0 for interpolation
      varying vec2 vUv;

      #define t iTime
      mat2 m(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
      
      float map(vec3 p){
        p.xz *= m(t*0.4);
        p.xy *= m(t*0.3);
        vec3 q = p*2. + t;
        return length(p + vec3(sin(t*0.7))) * log(length(p)+1.0)
             + sin(q.x + sin(q.z + sin(q.y))) * 0.5 - 1.0;
      }

      void mainImage(out vec4 O, in vec2 fragCoord) {
        vec2 uv = fragCoord / min(iResolution.x, iResolution.y) - vec2(.9, .5);
        uv.x += .4;
        
        // Slight parallax with mouse
        uv += (iMouse / iResolution - 0.5) * 0.1;

        vec3 col = vec3(0.0);
        float d = 2.5;

        // Agendo Themes
        // Default: Deep violet/indigo with magenta hints
        vec3 defaultBase = vec3(0.1, 0.05, 0.2) + vec3(3.0, 1.0, 4.5);
        vec3 defaultHighlight = vec3(0.4, 0.1, 0.6);
        
        // Gym: Emerald/Teal energy
        vec3 gymBase = vec3(0.01, 0.15, 0.08) + vec3(0.5, 4.0, 2.0);
        vec3 gymHighlight = vec3(0.05, 0.5, 0.3);

        // Ray-march
        for (int i = 0; i <= 5; i++) {
          vec3 p = vec3(0,0,5.) + normalize(vec3(uv, -1.)) * d;
          float rz = map(p);
          float f  = clamp((rz - map(p + 0.1)) * 0.5, -0.1, 1.0);

          vec3 baseColor = mix(
            defaultBase * f + defaultHighlight * (1.0 - f) * 0.2, 
            gymBase * f + gymHighlight * (1.0 - f) * 0.2, 
            themeMode
          );

          col = col * baseColor + smoothstep(2.5, 0.0, rz) * 0.7 * baseColor;
          d += min(rz, 1.0);
        }

        // Center dimming (vignette for content readability)
        float dist   = distance(fragCoord, iResolution*0.5);
        float radius = min(iResolution.x, iResolution.y) * 0.5;
        float dim    = smoothstep(radius*0.3, radius*0.8, dist);

        // Desaturate and darken if paused
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 pausedCol = mix(col, vec3(gray), 0.6) * 0.5;
        col = mix(col, pausedCol, isPaused);

        O = vec4(col, 1.0);
        
        // Apply intense center vignette to make glass panels pop
        O.rgb = mix(O.rgb * 0.15, O.rgb, dim);
      }

      void main() {
        mainImage(gl_FragColor, vUv * iResolution);
      }
    `;

    // Uniforms
    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2() },
      iMouse: { value: new THREE.Vector2() },
      themeMode: { value: targetValuesRef.current.themeMode },
      isPaused: { value: targetValuesRef.current.isPaused },
    };

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    materialRef.current = material;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    // Resize & mouse
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.iResolution.value.set(w, h);
    };

    // Parallax mouse follow
    let targetX = 0;
    let targetY = 0;
    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = window.innerHeight - e.clientY;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    onResize();

    // Animation loop
    renderer.setAnimationLoop(() => {
      // Smooth mouse follow
      uniforms.iMouse.value.x += (targetX - uniforms.iMouse.value.x) * 0.05;
      uniforms.iMouse.value.y += (targetY - uniforms.iMouse.value.y) * 0.05;

      // Smoothly interpolate theme mode and pause state
      uniforms.themeMode.value += (targetValuesRef.current.themeMode - uniforms.themeMode.value) * 0.02;
      uniforms.isPaused.value += (targetValuesRef.current.isPaused - uniforms.isPaused.value) * 0.04;

      const timeScale = 0.8 - (0.6 * uniforms.isPaused.value); // Slower when paused
      uniforms.iTime.value += clock.getDelta() * timeScale;

      renderer.render(scene, camera);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.setAnimationLoop(null);
      container.removeChild(renderer.domElement);
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}
