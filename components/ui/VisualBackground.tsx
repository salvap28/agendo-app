"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface VisualBackgroundProps {
    className?: string;
    mode?: "auto" | "static" | "animated";
}

const vertexShaderSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_scroll_intensity;

  // Simple noise for subtle texture
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0;
    return mix(mix(hash(n+0.0), hash(n+1.0),f.x),
               mix(hash(n+57.0), hash(n+58.0),f.x),f.y);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Dynamic params
    float time = u_time * 0.05;
    float scroll = u_scroll_intensity;
    
    // Geometry
    float dist = length(uv);
    float angle = atan(uv.y, uv.x); // -PI to PI
    
    // Eclipse Properties
    float radius = 0.38; // Base radius
    float thickness = 0.002; // Very thin core ring
    
    // Crescent Masking Logic
    // We want full intensity at -PI/2 (bottom) and 0 intensity at PI/2 (top)
    // Rotate angle by 90 deg (PI/2) so bottom becomes 0 or PI
    // Let's use dot product with (0, -1) [bottom vector]
    // dot(uv_norm, down) -> 1 at bottom, -1 at top
    float angleBias = dot(normalize(uv), vec2(0.0, -1.0));
    
    // Sharp cutoff at the top?
    // Remap -1..1 to 0..1, but apply a curve so top is really 0
    // bias + 0.2 means it starts fading before the halfway point
    float crescent = smoothstep(-0.2, 1.0, angleBias);
    
    // Power curve to pinch the crescent (make it thinner angularly)
    crescent = pow(crescent, 4.0); // Higher power = strictly bottom only
    
    // Distance Field
    float d = abs(dist - radius);
    
    // 1. Core Ring (Sharp)
    float core = smoothstep(thickness, 0.0, d);
    
    // 2. Glow (Atmosphere)
    // Physical falloff 1 / d^2 for real light source look? 
    // Or 1/d for standard glow. Try hybrid.
    float glow = 0.004 / (d + 0.0005);
    glow = pow(glow, 1.2); // Tweak falloff
    
    // Apply crescent mask to EVERYTHING
    // Top part must be black.
    float totalIntensity = (core + glow) * crescent;
    
    // Scroll interaction: Boost brightness and slight expansion
    totalIntensity *= (0.8 + scroll * 1.5);
    
    // Colors - Photorealistic / High Dynamic Range illusion
    // Start with black
    vec3 color = vec3(0.0);
    
    // Spectrum mapping based on energy (intensity)
    // Low energy: Deep Blue/Violet
    // Mid energy: Electric Blue/Cyan
    // High energy: White
    
    vec3 deepColor = vec3(0.05, 0.0, 0.2); // Deep violet background glow
    vec3 midColor = vec3(0.3, 0.1, 0.9);   // Electric Violet/Blue
    vec3 hotColor = vec3(0.8, 0.9, 1.0);   // White hot center
    
    // Gradient
    // Use power curves to map intensity to color stops
    color = mix(color, deepColor, smoothstep(0.0, 0.2, totalIntensity));
    color = mix(color, midColor, smoothstep(0.2, 0.6, totalIntensity));
    color = mix(color, hotColor, smoothstep(0.6, 1.5, totalIntensity)); // Allows "over-bright" washout to white

    // Add noise texture to the glow for "plasma/atmosphere" feel
    // Only visible in the mid-tones
    float noiseVal = noise(uv * 8.0 - vec2(0.0, time));
    color += midColor * noiseVal * 0.05 * totalIntensity;

    // Strict black center hole (The Moon)
    // Allow slight bleed but cut sharply
    // The "Moon" is the radius.
    float moonMask = smoothstep(radius - 0.02, radius + 0.02, dist);
    // Actually, physically, the glow comes from behind, so it should bleed INTO the center slightly?
    // Reference shows a sharp inner edge on the crescent usually.
    // Let's mask the inner part of the ring slightly more to make it look like it's behind a sphere
    if(dist < radius) {
        color *= smoothstep(radius - 0.1, radius, dist);
    }
    
    // Final tone mapping
    // Simple exposure
    color = vec3(1.0) - exp(-color * 1.5); // Tone map to [0,1]
    
    // Global vignette to fade edges to pure black
    color *= smoothstep(1.5, 0.5, dist);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function VisualBackground({ className, mode = "auto" }: VisualBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>(0);
    const scrollRef = useRef<number>(0);
    const programRef = useRef<WebGLProgram | null>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);

    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [forcedColors, setForcedColors] = useState(false);

    useEffect(() => {
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const forcedColorsQuery = window.matchMedia("(forced-colors: active)");
        const updatePrefs = () => {
            setPrefersReducedMotion(motionQuery.matches);
            setForcedColors(forcedColorsQuery.matches);
        };
        updatePrefs();
        motionQuery.addEventListener("change", updatePrefs);
        forcedColorsQuery.addEventListener("change", updatePrefs);
        return () => {
            motionQuery.removeEventListener("change", updatePrefs);
            forcedColorsQuery.removeEventListener("change", updatePrefs);
        };
    }, []);

    useEffect(() => {
        if (forcedColors) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl");
        if (!gl) return;
        glRef.current = gl;

        const compileShader = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const createProgram = (vsSource: string, fsSource: string) => {
            const vs = compileShader(gl.VERTEX_SHADER, vsSource);
            const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
            if (!vs || !fs) return null;
            const program = gl.createProgram();
            if (!program) return null;
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            return program;
        };

        const program = createProgram(vertexShaderSource, fragmentShaderSource);
        if (!program) return;
        programRef.current = program;

        const positionAttributeLocation = gl.getAttribLocation(program, "position");
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

        const timeLocation = gl.getUniformLocation(program, "u_time");
        const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        const scrollLocation = gl.getUniformLocation(program, "u_scroll_intensity");

        let startTime = performance.now();

        const render = (now: number) => {
            if (!canvas || !gl || !program) return;

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }

            gl.useProgram(program);
            gl.enableVertexAttribArray(positionAttributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

            const shouldAnimate = mode === "animated" || (mode === "auto" && !prefersReducedMotion);
            const timeValue = shouldAnimate ? (now - startTime) * 0.001 : 0;

            gl.uniform1f(timeLocation, timeValue);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform1f(scrollLocation, scrollRef.current);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            if (shouldAnimate) {
                animationRef.current = requestAnimationFrame(render);
            }
        };

        animationRef.current = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationRef.current);
            if (programRef.current && glRef.current) {
                glRef.current.deleteProgram(programRef.current);
            }
        };
    }, [prefersReducedMotion, forcedColors, mode]);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            // Sensitivity for scroll reaction
            const maxScroll = 1200;
            const progress = Math.min(scrollY / maxScroll, 1.0);
            scrollRef.current = progress;
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (forcedColors) return null;

    return (
        <div
            ref={containerRef}
            className={cn("fixed inset-0 -z-30 h-full w-full bg-[#000000] pointer-events-none", className)}
        >
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
    );
}
