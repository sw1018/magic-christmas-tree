import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float, Trail, Stars, Billboard, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { HandState, useStore, PhotoData } from '../store';

// Emojis for texture generation - Strictly these icons
const EMOJIS = ['❄️', '🎁', '🧦', '🔔', '🎅'];
const DECORATION_COUNT = 150; // Reduced to 150
const CORE_PARTICLE_COUNT = 8000; // Kept at 8000
const GOLD_PARTICLE_COUNT = 400; // Reduced to 400
const LANTERN_COUNT = 10; // Reduced to 10
const SPIRAL_GOLD_COUNT = 100; // New: Gold particles for the ribbon

// Helper to create emoji textures
function createEmojiTexture(emoji: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '90px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white'; // Base color for reflectivity
    ctx.fillText(emoji, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// --- The Golden Star Component ---
const TopStar = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    const starShape = useMemo(() => {
        const shape = new THREE.Shape();
        const points = 5;
        const outerRadius = 0.8;
        const innerRadius = 0.4;
        
        for (let i = 0; i < points * 2; i++) {
            const r = (i % 2 === 0) ? outerRadius : innerRadius;
            const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2; // Rotate to point up
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
        return shape;
    }, []);

    const extrudeSettings = useMemo(() => ({
        depth: 0.2,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.05,
        bevelSegments: 2
    }), []);

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
            // bobbing motion
            meshRef.current.position.y = 6.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
        }
    });

    return (
        <group>
            <mesh ref={meshRef} position={[0, 6.5, 0]}>
                <extrudeGeometry args={[starShape, extrudeSettings]} />
                <meshStandardMaterial 
                    color="#FFD700" 
                    emissive="#FFD700" 
                    emissiveIntensity={2} 
                    roughness={0.1} 
                    metalness={0.8} 
                />
            </mesh>
            <pointLight position={[0, 6.5, 0]} color="#ffaa00" intensity={3} distance={10} decay={2} />
        </group>
    );
};

// --- Green Core Particle Component ---
// These form the volume of the tree
interface GreenParticleProps {
  index: number;
  total: number;
  handState: HandState;
}

const GreenParticle: React.FC<GreenParticleProps> = ({ index, total, handState }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetPos = useRef(new THREE.Vector3());
    const initialPos = useRef(new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10));
    
    // Emerald / Bright Green variations
    const color = useMemo(() => {
        const greens = ['#10b981', '#34d399', '#6ee7b7', '#00ff9d', '#50c878']; 
        return greens[Math.floor(Math.random() * greens.length)];
    }, []);

    // Tree Body Logic (Cone Volume)
    const treePos = useMemo(() => {
        const height = 10; // Total tree height
        const baseRadius = 3.8; 
        
        // Random height between -4 and 6
        const y = -4 + Math.random() * height;
        
        // Radius at this height (linear taper)
        const radiusAtY = ((6 - y) / height) * baseRadius;
        
        // Random position within circle at this height (volume filling)
        const r = Math.sqrt(Math.random()) * radiusAtY; 
        const theta = Math.random() * Math.PI * 2;
        
        return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        if (handState === HandState.CLOSED) {
            // Form the solid tree body
            targetPos.current.copy(treePos);
        } else if (handState === HandState.OPEN || handState === HandState.UNKNOWN) {
            // Scatter
            const time = state.clock.getElapsedTime();
            const theta = (index / total) * Math.PI * 2;
            const scatterRadius = 8;
            const xS = Math.cos(theta + time * 0.1) * scatterRadius;
            const zS = Math.sin(theta + time * 0.1) * scatterRadius;
            const yS = treePos.y + Math.sin(time + index) * 4;
            targetPos.current.set(xS, yS, zS);
        } else if (handState === HandState.PINCH) {
            // Gentle float
            targetPos.current.y += Math.sin(state.clock.getElapsedTime() + index) * 0.005;
        }

        const lerpSpeed = handState === HandState.PINCH ? 1 : 2.5; 
        meshRef.current.position.lerp(targetPos.current, delta * lerpSpeed);
        
        // Subtle rotation
        meshRef.current.rotation.x += delta * 1.0;
        meshRef.current.rotation.z += delta * 1.0;
    });

    return (
        <mesh ref={meshRef} position={initialPos.current}>
            {/* Extremely small Sphere Geometry for fine detail */}
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={1.2} // Bright glow
                roughness={0.2}
                toneMapped={false}
            />
        </mesh>
    );
};

