// ============================================================
// Hole.js — Golf Hole Cup and Flag Entity Class
// ============================================================
import * as THREE from 'three';
import { TerrainSettings } from '../utils/Constants.js';

export class Hole {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.group = new THREE.Group();
    
    // Set position at HOLE_X, aligned to terrain height
    this.x = TerrainSettings.HOLE_X;
    this.z = 0;
    this.y = this.terrain.getTerrainHeight(this.x, this.z);
    
    this.group.position.set(this.x, this.y, this.z);
    this.windFlagMesh = null;
    
    this.build();
  }

  build() {
    // 1. Hole Cup (Nested 0.4m deep inside ground)
    const holeCyl = new THREE.CylinderGeometry(0.54, 0.54, 0.4, 32);
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const holeMesh = new THREE.Mesh(holeCyl, holeMat);
    holeMesh.position.set(0, -0.2, 0); // Centers it inside the putting green
    this.group.add(holeMesh);

    // 2. Hole Cup Rim (Torus lying flat on green surface)
    const ringGeo  = new THREE.TorusGeometry(0.54, 0.08, 16, 32);
    const ringMesh = new THREE.Mesh(ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.01, 0);
    this.group.add(ringMesh);

    // 3. Flag Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 3.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7, roughness: 0.2 })
    );
    pole.position.y = 1.75;
    pole.castShadow = true;
    this.group.add(pole);

    // 4. Flag Fabric (Extruded shape)
    const flagShape = new THREE.Shape();
    flagShape.moveTo(0, 0);
    flagShape.lineTo(0.6, 0.15);
    flagShape.lineTo(0, 0.3);
    flagShape.lineTo(0, 0);

    const flagGeo = new THREE.ExtrudeGeometry(flagShape, { depth: 0.02, bevelEnabled: false });
    const flagMat = new THREE.MeshStandardMaterial({ 
      color: 0xe61a1a, 
      side: THREE.DoubleSide,
      emissive: 0xcc0000,
      emissiveIntensity: 0.2
    });
    this.windFlagMesh = new THREE.Mesh(flagGeo, flagMat);
    this.windFlagMesh.position.set(0, 2.8, 0);
    this.windFlagMesh.rotation.y = -Math.PI / 2;
    this.windFlagMesh.castShadow = true;
    this.group.add(this.windFlagMesh);

    // 5. White Base Ring/Grommet
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 0.15, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    base.position.y = 0.075;
    this.group.add(base);

    this.scene.add(this.group);
  }

  update(time) {
    // Wave the flag fabric in the wind!
    if (this.windFlagMesh) {
      const positions = this.windFlagMesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const px = positions.getX(i);
        const wave = Math.sin(px * 3 + time * 4) * 0.1 * (px / 1.5);
        positions.setZ(i, wave);
      }
      positions.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
