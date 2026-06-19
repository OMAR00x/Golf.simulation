// ============================================================
// graphics.js — نظام الجرافيكس الكامل بـ Three.js
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const HOLE_X = 170;

export class GraphicsSystem {
  constructor() {
    this.container  = document.getElementById('canvas-container');
    this.scene      = new THREE.Scene();
    this.ballMesh   = null;
    this.ballGroup  = new THREE.Group();
    this.trajPts    = [];
    this.trajLine   = null;
    this.cameraMode = 'free';   // 'free' | 'follow' | 'landing'

    this._initRenderer();
    this._initLighting();
    this._buildCourse();
    this._buildBall();
    this._buildTrajectoryLine();

    window.addEventListener('resize', () => this._onResize());
  }

  // ── Renderer + Camera + Controls ────────────────────────────
  _initRenderer() {
    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 2000
    );
    this.camera.position.set(-18, 14, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping  = true;
    this.controls.dampingFactor  = 0.06;
    this.controls.target.set(35, 0, 0);
    this.controls.maxPolarAngle  = Math.PI / 2 - 0.05;
    this.controls.minDistance    = 3;
    this.controls.maxDistance    = 250;

    // WASD
    this._keys = {};
    window.addEventListener('keydown', e => { this._keys[e.key.toLowerCase()] = true;  });
    window.addEventListener('keyup',   e => { this._keys[e.key.toLowerCase()] = false; });
  }