// --- Gold Sparkle Particle Component (Random Volume) ---
const GoldParticle: React.FC<{ index: number; total: number; handState: HandState }> = ({ index, total, handState }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetPos = useRef(new THREE.Vector3());
    const initialPos = useRef(new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10));
    
    // Blink speed randomizer
    const blinkSpeed = useMemo(() => 2 + Math.random() * 5, []);

    // Tree Body Logic (Cone Volume) - Similar to green but interspersed
    const treePos = useMemo(() => {
        const height = 10; 
        const baseRadius = 3.9; // Slightly wider
        const y = -4 + Math.random() * height;
        const radiusAtY = ((6 - y) / height) * baseRadius;
        const r = Math.sqrt(Math.random()) * radiusAtY; 
        const theta = Math.random() * Math.PI * 2;
        return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
    }, []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        if (handState === HandState.CLOSED) {
            targetPos.current.copy(treePos);
        } else if (handState === HandState.OPEN || handState === HandState.UNKNOWN) {
            const time = state.clock.getElapsedTime();
            const theta = (index / total) * Math.PI * 2;
            const scatterRadius = 12;
            const xS = Math.cos(theta + time * 0.15) * scatterRadius;
            const zS = Math.sin(theta + time * 0.15) * scatterRadius;
            const yS = treePos.y + Math.sin(time + index) * 4;
            targetPos.current.set(xS, yS, zS);
        } else if (handState === HandState.PINCH) {
            targetPos.current.y += Math.sin(state.clock.getElapsedTime() + index) * 0.005;
        }

        const lerpSpeed = handState === HandState.PINCH ? 1 : 2.0; 
        meshRef.current.position.lerp(targetPos.current, delta * lerpSpeed);
        
        // Blink Animation
        const time = state.clock.elapsedTime;
        const blink = 0.5 + Math.abs(Math.sin(time * blinkSpeed + index)) * 2.0;
        
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = blink;
        mat.opacity = 0.7 + Math.sin(time * blinkSpeed) * 0.3;
    });

    return (
        <mesh ref={meshRef} position={initialPos.current}>
            {/* Smaller diamond shape size reduced from 0.08 to 0.05 */}
            <planeGeometry args={[0.05, 0.05]} />
            <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700"
                toneMapped={false}
                transparent
                roughness={0.1}
            />
        </mesh>
    );
};

// --- Spiral Gold Particle Component (Ribbon) ---
const SpiralGoldParticle: React.FC<{ index: number; total: number; handState: HandState }> = ({ index, total, handState }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const targetPos = useRef(new THREE.Vector3());
    const initialPos = useRef(new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10));
    
    // Blink speed randomizer
    const blinkSpeed = useMemo(() => 3 + Math.random() * 5, []);

    // Spiral Logic (Follows decoration ribbon)
    const spiralConfig = useMemo(() => {
        const t = index / total; 
        const height = 10;
        const y = 6 - (t * height); 
        const radius = ((6 - y) / height) * 4.6; // Intermixed with decorations (4.5)
        const rotations = 6;
        const theta = t * Math.PI * 2 * rotations + Math.PI; // Phase shift
        return { y, radius, theta };
    }, [index, total]);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        if (handState === HandState.CLOSED) {
            const time = state.clock.getElapsedTime();
            const spin = time * 0.2;
            const x = spiralConfig.radius * Math.cos(spiralConfig.theta + spin);
            const z = spiralConfig.radius * Math.sin(spiralConfig.theta + spin);
            targetPos.current.set(x, spiralConfig.y, z);
        } else if (handState === HandState.OPEN || handState === HandState.UNKNOWN) {
             const time = state.clock.getElapsedTime();
             const scatterRadius = 13;
             const theta = (index / total) * Math.PI * 18;
             const xS = Math.cos(theta + time * 0.3) * scatterRadius;
             const zS = Math.sin(theta + time * 0.3) * scatterRadius;
             const yS = spiralConfig.y + Math.sin(time + index) * 5;
             targetPos.current.set(xS, yS, zS);
        } else if (handState === HandState.PINCH) {
             targetPos.current.y += Math.sin(state.clock.getElapsedTime() * 2 + index) * 0.01;
        }

        const lerpSpeed = handState === HandState.PINCH ? 1 : 1.8;
        meshRef.current.position.lerp(targetPos.current, delta * lerpSpeed);
        
        // Blink Animation
        const time = state.clock.elapsedTime;
        const blink = 0.5 + Math.abs(Math.sin(time * blinkSpeed + index)) * 2.0;
        
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = blink;
        mat.opacity = 0.6 + Math.sin(time * blinkSpeed) * 0.4;
    });

    return (
        <mesh ref={meshRef} position={initialPos.current}>
            <planeGeometry args={[0.05, 0.05]} />
            <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700"
                toneMapped={false}
                transparent
                roughness={0.1}
            />
        </mesh>
    );
};

