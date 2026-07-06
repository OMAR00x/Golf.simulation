// ============================================================
// GolfBall.js — Golf Ball Entity Class
// ============================================================
import * as THREE from 'three';
import { PhysicsSettings } from '../utils/Constants.js';

export class GolfBall {
  constructor(scene, raycastUtils) {
    this.scene = scene;
    this.raycastUtils = raycastUtils;
    this.radius = PhysicsSettings.BALL_RADIUS * 5; // Scaled up 5x visually for visibility

    // Group holding the ball mesh and relative pivots
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Visual model wrapper inside group
    this.mesh = new THREE.Group();
    this.group.add(this.mesh);

    // Fallback procedural sphere before GLB is loaded
    const fallbackGeo = new THREE.SphereGeometry(this.radius, 16, 16);
    const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    this.fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
    this.fallbackMesh.castShadow = true;
    this.fallbackMesh.receiveShadow = true;
    this.mesh.add(this.fallbackMesh);

    // Flat black shadow circle projected under the ball
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(this.radius * 1.7, 32),
      new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.25, 
        depthWrite: false 
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.005;
    this.scene.add(this.shadow);

    this.loadedModel = null;
    this.scaleFactor = 1.0;
  }

  setModel(ballWrapper, scaleFactor) {
    this.loadedModel = ballWrapper;
    this.scaleFactor = scaleFactor;
    this.mesh.remove(this.fallbackMesh);
    if (this.fallbackMesh.geometry) this.fallbackMesh.geometry.dispose();
    if (this.fallbackMesh.material) this.fallbackMesh.material.dispose();

    this.mesh.add(ballWrapper);

    // Calculate actual visual radius from the loaded model
    const box = new THREE.Box3().setFromObject(ballWrapper);
    const size = new THREE.Vector3();
    box.getSize(size);
    this.radius = Math.max(size.x, size.y, size.z) / 2;
  }

  updatePosition(pos, omega, dt) {
    const R = this.radius;
    const ballHeight = pos.z - PhysicsSettings.BALL_RADIUS + R;
    const groundHeight = this.raycastUtils.terrainHeightCallback ? this.raycastUtils.terrainHeightCallback(pos.x, -pos.y) : 0;

    this.group.position.set(pos.x, ballHeight, -pos.y);
    this.group.visible = true;

    // Follow ground height exactly
    this.shadow.position.set(pos.x, groundHeight + 0.005, -pos.y);
    // Decrease opacity as it goes higher
    const hAbove = pos.z - groundHeight - PhysicsSettings.BALL_RADIUS;
    this.shadow.material.opacity = Math.max(0.04, 0.28 - hAbove * 0.015);

    // Apply spin/roll rotation
    if (omega) {
      this.mesh.rotation.x += omega.x * dt;
      this.mesh.rotation.y += omega.y * dt;
      this.mesh.rotation.z += omega.z * dt;
    }
  }

  positionAt(pos) {
    const R = this.radius;
    const ballHeight = pos.z - PhysicsSettings.BALL_RADIUS + R;
    const groundHeight = this.raycastUtils.terrainHeightCallback ? this.raycastUtils.terrainHeightCallback(pos.x, -pos.y) : 0;
    this.group.position.set(pos.x, ballHeight, -pos.y);
    this.shadow.position.set(pos.x, groundHeight + 0.005, -pos.y);

    const isStart = Math.hypot(pos.x, pos.y) < 0.01;
    if (isStart) {
      this.group.visible = false; // Let TeeBall draw instead
    } else {
      this.group.visible = true;
    }
    this.group.updateMatrixWorld(true);
  }

  reset() {
    const R = this.radius;
    const groundHeight = this.raycastUtils.terrainHeightCallback ? this.raycastUtils.terrainHeightCallback(0, 0) : 0;
    this.group.position.set(0, groundHeight + R, 0);
    this.shadow.position.set(0, groundHeight + 0.005, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.group.visible = false;
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
    
    if (this.shadow) {
      this.shadow.geometry.dispose();
      this.shadow.material.dispose();
      this.scene.remove(this.shadow);
    }
  }
}
