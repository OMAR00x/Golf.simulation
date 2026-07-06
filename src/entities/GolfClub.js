// ============================================================
// GolfClub.js — Golf Club Entity Class
// ============================================================
import * as THREE from 'three';
import { PhysicsSettings } from '../utils/Constants.js';

export class GolfClub {
  constructor(scene, raycastUtils) {
    this.scene = scene;
    this.raycastUtils = raycastUtils;

    this.group = new THREE.Group();
    // Default address position next to the starting tee
    this.group.position.set(-0.15, 0, 0.1);
    this.group.rotation.set(0, 0, 0.05);
    this.scene.add(this.group);

    // Pivot for swing rotation (centered at the grip/handle end)
    this.clubPivot = new THREE.Group();
    this.clubPivot.position.set(0, 1.3, 0); // Default pivot grip height
    this.group.add(this.clubPivot);

    // Fallback procedural club model
    this.proceduralClub = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.3, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = -0.65;
    shaft.castShadow = true;
    this.proceduralClub.add(shaft);

    const headGeo = new THREE.BoxGeometry(0.14, 0.05, 0.06);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.06, -1.3, 0);
    head.castShadow = true;
    this.proceduralClub.add(head);

    this.clubPivot.add(this.proceduralClub);

    // Swing animation state
    this.state = 'idle'; // 'idle' | 'swinging'
    this.swingTime = 0;
    this.onImpact = null;
    this.onSwingComplete = null;

    this.clubMaxX = 0.06; // Offset from ball center to prevent clipping
    this.loadedModel = null;
  }

  setModel(clubModel, clubPivotHeight, clubMaxX) {
    this.loadedModel = clubModel;
    this.clubMaxX = clubMaxX;
    
    // Clear procedural visual helper
    this.clubPivot.remove(this.proceduralClub);
    
    // Place loaded model inside pivot
    this.clubPivot.position.set(0, clubPivotHeight, 0);
    this.clubPivot.add(clubModel);
  }

  startSwing(onImpact, onComplete) {
    this.state = 'swinging';
    this.swingTime = 0;
    this.onImpact = onImpact;
    this.onSwingComplete = onComplete;
  }

  update(dt) {
    if (this.state === 'idle') {
      this.clubPivot.rotation.z = 0;
      return;
    }

    this.swingTime += dt;
    const t = this.swingTime;
    
    const T_back = 0.40;
    const T_down = 0.15;
    const T_follow = 0.25;
    const T_return = 0.50;

    let zRot = 0;

    if (t < T_back) {
      // 1. Backswing
      const pct = t / T_back;
      zRot = -1.2 * Math.sin(pct * Math.PI / 2) * Math.sin(pct * Math.PI / 2);
    } else if (t < T_back + T_down) {
      // 2. Downswing
      const pct = (t - T_back) / T_down;
      zRot = -1.2 * Math.cos(pct * Math.PI / 2);
    } else if (t < T_back + T_down + T_follow) {
      // 3. Follow-through (Trigger impact callback exactly once)
      if (this.onImpact) {
        this.onImpact();
        this.onImpact = null;
      }
      const pct = (t - (T_back + T_down)) / T_follow;
      zRot = 0.8 * Math.sin(pct * Math.PI / 2);
    } else if (t < T_back + T_down + T_follow + T_return) {
      // 4. Return to address
      const pct = (t - (T_back + T_down + T_follow)) / T_return;
      zRot = 0.8 * (1 - pct) * (1 - pct);
    } else {
      // 5. Return to rest
      zRot = 0;
      this.state = 'idle';
      this.swingTime = 0;
      if (this.onSwingComplete) {
        this.onSwingComplete();
        this.onSwingComplete = null;
      }
    }

    this.clubPivot.rotation.z = zRot;
  }

  updatePositionAndAim(pos, phiDeg) {
    this.group.visible = true;

    const R = PhysicsSettings.BALL_RADIUS * 5; // Visual ball radius
    const targetDistance = R + this.clubMaxX;
    const phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;

    const ballX = pos.x;
    const ballY = pos.z - PhysicsSettings.BALL_RADIUS;
    const ballZ = -pos.y;

    const targetClubX = ballX - targetDistance * Math.cos(phiRad);
    const targetClubZ = ballZ + targetDistance * Math.sin(phiRad);

    this.group.position.set(targetClubX, ballY, targetClubZ);
    this.group.rotation.set(0, phiRad, 0);
    this.group.updateMatrixWorld(true);
  }

  getClubForwardVector(thetaDeg) {
    const thetaRad = (thetaDeg !== undefined ? thetaDeg : 15) * Math.PI / 180;
    const localForward = new THREE.Vector3(Math.cos(thetaRad), Math.sin(thetaRad), 0);
    
    this.clubPivot.updateMatrixWorld(true);
    const worldForward = localForward.transformDirection(this.clubPivot.matrixWorld);
    return worldForward;
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