// --- Lantern Particle Component (Spiral) ---
const LanternParticle: React.FC<{ index: number; total: number; handState: HandState }> = ({ index, total, handState }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3());
  const initialPos = useRef(new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10));
  
  // Spiral Logic (Interspersed with ribbons)
  const spiralConfig = useMemo(() => {
      const t = index / total; 
      const height = 10;
      const y = 6 - (t * height); 
      const radius = ((6 - y) / height) * 4.8; // Slightly outside decorations
      const rotations = 6;
      // Offset theta so they don't overlap perfectly with emojis
      const theta = t * Math.PI * 2 * rotations + 0.5; 
      return { y, radius, theta };
  }, [index, total]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (handState === HandState.CLOSED) {
      const time = state.clock.getElapsedTime();
      const spin = time * 0.2;
      const x = spiralConfig.radius * Math.cos(spiralConfig.theta + spin);
      const z = spiralConfig.radius * Math.sin(spiralConfig.theta + spin);
      targetPos.current.set(x, spiralConfig.y, z);
    } else if (handState === HandState.OPEN || handState === HandState.UNKNOWN) {
        const time = state.clock.getElapsedTime();
        const scatterRadius = 14;
        const theta = (index / total) * Math.PI * 18;
        const xS = Math.cos(theta + time * 0.4) * scatterRadius;
        const zS = Math.sin(theta + time * 0.4) * scatterRadius;
        const yS = spiralConfig.y + Math.sin(time + index) * 6;
        targetPos.current.set(xS, yS, zS);
    } else if (handState === HandState.PINCH) {
         targetPos.current.y += Math.sin(state.clock.getElapsedTime() * 2 + index) * 0.01;
    }

    const lerpSpeed = handState === HandState.PINCH ? 1 : 1.5;
    meshRef.current.position.lerp(targetPos.current, delta * lerpSpeed);
    
    // Gentle swing for lanterns
    meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2 + index) * 0.2;
    meshRef.current.rotation.y += delta;
  });

  return (
    <mesh ref={meshRef} position={initialPos.current}>
      {/* Lantern shape: Cylinder */}
      <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
      <meshStandardMaterial 
        color="#ff0000" 
        emissive="#ff0000"
        emissiveIntensity={2.0}
        toneMapped={false}
        roughness={0.2}
      />
    </mesh>
  );
};

// --- Decoration Particle Component (Updated Emojis & Glow) ---
interface DecorationParticleProps {
  texture: THREE.Texture;
  color: string;
  handState: HandState;
  index: number;
  total: number;
}

