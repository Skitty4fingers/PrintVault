// Interactive 3D STL/OBJ previewer built on three.js.
// Fetches the model from `url`, auto-centers/fits the camera, and provides
// orbit controls. Cleans up all GPU resources on unmount.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Spinner } from './ui.jsx';

export default function StlViewer({ url, ext = 'stl' }) {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let raf;
    let disposed = false;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101218');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1, 1.5, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8b9cff, 0.5);
    fill.position.set(-1, -0.5, -1);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    let mesh = null;
    let grid = null;

    function frameObject(object3d) {
      const box = new THREE.Box3().setFromObject(object3d);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      object3d.position.sub(center); // center at origin

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 2.2;
      camera.position.set(dist * 0.7, dist * 0.6, dist);
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();

      // Subtle ground grid sized to the model.
      grid = new THREE.GridHelper(maxDim * 3, 24, 0x3a3f4d, 0x23262f);
      grid.position.y = -size.y / 2 - maxDim * 0.02;
      scene.add(grid);
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6, metalness: 0.25, roughness: 0.55, flatShading: false,
    });

    function onLoaded(geometryOrGroup, isGroup) {
      if (disposed) return;
      if (isGroup) {
        geometryOrGroup.traverse((c) => { if (c.isMesh) c.material = material; });
        mesh = geometryOrGroup;
      } else {
        geometryOrGroup.computeVertexNormals();
        mesh = new THREE.Mesh(geometryOrGroup, material);
      }
      scene.add(mesh);
      frameObject(mesh);
      setLoading(false);
    }

    fetch(url, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error('Failed to load model'); return r.arrayBuffer(); })
      .then((buf) => {
        if (disposed) return;
        if (String(ext).toLowerCase() === 'obj') {
          const text = new TextDecoder().decode(buf);
          const group = new OBJLoader().parse(text);
          onLoaded(group, true);
        } else {
          const geo = new STLLoader().parse(buf);
          onLoaded(geo, false);
        }
      })
      .catch((e) => { if (!disposed) { setError(e.message); setLoading(false); } });

    function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      if (mesh) {
        mesh.traverse?.((c) => { if (c.isMesh) { c.geometry?.dispose(); } });
        if (mesh.geometry) mesh.geometry.dispose();
      }
      material.dispose();
      grid?.geometry?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [url, ext]);

  return (
    <div className="viewer" ref={mountRef}>
      {loading && !error && (
        <div className="viewer-overlay"><Spinner /></div>
      )}
      {error && (
        <div className="viewer-overlay" style={{ flexDirection: 'column', color: 'var(--muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, opacity: .5 }}>🧊</div>
            <div>Preview unavailable</div>
          </div>
        </div>
      )}
    </div>
  );
}
