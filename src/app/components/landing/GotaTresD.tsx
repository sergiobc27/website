import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { GotaEstatica } from './GotaEstatica';

// Orbe de agua: esfera ligeramente alargada con material físico (refracción suave
// + brillo + clearcoat). Gira sola y se inclina hacia el cursor. Material mucho más
// barato que MeshTransmissionMaterial (una sola pasada de transmisión, no varias),
// para no ahogar GPUs integradas.
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
      <meshPhysicalMaterial
        transmission={0.9}
        thickness={1.2}
        ior={1.33}
        roughness={0.06}
        clearcoat={1}
        clearcoatRoughness={0.1}
        color="#9fd6ff"
        attenuationColor="#2b8fd6"
        attenuationDistance={2.4}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}

// La gota 3D vive en el chunk lazy de la landing. Si el contexto WebGL se pierde
// (GPU saturada), cae a la gota SVG estática en lugar de dejar un canvas muerto.
export default function GotaTresD() {
  const [perdido, setPerdido] = useState(false);

  // r3f a veces no mide el contenedor en el montaje (carga lazy + Suspense), y deja
  // el canvas en su tamaño por defecto (300x150). Un par de eventos resize tras el
  // montaje disparan el ResizeObserver de r3f para que mida el contenedor real
  // (verificado: el canvas pasa de 300x150 a llenar su caja). En la landing no hay
  // otros componentes que escuchen resize, así que es inocuo.
  useEffect(() => {
    const raf = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  if (perdido) return <GotaEstatica />;
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 4.2], fov: 40 }}
        dpr={[1, 1.25]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setPerdido(true);
          });
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <Orbe />
        {/* frames={1}: genera el envMap UNA vez, no un cubemap por frame. */}
        <Environment resolution={64} frames={1} background={false}>
          <Lightformer form="circle" intensity={2} position={[2, 3, 4]} scale={3} />
          <Lightformer form="circle" intensity={1.2} position={[-3, -1, 2]} scale={2} color="#ffd9a0" />
        </Environment>
      </Canvas>
    </div>
  );
}
