// ============================================================
// Tree.js — Tree Entity Class
// ============================================================
import * as THREE from 'three';

export class Tree {
  constructor(scene, glbModel, x, z, scale, rotationY, name, raycastUtils) {
    this.scene = scene;
    this.raycastUtils = raycastUtils;
    this.name = name;

    this.group = new THREE.Group();
    this.group.rotation.y = rotationY;

    if (glbModel) {
      const modelClone = glbModel.clone();
      this.group.add(modelClone);
    } else {
      this._buildProceduralTree(scale);
    }

    this.scene.add(this.group);
    
    // Align trunk base exactly to the terrain
    this.alignToGround(x, z, scale);
  }

  _buildProceduralTree(scale) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 3.5 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    trunk.position.y = 1.75 * scale;
    trunk.castShadow = true;
    this.group.add(trunk);

    const leafColors = [0x1a4a1a, 0x2d5a2d, 0x3a6b3a];
    leafColors.forEach((color, i) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((3.0 - i * 0.5) * scale, 3.5 * scale, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      cone.position.y = (4 + i * 2.5) * scale;
      cone.castShadow = true;
      this.group.add(cone);
    });

    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 * scale, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.85 })
    );
    bush.position.set(1.5 * scale, 2.5 * scale, 0);
    bush.castShadow = true;
    this.group.add(bush);
  }

  alignToGround(x, z, scale) {
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.group);
    const bottomY = box.min.y;

    const groundY = this.raycastUtils.getGroundHeight(x, z);
    
    // Align base to the ground
    const yPos = groundY - bottomY;
    this.group.position.set(x, yPos, z);
    this.group.updateMatrixWorld(true);

    this.group.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
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
