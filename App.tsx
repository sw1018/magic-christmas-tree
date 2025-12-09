import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import HandTracker from './components/HandTracker';
import ParticleScene from './components/ParticleScene';
import Overlay from './components/Overlay';

const App: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-gray-900">
      
      {/* 3D Canvas */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 12], fov: 60 }}
        gl={{ antialias: false, alpha: false }} // Post-processing handles AA usually, better perf
      >
        <color attach="background" args={['#050510']} />
        
        <Suspense fallback={null}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <ParticleScene />
            
            <Environment preset="night" />
            
            {/* Effects */}
            <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} radius={0.6} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
        </Suspense>

        <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={5} 
            maxDistance={20}
            autoRotate={false} 
        />
      </Canvas>

      {/* Hand Tracking Logic (Invisible mostly) */}
      <HandTracker />

      {/* UI Overlay */}
      <Overlay />
      
    </div>
  );
};

export default App;