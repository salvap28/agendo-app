"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

interface BackgroundEclipseProps {
    className?: string;
    onLoaded?: () => void;
}

// Final Production Configuration (User Calibrated v24)
const CONFIG = {
    // Colors
    colorBase: "#020205",
    colorHalo: "#7c3aed",
    colorAtmosphere: "#581c87",
    colorHot: "#e9d5ff",

    // Camera Parallax
    camY_start: 0,
    camY_end: -1.3,
    camZ_start: 21,
    camZ_end: 10,

    // Planet Position
    planetY_start: 9,
    planetY_end: 5.2,

    // Sun Physics (Reveal)
    sunY_start: -5.5,
    sunY_end: -4,

    // Add Central Glow (The Void)
    bgGlowColor: "rgba(124, 58, 237, 0.15)", // Very subtle Violet 

    // Aura (Atmosphere Fade In)
    auraOp_start: 0.0,
    auraOp_end: 0.2,

    // Flare (Anamorphic Streak)
    flareOp_start: 0.45,
    flareOp_end: 0.0,
    flareY_offset: 0.0,
    flareZ_pos: -1.0,

    // DUAL BLOOM SETTINGS
    bloomCoreStr: 0.3,
    bloomCoreRad: 0.2,
    bloomCoreThresh: 0.5,
    bloomAuraStr: 0.1,
    bloomAuraRad: 0.3,
    bloomAuraThresh: 0.0,
};