  // ── إضاءة الملعب ────────────────────────────────────────────
  _initLighting() {
    this.scene.background = new THREE.Color(0x6ab4e8);
    this.scene.fog         = new THREE.FogExp2(0x8ecae6, 0.0018);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.6);
    sun.position.set(80, 100, 50);
    sun.castShadow              = true;
    sun.shadow.mapSize.width    = 4096;
    sun.shadow.mapSize.height   = 4096;
    sun.shadow.camera.left      = -80;
    sun.shadow.camera.right     = 280;
    sun.shadow.camera.top       = 100;
    sun.shadow.camera.bottom    = -60;
    sun.shadow.camera.near      = 1;
    sun.shadow.camera.far       = 400;
    sun.shadow.bias             = -0.0003;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.45);
    this.scene.add(hemi);
  }

  // ── بناء الملعب ─────────────────────────────────────────────
  _buildCourse() {
    // --- سماء + شمس ---
    const sunGeo = new THREE.SphereGeometry(10, 20, 20);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff9d0, fog: false });
    const sun    = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(120, 110, -80);
    this.scene.add(sun);

    // هالة الشمس
    const haloGeo  = new THREE.SphereGeometry(16, 20, 20);
    const haloMat  = new THREE.MeshBasicMaterial({ color: 0xffe88a, transparent: true, opacity: 0.12, fog: false });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(sun.position);
    this.scene.add(haloMesh);

    // غيوم
    const cloudData = [
      [[40,55,60],1.1], [[90,60,75],0.9], [[155,58,85],1.3],
      [[-20,52,70],1.0], [[200,64,95],1.2], [[70,60,-55],0.8],
    ];
    cloudData.forEach(([pos,s]) => {
      const g = this._makeCloud(s);
      g.position.set(...pos);
      this.scene.add(g);
    });

    // --- الأرض الخضراء الرئيسية (Rough) ---
    const roughGeo = new THREE.PlaneGeometry(600, 400, 60, 40);
    const roughPos = roughGeo.attributes.position;
    for (let i = 0; i < roughPos.count; i++) {
      const x = roughPos.getX(i), z = roughPos.getY(i);
      const onFairway = Math.abs(z) < 22;
      let h = 0;
      if (!onFairway) {
        h  = Math.sin(x * 0.03) * Math.cos(z * 0.04) * 3.5;
        h += Math.sin(x * 0.07 + 1.2) * 1.5;
        if (Math.abs(z) > 60) h += Math.max(0, Math.sin(x * 0.015) * 8);
        const blend = Math.min(1, (Math.abs(z) - 22) / 28);
        h *= blend;
      }
      roughPos.setZ(i, h);
    }
    roughGeo.computeVertexNormals();
    const roughMesh = new THREE.Mesh(roughGeo,
      new THREE.MeshStandardMaterial({ color: 0x3a6b30, roughness: 0.95 }));
    roughMesh.rotation.x    = -Math.PI / 2;
    roughMesh.position.set(HOLE_X / 2, 0, 0);
    roughMesh.receiveShadow = true;
    this.scene.add(roughMesh);

    // --- الممر (Fairway) ---
    const fairway = this._flatPlane(HOLE_X + 40, 28, 0x3d8045, 0.88, HOLE_X / 2, 0.005, 0);
    this.scene.add(fairway);

    // --- الغرين ---
    const greenGeo = new THREE.CircleGeometry(15, 64);
    const greenMesh = new THREE.Mesh(greenGeo,
      new THREE.MeshStandardMaterial({ color: 0x28623a, roughness: 0.65 }));
    greenMesh.rotation.x = -Math.PI / 2;
    greenMesh.position.set(HOLE_X, 0.01, 0);
    greenMesh.receiveShadow = true;
    this.scene.add(greenMesh);

    // --- الجورة ---
    const holeCyl = new THREE.CylinderGeometry(0.54, 0.54, 0.3, 32);
    const holeMesh = new THREE.Mesh(holeCyl,
      new THREE.MeshStandardMaterial({ color: 0x060606 }));
    holeMesh.position.set(HOLE_X, -0.12, 0);
    this.scene.add(holeMesh);

    // حافة الجورة البيضاء
    const ringGeo  = new THREE.RingGeometry(0.54, 0.72, 32);
    const ringMesh = new THREE.Mesh(ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(HOLE_X, 0.012, 0);
    this.scene.add(ringMesh);

    // --- العلم ---
    this._buildFlag(HOLE_X, 0, 0);

    // --- نقطة البداية (Tee) ---
    this._buildTee();

    // --- علامات المسافة ---
    [50, 100, 150].forEach(d => {
      const m = this._flatPlane(0.15, 24, 0xffffff, 0.5, d, 0.006, 0);
      m.material.transparent = true; m.material.opacity = 0.12;
      this.scene.add(m);
    });

    // --- أشجار — فقط في المنطقة اللي فيها terrain ---
    const getTerrainHeight = (x, z) => {
      const distFromFairway = Math.abs(z);
      if (distFromFairway < 22) return 0;
      let h = Math.sin(x * 0.03) * Math.cos(z * 0.04) * 3.5;
      h    += Math.sin(x * 0.07 + 1.2) * 1.5;
      if (distFromFairway > 60) {
        h += Math.max(0, Math.sin(x * 0.015) * 8);
      }
      const blend = Math.min(1, (distFromFairway - 22) / 28);
      return h * blend;
    };

    for (let i = 0; i < 55; i++) {
      const tree = this._makeTree();
      const side = Math.random() > 0.5 ? 1 : -1;
      // نحدد الأشجار بين x=5 و x=200 فقط — حيث الأرض موجودة ومرئية
      const x    = 5 + Math.random() * 195;
      const z    = side * (28 + Math.random() * 55);
      const y    = getTerrainHeight(x, z);
      tree.position.set(x, y, z);
      this.scene.add(tree);
    }

    // --- بنكر رمل ---
    [[180, 0, -30], [270, 0, 28]].forEach(([x, y, z]) => {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(11, 14, 0.04, 20),
        new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.9 })
      );
      b.position.set(x, y + 0.005, z);
      b.receiveShadow = true;
      this.scene.add(b);
    });
  }

  _flatPlane(w, h, color, roughness, px, py, pz) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color, roughness })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(px, py, pz);
    m.receiveShadow = true;
    return m;
  }

  _makeCloud(scale) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xf5f8ff, transparent: true, opacity: 0.82, fog: false });
    [
      [0,0,0,7], [8,1,0,5.5], [-7,0.5,0,6], [3,3,0,4.5], [-2,2.5,2,4]
    ].forEach(([x,y,z,r]) => {
      const s = scale;
      const c = new THREE.Mesh(new THREE.SphereGeometry(r*s,10,10), mat);
      c.position.set(x*s, y*s, z*s);
      g.add(c);
    });
    return g;
  }

  _makeTree() {
    const g = new THREE.Group();
    // جذع
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    trunk.position.y = 2; trunk.castShadow = true; g.add(trunk);
    // أوراق ثلاث طبقات
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x132a13, roughness: 0.8 });
    [0,1,2].forEach(i => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.2 - i*0.6, 4, 8), leafMat
      );
      cone.position.y = 4.5 + i * 2; cone.castShadow = true; g.add(cone);
    });
    const s = 0.75 + Math.random() * 0.5;
    g.scale.set(s, s, s);
    return g;
  }

  _buildFlag(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 3.0, 12),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7, roughness: 0.2 })
    );
    pole.position.y = 1.5; pole.castShadow = true; g.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xe61a1a, side: THREE.DoubleSide,
        emissive: 0xcc0000, emissiveIntensity: 0.3 })
    );
    flag.position.set(0, 2.7, 0.28); flag.rotation.y = -Math.PI / 2;
    flag.castShadow = true; g.add(flag);

    const base = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    base.rotation.x = -Math.PI / 2; base.position.y = 0.012; g.add(base);

    this.scene.add(g);
  }

  _buildTee() {
    const g    = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.65 })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01; g.add(disc);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.8, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.011; g.add(ring);
    this.scene.add(g);
  }

  // ── الكرة ───────────────────────────────────────────────────
  _buildBall() {
    const R = 0.02135 * 5;

    // كرة بيضاء بنقرات (Dimples) عبر Canvas Texture
    const canvas  = document.createElement('canvas');
    canvas.width  = 512; canvas.height = 512;
    const ctx     = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 320; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const r = 2 + Math.random() * 3;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(160,160,160,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = gr; ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 48),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.05 })
    );
    this.ballMesh.castShadow = true;
    this.ballGroup.add(this.ballMesh);

    // ظل ناعم تحت الكرة
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.7, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.005;
    this.scene.add(this.ballShadow);

    this.scene.add(this.ballGroup);
  }

  // ── خط المسار ───────────────────────────────────────────────
  _buildTrajectoryLine() {
    this.trajMat  = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    this.trajGeo  = new THREE.BufferGeometry();
    this.trajLine = new THREE.Line(this.trajGeo, this.trajMat);
    this.scene.add(this.trajLine);
  }

  updateTrajectory(points) {
    if (points.length < 2) return;
    const positions = [];
    const colors    = [];
    let maxZ = 0;
    points.forEach(p => { if (p.z > maxZ) maxZ = p.z; });

    points.forEach(p => {
      positions.push(p.x, p.z, -p.y);   // فيزياء → Three.js
      const t = maxZ > 0 ? p.z / maxZ : 0;
      const c = new THREE.Color().setHSL(0.60 - t * 0.55, 1, 0.52);
      colors.push(c.r, c.g, c.b);
    });

    this.trajGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trajGeo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    this.trajGeo.computeBoundingSphere();
  }

  clearTrajectory() {
    this.trajGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.trajGeo.setAttribute('color',    new THREE.Float32BufferAttribute([], 3));
    this.trajPts = [];
  }

  // ── تحديث موقع الكرة ────────────────────────────────────────
  updateBallPosition(pos) {
    // فيزياء: x=أمام, y=جانب, z=ارتفاع → Three.js: x=أمام, y=أعلى, z=-جانب
    const R = 0.02135 * 5;
    this.ballGroup.position.set(pos.x, pos.z + R, -pos.y);
    this.ballShadow.position.set(pos.x, 0.005, -pos.y);
    this.ballShadow.material.opacity = Math.max(0.04, 0.28 - pos.z * 0.015);
  }

  // ── أوضاع الكاميرا ──────────────────────────────────────────
  updateCamera(ballPhysicsPos) {
    const ballVec = new THREE.Vector3(ballPhysicsPos.x, ballPhysicsPos.z, -ballPhysicsPos.y);

    if (this.cameraMode === 'follow') {
      const desired = new THREE.Vector3(ballPhysicsPos.x - 22, ballPhysicsPos.z + 9, -ballPhysicsPos.y);
      this.camera.position.lerp(desired, 0.07);
      this.controls.target.lerp(ballVec, 0.1);
      this.controls.enabled = false;

    } else if (this.cameraMode === 'landing') {
      this.camera.position.lerp(new THREE.Vector3(130, 25, 30), 0.04);
      this.controls.target.lerp(new THREE.Vector3(HOLE_X, 0, 0), 0.05);
      this.controls.enabled = false;

    } else {
      this.controls.enabled = true;
      // WASD
      const speed = 0.45;
      const dir   = new THREE.Vector3();
      if (this._keys['w']) { this.camera.getWorldDirection(dir); dir.y=0; dir.normalize(); this.camera.position.addScaledVector(dir, speed); this.controls.target.addScaledVector(dir, speed); }
      if (this._keys['s']) { this.camera.getWorldDirection(dir); dir.y=0; dir.normalize(); this.camera.position.addScaledVector(dir,-speed); this.controls.target.addScaledVector(dir,-speed); }
      if (this._keys['a']) { this.camera.getWorldDirection(dir); dir.y=0; dir.normalize(); dir.cross(this.camera.up); this.camera.position.addScaledVector(dir,-speed); this.controls.target.addScaledVector(dir,-speed); }
      if (this._keys['d']) { this.camera.getWorldDirection(dir); dir.y=0; dir.normalize(); dir.cross(this.camera.up); this.camera.position.addScaledVector(dir, speed); this.controls.target.addScaledVector(dir, speed); }
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  resetBall() {
    this.ballGroup.position.set(0, 0.02135*5, 0);
    this.ballShadow.position.set(0, 0.005, 0);
    this.clearTrajectory();
  }
}
