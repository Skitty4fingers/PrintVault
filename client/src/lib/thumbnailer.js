// Renders an STL/OBJ model to a PNG thumbnail in the browser.
// A single WebGL renderer/canvas is reused across calls to avoid exhausting
// the browser's WebGL context limit when thumbnailing many files.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const W = 400;
const H = 300;
let renderer = null;

function getRenderer() {
  if (!renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
  }
  return renderer;
}

// Returns a PNG Blob, or null if the model can't be rendered.
export async function renderModelThumbnail(arrayBuffer, ext) {
  let mesh = null;
  const material = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.25, roughness: 0.55 });
  try {
    const r = getRenderer();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#14161b');
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 5000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(1, 1.5, 1); scene.add(key);
    const fill = new THREE.DirectionalLight(0x8b9cff, 0.5); fill.position.set(-1, -0.5, -1); scene.add(fill);

    if (String(ext).toLowerCase() === 'obj') {
      const group = new OBJLoader().parse(new TextDecoder().decode(arrayBuffer));
      group.traverse((c) => { if (c.isMesh) c.material = material; });
      mesh = group;
    } else {
      const geo = new STLLoader().parse(arrayBuffer);
      geo.computeVertexNormals();
      mesh = new THREE.Mesh(geo, material);
    }
    scene.add(mesh);

    // Center and fit the model to the frame.
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    mesh.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim * 2.1;
    camera.position.set(dist * 0.8, dist * 0.6, dist);
    camera.lookAt(0, 0, 0);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    r.render(scene, camera);
    const blob = await new Promise((resolve) => r.domElement.toBlob(resolve, 'image/png'));
    return blob;
  } catch {
    return null;
  } finally {
    if (mesh) {
      if (mesh.geometry) mesh.geometry.dispose();
      else mesh.traverse?.((c) => { if (c.isMesh) c.geometry?.dispose(); });
    }
    material.dispose();
  }
}