const DecorationParticle: React.FC<DecorationParticleProps> = ({ texture, color, handState, index, total }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3());
  const initialPos = useRef(new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10));
  
  // Spiral Ribbon Logic
  const spiralConfig = useMemo(() => {
      const t = index / total; 
      
      const height = 10;
      const y = 6 - (t * height); 
      
      const radius = ((6 - y) / height) * 4.5;
      
      const rotations = 6;
      const theta = t * Math.PI * 2 * rotations;
      
      return { y, radius, theta };
  }, [index, total]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (handState === HandState.CLOSED) {
      // Form Ribbon Spiral
      const time = state.clock.getElapsedTime();
      const spin = time * 0.2;
      
      const x = spiralConfig.radius * Math.cos(spiralConfig.theta + spin);
      const z = spiralConfig.radius * Math.sin(spiralConfig.theta + spin);
      
      targetPos.current.set(x, spiralConfig.y, z);
      
    } else if (handState === HandState.OPEN || handState === HandState.UNKNOWN) {
        // Explode OUTWARDS
        const time = state.clock.getElapsedTime();
        const scatterRadius = 10;
        const theta = (index / total) * Math.PI * 18;
        const xS = Math.cos(theta + time * 0.5) * scatterRadius;
        const zS = Math.sin(theta + time * 0.5) * scatterRadius;
        const yS = spiralConfig.y + Math.sin(time + index) * 5;
        targetPos.current.set(xS, yS, zS);
    } else if (handState === HandState.PINCH) {
         // Freeze / Slow Drift
         targetPos.current.y += Math.sin(state.clock.getElapsedTime() * 2 + index) * 0.01;
    }

    const lerpSpeed = handState === HandState.PINCH ? 1 : 2.0;
    meshRef.current.position.lerp(targetPos.current, delta * lerpSpeed);
    
    // Always face camera for 2D sprites look
    meshRef.current.lookAt(0, 0, 20); 
    
    // Scale pulse
    meshRef.current.scale.setScalar(0.5 + Math.sin(state.clock.elapsedTime * 3 + index) * 0.1);
  });

  return (
    <mesh ref={meshRef} position={initialPos.current}>
      {/* Use only PlaneGeometry so we see ONLY the emoji texture, no cubes/spheres */}
      <planeGeometry args={[0.7, 0.7]} />
      
      <meshStandardMaterial 
        map={texture} 
        color={color}
        transparent 
        alphaTest={0.5} 
        side={THREE.DoubleSide}
        metalness={0.6} 
        roughness={0.2}
        emissive={color}
        emissiveIntensity={0.8} // Reduced from 1.5 to 0.8
        toneMapped={false}
      />
    </mesh>
  );
};

// Photo Component (The ones grabbed from the tree)
interface FloatingPhotoProps {
  photo: PhotoData;
  isActive: boolean;
  index: number;
  handState: HandState;
}

const FloatingPhoto: React.FC<FloatingPhotoProps> = ({ photo, isActive, index, handState }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const texture = useMemo(() => new THREE.TextureLoader().load(photo.url), [photo.url]);
    
    const randomPos = useMemo(() => {
        const theta = Math.random() * Math.PI * 2;
        const y = -3 + Math.random() * 8;
        const r = (1 - (y + 4) / 10) * 5.0; 
        return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
    }, []);

    const [transitionType] = useState(() => Math.floor(Math.random() * 3));

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        if (isActive && handState === HandState.PINCH) {
            const target = new THREE.Vector3(0, 0, 5); 
            const t = state.clock.getElapsedTime();
            if (transitionType === 1) { 
                target.x += Math.cos(t * 10) * 0.5;
                target.y += Math.sin(t * 10) * 0.5;
            } else if (transitionType === 2) { 
                 target.y += Math.abs(Math.sin(t * 5)) * 0.5;
            }

            meshRef.current.position.lerp(target, delta * 4);
            meshRef.current.rotation.set(0, 0, 0); 
            meshRef.current.scale.lerp(new THREE.Vector3(3, 3, 3), delta * 3); 
        } else {
             let target = randomPos.clone();
             
             if (handState === HandState.OPEN) {
                 const time = state.clock.getElapsedTime();
                 const xS = Math.cos(time * 0.2 + index) * 8;
                 const zS = Math.sin(time * 0.2 + index) * 8;
                 target.set(xS, target.y, zS);
             } 

             meshRef.current.position.lerp(target, delta * 2);
             meshRef.current.lookAt(0, 0, 20); 
             meshRef.current.scale.lerp(new THREE.Vector3(0.8, 0.8, 0.8), delta * 2);
        }
    });

    return (
        <RoundedBox 
            ref={meshRef} 
            position={randomPos}
            args={[1, 1, 0.05]} 
            radius={0.05} 
            smoothness={4}
        >
            <meshStandardMaterial 
                map={texture} 
                emissiveMap={texture}
                emissive="white"
                // Intensity: 0.6 when active (Increased from 0.4) for better visibility without overexposure
                // 0.25 when inactive
                emissiveIntensity={isActive ? 0.6 : 0.25}
                toneMapped={true}
                roughness={0.8}
            />
        </RoundedBox>
    );
}


