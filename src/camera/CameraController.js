import * as THREE from 'three';
import { CameraSettings, TerrainSettings, PhysicsSettings } from '../utils/Constants.js';

export class CameraController {
  constructor(camera, controls, raycastUtils) {
    this.camera = camera;
    this.controls = controls;
    this.raycastUtils = raycastUtils;
    this.mode = 'player'; 
    this._keys = {};

    this.initListeners();
  }

  initListeners() {
    this._keydownHandler = (e) => {
      this._keys[e.key.toLowerCase()] = true;
    };
    this._keyupHandler = (e) => {
      this._keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', this._keydownHandler);
    window.addEventListener('keyup', this._keyupHandler);
  }

  update(ballPhysicsPos, phiDeg, time, dt, isRunning = false) {
    const R = PhysicsSettings.BALL_RADIUS * 5; 
    const ballVec = new THREE.Vector3(ballPhysicsPos.x, ballPhysicsPos.z - PhysicsSettings.BALL_RADIUS + R, -ballPhysicsPos.y);

    let activeMode = this.mode;
    if (activeMode === 'default') {
      activeMode = isRunning ? 'follow' : 'player';
    }

    if (activeMode === 'follow') {

      let phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;
      const camDist = CameraSettings.FOLLOW_DIST;
      const camHeight = CameraSettings.FOLLOW_HEIGHT;

      const desiredX = ballVec.x - camDist * Math.cos(phiRad);
      const desiredZ = ballVec.z + camDist * Math.sin(phiRad);
      const desiredY = ballVec.y + camHeight;

      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      this.camera.position.lerp(desiredCamPos, 0.05);

      this.controls.target.lerp(ballVec, 0.08);
      this.controls.enabled = true;

    } else if (activeMode === 'cinematic') {

      const orbitSpeed = 0.25;
      const angle = time * orbitSpeed;
      const camDist = 22.0;

      const desiredX = ballVec.x + camDist * Math.cos(angle);
      const desiredZ = ballVec.z + camDist * Math.sin(angle);
      const desiredY = ballVec.y + 5.0;

      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      this.camera.position.lerp(desiredCamPos, 0.05);

      this.controls.target.lerp(ballVec, 0.08);
      this.controls.enabled = false;

    } else if (activeMode === 'landing') {

      const holeY = this.raycastUtils.terrainHeightCallback ? this.raycastUtils.terrainHeightCallback(TerrainSettings.HOLE_X, 0) : 0;
      this.camera.position.lerp(new THREE.Vector3(140, holeY + 30, 40), 0.03);
      this.controls.target.lerp(new THREE.Vector3(TerrainSettings.HOLE_X, holeY, 0), 0.04);
      this.controls.enabled = true;

    } else if (activeMode === 'top') {

      const desired = new THREE.Vector3(ballPhysicsPos.x, 80, -ballPhysicsPos.y);
      this.camera.position.lerp(desired, 0.05);
      this.controls.target.lerp(ballVec, 0.1);
      this.controls.enabled = true;

    } else if (activeMode === 'player') {

      const phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;
      const camDist = CameraSettings.AIM_DIST;
      const camHeight = CameraSettings.AIM_HEIGHT;

      const desiredX = ballVec.x - camDist * Math.cos(phiRad);
      const desiredZ = ballVec.z + camDist * Math.sin(phiRad);
      const desiredY = ballVec.y + camHeight;

      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      this.camera.position.lerp(desiredCamPos, 0.08);

      this.controls.target.lerp(ballVec, 0.08);
      this.controls.enabled = true;

    } else if (activeMode === 'hole') {

      const orbitSpeed = 0.25;
      const angle = (time !== undefined ? time : performance.now() / 1000) * orbitSpeed;
      const radius = 3.5;
      const height = 1.8;

      const holeY = this.raycastUtils.terrainHeightCallback ? this.raycastUtils.terrainHeightCallback(TerrainSettings.HOLE_X, 0) : 0;
      const desiredX = TerrainSettings.HOLE_X + radius * Math.cos(angle);
      const desiredZ = 0 + radius * Math.sin(angle);
      const desiredY = height + holeY;

      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      this.camera.position.lerp(desiredCamPos, 0.04);

      const holeTarget = new THREE.Vector3(TerrainSettings.HOLE_X, desiredY - height - 0.05, 0);
      this.controls.target.lerp(holeTarget, 0.05);
      this.controls.enabled = false;

    } else {

      this.controls.enabled = true;
      const moveSpeed = this._keys['shift'] ? 1.5 : 0.5;
      const dir = new THREE.Vector3();
      const right = new THREE.Vector3();

      if (this._keys['w']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        this.camera.position.addScaledVector(dir, moveSpeed); 
        this.controls.target.addScaledVector(dir, moveSpeed); 
      }
      if (this._keys['s']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        this.camera.position.addScaledVector(dir, -moveSpeed); 
        this.controls.target.addScaledVector(dir, -moveSpeed); 
      }
      if (this._keys['a']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        right.crossVectors(dir, this.camera.up).normalize();
        this.camera.position.addScaledVector(right, -moveSpeed); 
        this.controls.target.addScaledVector(right, -moveSpeed); 
      }
      if (this._keys['d']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        right.crossVectors(dir, this.camera.up).normalize();
        this.camera.position.addScaledVector(right, moveSpeed); 
        this.controls.target.addScaledVector(right, moveSpeed); 
      }
      if (this._keys['q']) {
        this.camera.position.y += moveSpeed;
        this.controls.target.y += moveSpeed;
      }
      if (this._keys['e']) {
        this.camera.position.y -= moveSpeed;
        this.controls.target.y -= moveSpeed;
      }
    }

    const camGroundHeight = this.raycastUtils.getGroundHeight(this.camera.position.x, this.camera.position.z);
    const minCamY = camGroundHeight + CameraSettings.MIN_CAMERA_Y;
    if (this.camera.position.y < minCamY) {
      this.camera.position.y = minCamY;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._keydownHandler);
    window.removeEventListener('keyup', this._keyupHandler);
    this._keys = {};
  }
}