export function BackgroundEclipse({ className, onLoaded }: BackgroundEclipseProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG.colorBase);
        scene.fog = new THREE.FogExp2(CONFIG.colorBase, 0.02);

        const width = window.innerWidth;
        const height = window.innerHeight;

        const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
        camera.position.set(0, CONFIG.camY_start, CONFIG.camZ_start);
        camera.lookAt(0, 5, 0);

        const renderer = new THREE.WebGLRenderer({
            powerPreference: "high-performance",
            antialias: false,
            stencil: false,
            depth: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        containerRef.current.appendChild(renderer.domElement);

        // --- Objects ---

        // 1. Planet (Smoked Glass Aesthetic - Premium Minimal Tech)
        const planetRadius = 7.0;
        const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);

        // Setup Studio Lights (Removed PointLights to avoid sharp specular dots. Using soft ambient to preserve dark glass volume)
        const ambientLight = new THREE.AmbientLight(CONFIG.colorHalo, 0.5);
        scene.add(ambientLight);

        const planetMat = new THREE.MeshPhysicalMaterial({
            color: "#050508", // Very dark core
            metalness: 0.9,   // High reflection
            roughness: 0.6,   // Diffused surface
            clearcoat: 0.1,   // Minimal glass coat
            clearcoatRoughness: 0.8,
            envMapIntensity: 1.0
        });
        const planet = new THREE.Mesh(planetGeo, planetMat);
        planet.position.set(0, CONFIG.planetY_start, 0);
        scene.add(planet);

        // Dithering Chunk
        const ditheringChunk = `
      float random(vec2 uv) {
        return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      vec3 dither(vec3 color, vec2 uv) {
        float noise = random(uv) * 0.02; 
        return color + vec3(noise);
      }
    `;

        // 2. CORE RING
        const coreGeo = new THREE.SphereGeometry(planetRadius + 0.1, 128, 128);
        const coreUniforms = {
            uColor: { value: new THREE.Color(CONFIG.colorHalo) },
            uColorHot: { value: new THREE.Color(CONFIG.colorHot) },
            uIntensity: { value: 1.0 },
            uSunPosition: { value: new THREE.Vector3(0, CONFIG.sunY_start, -10) },
        };

        const coreMat = new THREE.ShaderMaterial({
            uniforms: coreUniforms,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
            vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uColorHot;
        uniform float uIntensity;
        uniform vec3 uSunPosition;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        
        ${ditheringChunk}

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(uSunPosition); 

          float dotNV = dot(normal, viewDir);
          float baseFresnel = 1.0 - abs(dotNV);
          baseFresnel = max(0.0, baseFresnel);

          float fresnelR = pow(baseFresnel, 1.0);
          float fresnelG = pow(baseFresnel, 1.05); 
          float fresnelB = pow(baseFresnel, 1.1);  

          float sunDot = dot(normal, sunDir);
          float sunMask = smoothstep(-0.4, 0.6, sunDot);
          float thicknessFactor = max(0.0, sunDot); 
          thicknessFactor = pow(thicknessFactor, 1.5);
          float minFresnel = mix(0.99, 0.4, thicknessFactor);
          
          float r = smoothstep(minFresnel, 1.0, fresnelR);
          float g = smoothstep(minFresnel, 1.0, fresnelG);
          float b = smoothstep(minFresnel, 1.0, fresnelB);
          
          vec3 rimColor = vec3(r, g, b);
          rimColor *= sunMask;
          
          float hotspot = pow(g * sunMask, 3.0) * 4.0;
          
          vec3 baseMix = uColor * rimColor; 
          vec3 finalColor = mix(baseMix, uColorHot, clamp(hotspot * 0.6, 0.0, 1.0));
          finalColor += uColorHot * hotspot * 0.5;

          finalColor = dither(finalColor, gl_FragCoord.xy);
          float alpha = r * uIntensity;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(planet.position);
        scene.add(core);

        // 3. AURA
        const auraGeo = new THREE.PlaneGeometry(40, 40);
        const auraUniforms = {
            uColor: { value: new THREE.Color(CONFIG.colorAtmosphere) },
            uIntensity: { value: 0.0 },
            uTime: { value: 0.0 },
        };

        const auraMat = new THREE.ShaderMaterial({
            uniforms: auraUniforms,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        ${ditheringChunk}
        float niceNoise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center * vec2(1.0, 0.8)) * 2.0; 
          float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
          alpha = pow(alpha, 1.5); 
          
          float n = niceNoise(vUv * 5.0 + vec2(0.0, uTime * 0.05));
          float organic = 0.98 + 0.04 * n; 
          alpha *= organic;

          vec3 color = dither(uColor, gl_FragCoord.xy);
          gl_FragColor = vec4(color, alpha * uIntensity);
        }
      `,
        });
        const aura = new THREE.Mesh(auraGeo, auraMat);
        aura.position.set(0, CONFIG.planetY_start, -2.0);
        scene.add(aura);

        // 4. FLARE
        const flareGeo = new THREE.PlaneGeometry(30, 2);
        const flareUniforms = {
            uColor: { value: new THREE.Color(CONFIG.colorHot) },
            uOpacity: { value: CONFIG.flareOp_start },
        };
        const flareMat = new THREE.ShaderMaterial({
            uniforms: flareUniforms,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
            fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv - 0.5;
          float hFunc = 0.05 / (abs(uv.x * 1.0) + 0.02); 
          float vFunc = exp(-pow(uv.y * 40.0, 2.0));   
          float arms = hFunc * vFunc;
          
          float coreDist = length(uv * vec2(1.0, 2.0)); 
          float core = exp(-coreDist * 15.0); 

          float alpha = (arms * 0.6 + core * 2.0) * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
        });
        const flare = new THREE.Mesh(flareGeo, flareMat);
        flare.position.set(0, CONFIG.planetY_start - planetRadius + CONFIG.flareY_offset, CONFIG.flareZ_pos);
        scene.add(flare);

        // 5. STARFIELD (Distant Parallax)
        const starsCount = 1200;
        const starsGeometry = new THREE.BufferGeometry();
        const posArray = new Float32Array(starsCount * 3);
        const opacities = new Float32Array(starsCount);

        for (let i = 0; i < starsCount * 3; i += 3) {
            // Spread widely across X and Y, and push deep into negative Z
            posArray[i] = (Math.random() - 0.5) * 200;      // X bounds
            posArray[i + 1] = (Math.random() - 0.5) * 200;  // Y bounds
            posArray[i + 2] = -(Math.random() * 100 + 40);  // Z from -40 to -140 (Very far)

            // Random opacity for twinkling illusion
            opacities[i / 3] = Math.random() * 0.4 + 0.1;
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

        const starsUniforms = {
            uTime: { value: 0.0 }
        };

        const starsMat = new THREE.ShaderMaterial({
            uniforms: starsUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                attribute float aOpacity;
                varying float vOpacity;
                varying vec3 vPos;
                void main() {
                    vOpacity = aOpacity;
                    vPos = position;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // Perspective size: distant stars are smaller and sharper
                    gl_PointSize = (2.0 / -mvPosition.z) * 50.0;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying float vOpacity;
                varying vec3 vPos;
                
                // Pseudo-random noise
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    // Sharper circular point (less blurred)
                    float baseAlpha = (1.0 - smoothstep(0.2, 0.45, dist)) * vOpacity;
                    
                    float seed = random(vPos.xy);
                    
                    // Breathing effect (sine wave offset by seed)
                    float breathe = (sin(uTime * 1.5 + seed * 20.0) * 0.5 + 0.5) * 0.5 + 0.5; // Oscillates 0.5 to 1.0
                    
                    // Blinking effect (occasional bright flash)
                    float blinkPhase = sin(uTime * 0.8 + seed * 50.0);
                    float blink = smoothstep(0.99, 1.0, blinkPhase); // Only flashes at peak phase
                    
                    float finalAlpha = baseAlpha * breathe + blink * 1.0;
                    // Scale color down so it doesn't trigger the Post-Processing Bloom (the violet halos)
                    gl_FragColor = vec4(0.6, 0.6, 0.65, finalAlpha * 0.5); 
                }
            `
        });

        const starfield = new THREE.Points(starsGeometry, starsMat);
        scene.add(starfield);

        // --- Post Processing ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomCore = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            CONFIG.bloomCoreStr,
            CONFIG.bloomCoreRad,
            CONFIG.bloomCoreThresh
        );
        composer.addPass(bloomCore);

        const bloomAura = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            CONFIG.bloomAuraStr,
            CONFIG.bloomAuraRad,
            CONFIG.bloomAuraThresh
        );
        composer.addPass(bloomAura);

        // --- Animation ---
        const state = {
            scrollY: 0,
            targetScroll: 0,
            currentScroll: 0,
        };
        const clock = new THREE.Clock();

        const easeInOutCubic = (x: number): number => {
            return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        };

        const handleScroll = () => {
            const container = document.getElementById("main-scroll-container");
            state.scrollY = container ? container.scrollTop : window.scrollY;
        };

        // Wait a tick for the container to be fully available
        setTimeout(() => {
            const scrollTarget = document.getElementById("main-scroll-container") || window;
            scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
        }, 0);

        let currentW = window.innerWidth;
        let currentH = window.innerHeight;

        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            const isMobile = w <= 768;
            const heightDiff = Math.abs(h - currentH);
            if (isMobile && w === currentW && heightDiff < 150) {
                return;
            }

            currentW = w;
            currentH = h;

            camera.aspect = w / h;
            if (w < h) {
                camera.fov = Math.min(Math.max(30 * (h / w) * 0.65, 30), 65);
            } else {
                camera.fov = 30;
            }
            camera.updateProjectionMatrix();

            renderer.setSize(w, h);
            composer.setSize(w, h);
            bloomCore.resolution.set(w, h);
            bloomAura.resolution.set(w, h);
        };

        handleResize();

        window.addEventListener("resize", handleResize);

        const animate = () => {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            const container = document.getElementById("main-scroll-container");
            const maxScroll = container
                ? Math.max(container.scrollHeight - container.clientHeight, 1)
                : Math.max(document.body.scrollHeight - window.innerHeight, 500);

            const rawProgress = Math.min(Math.max(state.scrollY / maxScroll, 0), 1);

            state.currentScroll += (rawProgress - state.currentScroll) * 0.05;
            const p = easeInOutCubic(state.currentScroll);

            // Camera
            camera.position.y = THREE.MathUtils.lerp(CONFIG.camY_start, CONFIG.camY_end, p);
            camera.position.z = THREE.MathUtils.lerp(CONFIG.camZ_start, CONFIG.camZ_end, p);

            // Planet
            const curPlanetY = THREE.MathUtils.lerp(CONFIG.planetY_start, CONFIG.planetY_end, p);
            planet.position.y = curPlanetY;
            core.position.y = curPlanetY;
            aura.position.y = curPlanetY;

            // Sun
            const curSunY = THREE.MathUtils.lerp(CONFIG.sunY_start, CONFIG.sunY_end, p);
            coreUniforms.uSunPosition.value.set(0, curSunY, -10);

            // Aura
            auraUniforms.uIntensity.value = THREE.MathUtils.lerp(CONFIG.auraOp_start, CONFIG.auraOp_end, p);
            auraUniforms.uTime.value = time;

            // Flare
            flare.position.set(0, curPlanetY - planetRadius + CONFIG.flareY_offset, CONFIG.flareZ_pos);
            flareUniforms.uOpacity.value = THREE.MathUtils.lerp(CONFIG.flareOp_start, CONFIG.flareOp_end, p);

            // Stars Time
            starsUniforms.uTime.value = time;

            composer.render();
        };

        animate();

        // Allow GPU time to compile shaders on the first frame before signaling readiness
        const loadTimer = setTimeout(() => {
            if (onLoaded) {
                onLoaded();
            }
        }, 150);

        return () => {
            clearTimeout(loadTimer);
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);
            containerRef.current?.removeChild(renderer.domElement);
            renderer.dispose();
            coreMat.dispose();
            coreGeo.dispose();
            auraMat.dispose();
            auraGeo.dispose();
            flareMat.dispose();
            flareGeo.dispose();
            planetMat.dispose();
            planetGeo.dispose();
            starsMat.dispose();
            starsGeometry.dispose();
            composer.dispose();

            const scrollTarget = document.getElementById("main-scroll-container") || window;
            scrollTarget.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return (
        <>
            <div
                ref={containerRef}
                className={`fixed inset-0 z-[-1] pointer-events-none ${className || ''}`}
                style={{ backgroundColor: CONFIG.colorBase }}
            >
                {/* Huge Central Blur (The Void Glow) */}
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] rounded-full pointer-events-none z-0"
                    style={{
                        background: `radial-gradient(circle, ${CONFIG.bgGlowColor} 0%, transparent 70%)`,
                        filter: "blur(120px)"
                    }}
                />
            </div>
            {/* 2px Blur Overlay */}
            <div
                className="fixed inset-0 z-[-1] pointer-events-none"
                style={{ backdropFilter: "blur(2px)" }}
            />
        </>
    );
}