const ParticleScene: React.FC = () => {
  const handState = useStore((state) => state.handState);
  const photos = useStore((state) => state.photos);
  const activePhotoId = useStore((state) => state.activePhotoId);
  const cycleNextPhoto = useStore((state) => state.cycleNextPhoto);
  const nextPhotoIndex = useStore((state) => state.nextPhotoIndex);
  const setActivePhotoId = useStore((state) => state.setActivePhotoId);

  // Generate textures once
  const textures = useMemo(() => EMOJIS.map(createEmojiTexture), []);
  const colors = useMemo(() => ['#ff0000', '#00ff00', '#ffffff', '#gold', '#4287f5'], []);

  // Handle Pinch Logic for Photos
  useEffect(() => {
      if (handState === HandState.PINCH && photos.length > 0) {
          const photoToShow = photos[nextPhotoIndex];
          if (photoToShow) {
            setActivePhotoId(photoToShow.id);
          }
      } else {
          setActivePhotoId(null);
          if (handState === HandState.UNKNOWN) {
          } else if (activePhotoId !== null) {
              cycleNextPhoto();
          }
      }
  }, [handState, photos, nextPhotoIndex, cycleNextPhoto, setActivePhotoId]); 

  return (
    <group>
      {/* 1. Green Core Particles (The Body) */}
      {Array.from({ length: CORE_PARTICLE_COUNT }).map((_, i) => (
          <GreenParticle 
            key={`core-${i}`}
            index={i}
            total={CORE_PARTICLE_COUNT}
            handState={handState}
          />
      ))}
      
      {/* 2. Gold Sparkle Particles (Volume) */}
      {Array.from({ length: GOLD_PARTICLE_COUNT }).map((_, i) => (
          <GoldParticle 
            key={`gold-${i}`}
            index={i}
            total={GOLD_PARTICLE_COUNT}
            handState={handState}
          />
      ))}

      {/* 3. Gold Spiral Particles (Ribbon) - NEW */}
      {Array.from({ length: SPIRAL_GOLD_COUNT }).map((_, i) => (
          <SpiralGoldParticle
            key={`spiral-gold-${i}`}
            index={i}
            total={SPIRAL_GOLD_COUNT}
            handState={handState}
          />
      ))}

      {/* 4. Lantern Particles (Spiral Band) */}
      {Array.from({ length: LANTERN_COUNT }).map((_, i) => (
          <LanternParticle
            key={`lantern-${i}`}
            index={i}
            total={LANTERN_COUNT}
            handState={handState}
          />
      ))}

      {/* 5. Decoration Particles (The Ornaments/Gifts/Emojis) */}
      {Array.from({ length: DECORATION_COUNT }).map((_, i) => (
        <DecorationParticle 
            key={`deco-${i}`} 
            index={i} 
            total={DECORATION_COUNT} 
            handState={handState}
            texture={textures[i % textures.length]}
            color={colors[i % colors.length]}
        />
      ))}

      {/* 6. Photos */}
      {photos.map((photo, i) => (
          <FloatingPhoto 
            key={photo.id}
            photo={photo}
            index={i}
            isActive={photo.id === activePhotoId}
            handState={handState}
          />
      ))}

      {/* 7. Golden Star */}
      <TopStar />

      {/* Ambient Fill */}
      <ambientLight intensity={0.3} />
    </group>
  );
};

export default ParticleScene;