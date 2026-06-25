import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Orbe de agua: esfera ligeramente alargada con material de transmisión (refracción
// y brillo). Gira sola y se inclina suave hacia el cursor. El Environment usa
// Lightformers procedurales (sin HDRI externo) para que refleje sin pedir red.
function Orbe() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.y += delta * 0.4;
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, state.pointer.y * 0.3, 0.05);
    m.rotation.z = THREE.MathUtils.lerp(m.rotation.z, -state.pointer.x * 0.3, 0.05);
  });
  return (
    <mesh ref={ref} scale={[1.3, 1.5, 1.3]}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        thickness={1.2}
        roughness={0.05}
        transmission={1}
        ior={1.33}
        chromaticAberration={0.04}
        color="#9fd6ff"
        attenuationColor="#2b8fd6"
        attenuationDistance={2.4}
      />
    </mesh>
  );
}

export default function GotaTresD() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <Orbe />
      <Environment resolution={64}>
        <Lightformer form="circle" intensity={2} position={[2, 3, 4]} scale={3} />
        <Lightformer form="circle" intensity={1.2} position={[-3, -1, 2]} scale={2} color="#ffd9a0" />
      </Environment>
    </Canvas>
  );
}
