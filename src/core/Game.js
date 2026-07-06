// ============================================================
// Game.js — Main OOP Application Loop & Coordination Class
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { TerrainSettings, PhysicsSettings } from '../utils/Constants.js';
import { RaycastUtils } from '../utils/RaycastUtils.js';
import { Terrain } from '../environment/Terrain.js';
import { Lighting } from '../environment/Lighting.js';
import { TreeManager } from '../environment/TreeManager.js';
import { GolfBall } from '../entities/GolfBall.js';
import { GolfClub } from '../entities/GolfClub.js';
import { Hole } from '../entities/Hole.js';
import { CameraController } from '../camera/CameraController.js';
import { UIManager } from '../ui/UIManager.js';
import { PhysicsEngine } from '../physics/PhysicsEngine.js';
import { AssetLoader } from './AssetLoader.js';

export class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    
    this.running = false;
    this.engine = null;
    this.strokes = 0;
    this.currentBallPos = { x: 0, y: 0, z: PhysicsSettings.BALL_RADIUS };
    this.holeComplete = false;
    this.time = 0;
    this.frameCount = 0;
    this.lastBounceCount = 0;
    this.lastTime = performance.now();

    this.trajPts = [];
    this.bounceParticles = [];

    this.initRenderer();
    this.initEntities();
    this.initAimLine();
    this.initLandingMarker();
    this.initTee();
    this.assetLoader = new AssetLoader();
    this.loadAssets();
    this.initKeyboardListeners();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  initKeyboardListeners() {
    this._gameKeydownHandler = (e) => {
      const key = e.key.toLowerCase();
      
      // Select Parameter Hotkeys
      if (key === 'p') {
        this.uiManager.updateActiveParamVisuals('power');
        e.preventDefault();
      } else if (key === 'a') {
        this.uiManager.updateActiveParamVisuals('aim');
        e.preventDefault();
      } else if (key === 's') {
        this.uiManager.updateActiveParamVisuals('spin');
        e.preventDefault();
      }
      
      // Camera Shortcuts (1: Default, 2: Top, 3: Behind Ball, 4: Follow, 5: Free, 6: Cinematic)
      if (e.key === '1') {
        this.setCameraMode('default');
      } else if (e.key === '2') {
        this.setCameraMode('top');
      } else if (e.key === '3') {
        this.setCameraMode('player');
      } else if (e.key === '4') {
        this.setCameraMode('follow');
      } else if (e.key === '5') {
        this.setCameraMode('free');
      } else if (e.key === '6') {
        this.setCameraMode('cinematic');
      }
      
      // R Key to Restart
      if (key === 'r') {
        this.resetGame();
        e.preventDefault();
      }
      
      // Arrow Key Parameter Adjustment
      if (!this.running && !this.holeComplete) {
        const shiftPressed = e.shiftKey;
        
        if (e.key === 'ArrowUp') {
          this.uiManager.adjustParameter(this.uiManager.activeParam, true, false, shiftPressed);
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          this.uiManager.adjustParameter(this.uiManager.activeParam, false, false, shiftPressed);
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          this.uiManager.adjustParameter(this.uiManager.activeParam, true, true, shiftPressed);
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          this.uiManager.adjustParameter(this.uiManager.activeParam, false, true, shiftPressed);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', this._gameKeydownHandler);
  }

  initRenderer() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(-18, 14, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(35, 0, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 3000;
  }

  initEntities() {
    // 1. Terrain & Raycaster
    this.terrain = new Terrain(this.scene);
    this.raycastUtils = new RaycastUtils(this.terrain.groundMeshes, (x, z) => this.terrain.getTerrainHeight(x, z));

    // 2. Atmosphere
    this.lighting = new Lighting(this.scene);
    this.treeManager = new TreeManager(this.scene, this.raycastUtils);

    // 3. Game Objects
    this.ball = new GolfBall(this.scene, this.raycastUtils);
    this.club = new GolfClub(this.scene, this.raycastUtils);
    this.hole = new Hole(this.scene, this.terrain);

    // 4. Controllers
    this.cameraController = new CameraController(this.camera, this.controls, this.raycastUtils);
    this.uiManager = new UIManager(this);
  }

  initTee() {
    this.teeGroup = new THREE.Group();

    // Tee Base rings
    const line1 = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.55, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    line1.rotation.x = -Math.PI / 2;
    line1.position.y = 0.085;
    this.teeGroup.add(line1);

    const line2 = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.75, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    );
    line2.rotation.x = -Math.PI / 2;
    line2.position.y = 0.085;
    this.teeGroup.add(line2);

    // Red Tee Marker
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 })
    );
    marker.position.y = 0.15;
    this.teeGroup.add(marker);

    // Fallback Tee Peg
    this.proceduralTeeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 })
    );
    this.proceduralTeeBase.position.y = 0.03;
    this.teeGroup.add(this.proceduralTeeBase);

    this.proceduralTeeStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.02, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 })
    );
    this.proceduralTeeStand.position.y = 0.07;
    this.teeGroup.add(this.proceduralTeeStand);

    // Tee Ball
    this.teeBall = this.ball.fallbackMesh.clone();
    this.teeBall.position.set(0, 0.14, 0);
    this.teeGroup.add(this.teeBall);

    this.scene.add(this.teeGroup);
  }

  initAimLine() {
    this.aimMat = new THREE.LineDashedMaterial({ color: 0xffaa00, dashSize: 0.3, gapSize: 0.15 });
    this.aimLine = new THREE.Line(new THREE.BufferGeometry(), this.aimMat);
    this.scene.add(this.aimLine);

    // Trajectory Line
    this.trajMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    this.trajGeo = new THREE.BufferGeometry();
    this.trajLine = new THREE.Line(this.trajGeo, this.trajMat);
    this.scene.add(this.trajLine);
  }

  initLandingMarker() {
    this.landingMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide })
    );
    this.landingMarker.rotation.x = -Math.PI / 2;
    this.landingMarker.position.y = 0.02;
    this.landingMarker.visible = false;
    this.scene.add(this.landingMarker);
  }

  loadAssets() {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingOverlay = document.getElementById('loading-overlay');

    const onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${progress}%`;
    };

    const onLoad = () => {
      setTimeout(() => {
        if (loadingOverlay) {
          loadingOverlay.style.opacity = '0';
          loadingOverlay.style.visibility = 'hidden';
        }
      }, 500);

      this.setupLoadedBall();
      this.setupLoadedTee();
      this.setupLoadedClub();
    };

    this.assetLoader.preload(onProgress, onLoad);
  }

  setupLoadedBall() {
    const ballModel = this.assetLoader.get('ball');
    if (!ballModel) return;

    ballModel.updateMatrixWorld(true);
    ballModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = 0.35;
          node.material.metalness = 0.05;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(ballModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetDiameter = this.ball.radius * 2;
    const maxExtent = Math.max(size.x, size.y, size.z);
    const scaleFactor = targetDiameter / maxExtent;
    ballModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    ballModel.updateMatrixWorld(true);

    box.setFromObject(ballModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    ballModel.position.sub(center);
    ballModel.updateMatrixWorld(true);

    const ballWrapper = new THREE.Group();
    ballWrapper.add(ballModel);
    ballWrapper.updateMatrixWorld(true);

    this.ball.setModel(ballWrapper, scaleFactor);

    // Replace Tee Ball
    this.teeGroup.remove(this.teeBall);
    this.teeBall = ballWrapper.clone();
    const teeHeight = this.loadedTeeHeight || 0.14;
    this.teeBall.position.set(0, teeHeight - 0.01, 0);
    this.teeGroup.add(this.teeBall);
    this.teeBall.visible = true;
  }

  setupLoadedTee() {
    const teeModel = this.assetLoader.get('tee');
    if (!teeModel) return;

    teeModel.updateMatrixWorld(true);
    teeModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(teeModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetHeight = 0.20;
    const scaleFactor = targetHeight / size.y;
    teeModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    teeModel.updateMatrixWorld(true);

    box.setFromObject(teeModel);
    teeModel.position.x = - (box.min.x + box.max.x) / 2;
    teeModel.position.z = - (box.min.z + box.max.z) / 2;
    teeModel.position.y = - box.min.y;
    teeModel.updateMatrixWorld(true);

    box.setFromObject(teeModel);
    this.loadedTeeHeight = box.max.y;

    if (this.proceduralTeeStand) this.teeGroup.remove(this.proceduralTeeStand);
    if (this.proceduralTeeBase) this.teeGroup.remove(this.proceduralTeeBase);

    this.teeGroup.add(teeModel);
    if (this.teeBall) {
      this.teeBall.position.y = this.loadedTeeHeight - 0.01;
    }
  }

  setupLoadedClub() {
    const clubModel = this.assetLoader.get('club');
    if (!clubModel) return;

    clubModel.updateMatrixWorld(true);
    clubModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(clubModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetHeight = 1.3;
    const scaleFactor = targetHeight / size.y;
    clubModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    clubModel.updateMatrixWorld(true);

    box.setFromObject(clubModel);
    clubModel.position.x = - (box.min.x + box.max.x) / 2;
    clubModel.position.z = - (box.min.z + box.max.z) / 2;
    clubModel.position.y = - box.max.y;
    clubModel.updateMatrixWorld(true);

    const tempBox = new THREE.Box3().setFromObject(clubModel);
    const clubMaxX = tempBox.max.x;

    this.club.setModel(clubModel, targetHeight, clubMaxX);
  }

  launchBall() {
    if (this.running || this.club.state !== 'idle') return;

    this.aimLine.visible = false;
    const params = this.uiManager.getParams();

    this.club.startSwing(
      () => {
        const clubForward = this.club.getClubForwardVector(params.thetaDeg);
        const heightCallback = (x, y) => {
          const info = this.raycastUtils.getDetailedGroundInfo(x, -y);
          return {
            height: info.height,
            meshName: info.meshName,
            normal: {
              x: info.normal.x,
              y: -info.normal.z,
              z: info.normal.y
            }
          };
        };
        this.engine = new PhysicsEngine(params, this.currentBallPos, clubForward, heightCallback);
        this.running = true;
        this.frameCount = 0;
        this.lastBounceCount = 0;

        this.strokes++;
        this.uiManager.setStrokesHUD(this.strokes);

        this.cameraController.mode = 'follow';
        this.uiManager.updateCamButtons('follow');
        this.club.group.visible = false;

        this.clearTrajectory();
        this.uiManager.hideStats();
        this.uiManager.setStatus(`Stroke ${this.strokes}`, '#ffaa00');
        this.uiManager.updateGroundUI(params.groundType);
        this.uiManager.playSound('hit');
      },
      () => {
        console.log('Swing animation completed');
      }
    );
  }

  resetGame() {
    this.running = false;
    this.engine = null;
    this.strokes = 0;
    this.currentBallPos = { x: 0, y: 0, z: PhysicsSettings.BALL_RADIUS };
    this.holeComplete = false;

    this.uiManager.setStrokesHUD(0);
    this.ball.reset();
    this.club.updatePositionAndAim(this.currentBallPos, parseFloat(this.uiManager.ui.phi.value));
    
    if (this.teeBall) {
      this.teeBall.visible = true;
    }

    this.cameraController.mode = 'player';
    this.uiManager.updateCamButtons('player');
    this.uiManager.hideVictory();

    this.uiManager.ui.dashAlt.textContent = '0.00';
    this.uiManager.ui.dashVel.textContent = '0.00';
    this.uiManager.ui.dashDist.textContent = '0.00';
    this.uiManager.ui.dashSpin.textContent = '0';
    this.uiManager.setStatus('Ready', '#ffaa00');
    this.uiManager.hideStats();
    this.uiManager.updateGroundUI(this.uiManager.ui.groundType.value);

    this.clearTrajectory();
  }

  setCameraMode(mode) {
    this.cameraController.mode = mode;
    this.uiManager.updateCamButtons(mode);
  }

  onParamAdjust(param, val) {
    if (!this.running && !this.holeComplete) {
      if (param === 'aim') {
        this.club.updatePositionAndAim(this.currentBallPos, val);
        this.updateAimLine(this.currentBallPos, val, parseFloat(this.uiManager.ui.theta.value));
      }
    }
  }

  updateAimLine(pos, phiDeg, thetaDeg) {
    if (!this.aimLine) return;
    const R = PhysicsSettings.BALL_RADIUS * 5;
    const ballVec = new THREE.Vector3(pos.x, pos.z - PhysicsSettings.BALL_RADIUS + R, -pos.y);
    this.aimLine.position.copy(ballVec);

    const clubDir = this.club.getClubForwardVector(thetaDeg);
    const length = 15;
    const dx = length * clubDir.x;
    const dy = length * clubDir.y;
    const dz = length * clubDir.z;

    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dx, dy, dz)
    ];
    this.aimLine.geometry.setFromPoints(points);
    this.aimLine.geometry.attributes.position.needsUpdate = true;
    this.aimLine.computeLineDistances();
    this.aimLine.visible = true;
  }

  updateTrajectoryLine(trajectory) {
    if (trajectory.length < 2) return;
    const startIdx = this.trajPts.length;
    for (let i = startIdx; i < trajectory.length; i++) {
      const p = trajectory[i];
      const alignedY = p.z - PhysicsSettings.BALL_RADIUS;
      this.trajPts.push({
        x: p.x,
        y: alignedY,
        z: -p.y,
        rawZ: p.z
      });
    }

    let maxZ = 0;
    for (const p of this.trajPts) {
      if (p.rawZ > maxZ) maxZ = p.rawZ;
    }

    const positions = new Float32Array(this.trajPts.length * 3);
    const colors = new Float32Array(this.trajPts.length * 3);
    for (let i = 0; i < this.trajPts.length; i++) {
      const p = this.trajPts[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      const t = maxZ > 0.01 ? p.rawZ / maxZ : 0;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.5 + t * 0.5;
      colors[i * 3 + 2] = 0.0;
    }

    this.trajGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trajGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.trajGeo.attributes.position.needsUpdate = true;
    this.trajGeo.attributes.color.needsUpdate = true;
  }

  updateLandingMarker(pt) {
    if (!this.landingMarker) return;
    this.landingMarker.position.set(pt.x, pt.z - PhysicsSettings.BALL_RADIUS + 0.02, -pt.y);
    this.landingMarker.visible = true;
  }

  clearTrajectory() {
    this.trajGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([]), 3));
    this.trajGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([]), 3));
    this.trajPts = [];
    if (this.landingMarker) this.landingMarker.visible = false;
    this.bounceParticles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.bounceParticles = [];
  }

  createBounceParticles(pos, intensity = 1) {
    const count = Math.floor(intensity * 20);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    
    const alignedY = pos.z - PhysicsSettings.BALL_RADIUS;
    
    for (let i = 0; i < count; i++) {
      positions[i*3] = pos.x;
      positions[i*3+1] = alignedY;
      positions[i*3+2] = -pos.y;
      velocities.push({
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 5 * intensity,
        z: (Math.random() - 0.5) * 4,
        life: 1.0
      });
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ 
      color: 0x8B4513, 
      size: 0.12,
      transparent: true,
      opacity: 0.8
    });
    const particles = new THREE.Points(geo, mat);
    this.scene.add(particles);
    this.bounceParticles.push({ mesh: particles, velocities, life: 1.0 });
  }

  updateParticles(dt) {
    for (let i = this.bounceParticles.length - 1; i >= 0; i--) {
      const p = this.bounceParticles[i];
      p.life -= dt * 1.5;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.bounceParticles.splice(i, 1);
        continue;
      }
      p.mesh.material.opacity = p.life * 0.8;
      const positions = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length; j++) {
        const vel = p.velocities[j];
        vel.y -= 9.81 * dt; // gravity
        positions[j*3] += vel.x * dt;
        positions[j*3+1] += vel.y * dt;
        positions[j*3+2] += vel.z * dt;
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // 1. Static environment animations
    this.terrain.update(this.time, delta);
    
    // 2. Club swing update
    this.club.update(delta);
    
    // 3. Flags and animations
    this.hole.update(this.time);
    
    // 4. Particle systems
    this.updateParticles(delta);

    if (this.running && this.engine) {
      this.engine.update(delta);
      const state = this.engine.state;

      // Diagnostic Console Log
      const groundInfo = this.raycastUtils.getDetailedGroundInfo(state.pos.x, -state.pos.y);
      const dist = (state.pos.z - PhysicsSettings.BALL_RADIUS) - groundInfo.height;
      if (this.frameCount % 5 === 0) {
        console.log(`[Diagnostic] Terrain Type: ${this.uiManager.ui.groundType.value}, Mesh Name: ${groundInfo.meshName}, Ground Height: ${groundInfo.height.toFixed(3)}, Ball Pos: (${state.pos.x.toFixed(3)}, ${state.pos.y.toFixed(3)}, ${state.pos.z.toFixed(3)}), Normal: (${groundInfo.normal.x.toFixed(3)}, ${groundInfo.normal.y.toFixed(3)}, ${groundInfo.normal.z.toFixed(3)}), Distance: ${dist.toFixed(4)}`);
        if (dist < -0.001) {
          console.warn(`[Diagnostic WARNING] Ball has penetrated the terrain by ${Math.abs(dist).toFixed(4)} meters!`);
        }
      }

      // Update ball position and spin roll rotation
      this.ball.updatePosition(state.pos, state.omega, delta);
      
      // Update camera follow mode
      this.cameraController.update(state.pos, parseFloat(this.uiManager.ui.phi.value), this.time, delta, true);

      const speed = this.uiManager.updateHUD(state);

      if (this.frameCount % 2 === 0) {
        this.updateTrajectoryLine(this.engine.trajectory);
      }

      if (this.engine.landingPoint) {
        this.updateLandingMarker(this.engine.landingPoint);
      }



      if (this.engine.bounces > this.lastBounceCount) {
        this.uiManager.playSound('bounce');
        this.createBounceParticles(state.pos, Math.min(1, speed / 20));
        this.lastBounceCount = this.engine.bounces;
      }

      if (this.engine.phase === 'rolling') {
        this.uiManager.setStatus('Rolling', '#52b788');
      }

      if (this.engine.phase === 'stopped') {
        this.running = false;

        this.currentBallPos = { x: state.pos.x, y: state.pos.y, z: state.pos.z };

        // perfect aiming angle directly from the ball to the hole
        const dx = TerrainSettings.HOLE_X - this.currentBallPos.x;
        const dy = -this.currentBallPos.y;
        const angleRad = Math.atan2(dy, dx);
        let angleDeg = angleRad * 180 / Math.PI;
        
        if (angleDeg < -180) angleDeg += 360;
        if (angleDeg > 180) angleDeg -= 360;

        this.uiManager.setPhiValue(angleDeg);

        this.club.updatePositionAndAim(this.currentBallPos, angleDeg);
        this.ball.positionAt(this.currentBallPos);

        const stats = this.engine.getStats();
        this.uiManager.showStats(stats);

        if (stats.inHole) {
          this.holeComplete = true;
          this.club.group.visible = false;
          this.aimLine.visible = false;
          this.cameraController.mode = 'hole';
          this.uiManager.updateCamButtons('hole');
          this.uiManager.playSound('hole');
          
          setTimeout(() => {
            this.uiManager.showVictory(this.strokes);
          }, 1500);
        } else {
          this.cameraController.mode = 'player';
          this.uiManager.updateCamButtons('player');
        }

        this.uiManager.setStatus(stats.inHole ? 'Holed' : 'Stopped', '#00ffcc');
      }

      this.frameCount++;
    } else {
      if (this.holeComplete) {
        this.cameraController.update(this.currentBallPos, parseFloat(this.uiManager.ui.phi.value), this.time, delta, false);
        this.club.group.visible = false;
        this.aimLine.visible = false;
      } else {
        this.cameraController.update(this.currentBallPos, parseFloat(this.uiManager.ui.phi.value), this.time, delta, false);
        
        if (this.club.state === 'idle') {
          this.club.updatePositionAndAim(this.currentBallPos, parseFloat(this.uiManager.ui.phi.value));
          this.updateAimLine(this.currentBallPos, parseFloat(this.uiManager.ui.phi.value), parseFloat(this.uiManager.ui.theta.value));
        }
      }
    }

    this.time += delta;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
