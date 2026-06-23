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
    this.cameraMode = 'free';
    this.landingMarker = null;
    this.bounceParticles = [];
    this.teeGroup = null;
    this.flagGroup = null;
    this.birds = [];
    this.time = 0;

    this._initRenderer();
    this._initLighting();
    this._buildSky();
    this._buildEnvironment();
    this._buildCourse();
    this._buildTee();
    this._buildBall();
    this._buildTrajectoryLine();
    this._buildLandingMarker();
    this._buildWindIndicator();

    window.addEventListener('resize', () => this._onResize());
  }

  // ── Renderer + Camera + Controls ────────────────────────────
  _initRenderer() {
    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 3000
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
    this.controls.maxDistance    = 400;

    this._keys = {};
    window.addEventListener('keydown', e => { this._keys[e.key.toLowerCase()] = true;  });
    window.addEventListener('keyup',   e => { this._keys[e.key.toLowerCase()] = false; });
  }

  // ── إضاءة محسّنة ────────────────────────────────────────────
  _initLighting() {
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog         = new THREE.FogExp2(0xB0E0E6, 0.0012);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.0);
    sun.position.set(120, 120, 80);
    sun.castShadow              = true;
    sun.shadow.mapSize.width    = 4096;
    sun.shadow.mapSize.height   = 4096;
    sun.shadow.camera.left      = -100;
    sun.shadow.camera.right     = 300;
    sun.shadow.camera.top       = 120;
    sun.shadow.camera.bottom    = -80;
    sun.shadow.camera.near      = 1;
    sun.shadow.camera.far       = 500;
    sun.shadow.bias             = -0.0003;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 0.5);
    this.scene.add(hemi);
  }

  // ── السماء والشمس والغيوم ───────────────────────────────────
  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(1500, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide,
      fog: false
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // الشمس
    const sunGeo = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ 
      color: 0xFFF8DC, 
      fog: false
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(300, 250, -200);
    this.scene.add(sun);

    // هالات الشمس
    for (let i = 1; i <= 3; i++) {
      const haloGeo = new THREE.SphereGeometry(15 + i * 8, 32, 32);
      const haloMat = new THREE.MeshBasicMaterial({ 
        color: 0xFFE4B5, 
        transparent: true, 
        opacity: 0.08 / i,
        fog: false 
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(sun.position);
      this.scene.add(halo);
    }

    // غيوم متنوعة
    const cloudPositions = [
      [[40, 180, 80], 2.0], [[90, 200, 120], 1.5], [[160, 170, 90], 2.2],
      [[-30, 190, 150], 1.3], [[220, 210, 100], 1.8], [[70, 185, -80], 1.1],
      [[300, 195, 60], 1.6], [[-80, 175, -60], 1.4], [[130, 205, 180], 1.7],
      [[250, 180, -120], 1.2], [[350, 200, 40], 1.5], [[-50, 190, 200], 1.3],
    ];
    cloudPositions.forEach(([pos, scale]) => {
      const g = this._makeCloud(scale);
      g.position.set(...pos);
      this.scene.add(g);
    });

    // قوس قزح بعيد (خفيف)
    const rainbowGeo = new THREE.TorusGeometry(800, 15, 2, 64, Math.PI);
    const rainbowMat = new THREE.MeshBasicMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      fog: false
    });
    const rainbow = new THREE.Mesh(rainbowGeo, rainbowMat);
    rainbow.position.set(200, 100, -400);
    rainbow.rotation.x = Math.PI / 2;
    rainbow.rotation.z = -0.2;
    this.scene.add(rainbow);
  }

  _makeCloud(scale) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.85, 
      fog: false 
    });
    const shapes = [
      [0, 0, 0, 8], [10, 1, 0, 6], [-8, 0.5, 0, 7], 
      [4, 3, 0, 5], [-3, 2.5, 2, 4.5], [6, -1, 3, 4],
      [-5, 2, -2, 5.5], [2, 4, 1, 3.5]
    ];
    shapes.forEach(([x, y, z, r]) => {
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(r * scale, 12, 12), 
        mat
      );
      c.position.set(x * scale, y * scale, z * scale);
      g.add(c);
    });
    return g;
  }

  // ── بيئة خارجية محسّنة ────────────────────────────────────
  _buildEnvironment() {
    // جبال بعيدة - أكثر تفصيل
    const mountainMat = new THREE.MeshStandardMaterial({ 
      color: 0x5a6b5c, 
      roughness: 0.95,
      fog: false
    });
    
    for (let i = 0; i < 20; i++) {
      const h = 100 + Math.random() * 150;
      const w = 80 + Math.random() * 100;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(w, h, 8),
        mountainMat
      );
      const angle = (i / 20) * Math.PI * 2;
      const dist = 600 + Math.random() * 300;
      mountain.position.set(
        Math.cos(angle) * dist,
        h / 2 - 30,
        Math.sin(angle) * dist
      );
      mountain.rotation.y = Math.random() * Math.PI;
      this.scene.add(mountain);
      
      // قمة ثلجية
      const snowCap = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.3, h * 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, fog: false })
      );
      snowCap.position.set(
        mountain.position.x,
        mountain.position.y + h * 0.375,
        mountain.position.z
      );
      snowCap.rotation.y = mountain.rotation.y;
      this.scene.add(snowCap);
    }

    // بحيرة بعيدة - أكبر وأجمل
    const lakeGeo = new THREE.CircleGeometry(120, 64);
    const lakeMat = new THREE.MeshStandardMaterial({
      color: 0x4a90a4,
      roughness: 0.05,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85
    });
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-250, 0.1, 200);
    this.scene.add(lake);

    // جزيرة في البحيرة
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 20, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 })
    );
    island.position.set(-250, 1, 200);
    this.scene.add(island);

    // شجرة على الجزيرة
    const islandTree = this._makeTree(0.8);
    islandTree.position.set(-250, 3, 200);
    this.scene.add(islandTree);

    // أشجار بعيدة - أكثر
    for (let i = 0; i < 50; i++) {
      const tree = this._makeTree(0.6 + Math.random() * 0.4);
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 200;
      tree.position.set(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist
      );
      this.scene.add(tree);
    }

    // طيور (سيتم تحريكها)
    for (let i = 0; i < 12; i++) {
      const bird = this._makeBird();
      bird.position.set(
        Math.random() * 300 - 100,
        40 + Math.random() * 50,
        Math.random() * 150 - 75
      );
      this.birds.push({
        mesh: bird,
        speed: 0.3 + Math.random() * 0.5,
        radius: 80 + Math.random() * 150,
        angle: Math.random() * Math.PI * 2,
        height: bird.position.y,
        centerX: bird.position.x,
        centerZ: bird.position.z
      });
      this.scene.add(bird);
    }

    // أعمدة إنارة على طول الملعب
    for (let i = 0; i < 8; i++) {
      const lamp = this._makeLamp();
      lamp.position.set(i * 25, 0, -35);
      this.scene.add(lamp);
    }

    // سياج خشبي
    for (let i = 0; i < 30; i++) {
      const fence = this._makeFence();
      fence.position.set(i * 8 - 20, 0, 45);
      fence.rotation.y = 0.1;
      this.scene.add(fence);
    }
  }

  _makeFence() {
    const g = new THREE.Group();
    
    // عمود
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 1.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
    );
    post.position.y = 0.6;
    post.castShadow = true;
    g.add(post);

    // لوح أفقي
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.85 })
    );
    board.position.y = 0.9;
    board.castShadow = true;
    g.add(board);

    return g;
  }

  _makeBird() {
    const g = new THREE.Group();
    
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    body.scale.set(1, 0.6, 1.5);
    g.add(body);

    const wingGeo = new THREE.PlaneGeometry(1.5, 0.4);
    const wingMat = new THREE.MeshBasicMaterial({ 
      color: 0x444444, 
      side: THREE.DoubleSide 
    });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.8, 0, 0);
    leftWing.rotation.x = -0.3;
    g.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.8, 0, 0);
    rightWing.rotation.x = -0.3;
    g.add(rightWing);

    g.userData = { leftWing, rightWing, wingPhase: Math.random() * Math.PI * 2 };
    return g;
  }

  _buildWindIndicator() {
    const g = new THREE.Group();
    
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    pole.position.y = 2;
    g.add(pole);

    const flagGeo = new THREE.PlaneGeometry(1.5, 0.5, 8, 2);
    const flagMat = new THREE.MeshStandardMaterial({ 
      color: 0xff6600, 
      side: THREE.DoubleSide,
      emissive: 0xff3300,
      emissiveIntensity: 0.1
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.75, 3.5, 0);
    g.add(flag);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    base.position.y = 0.1;
    g.add(base);

    g.position.set(-5, 0, 8);
    this.scene.add(g);
    this.windFlag = flag;
    this.windIndicator = g;
  }

  // ── بناء الملعب ─────────────────────────────────────────────
  _buildCourse() {
    // --- الأرض الخضراء الرئيسية (Rough) ---
    const roughGeo = new THREE.PlaneGeometry(800, 600, 80, 60);
    const roughPos = roughGeo.attributes.position;
    for (let i = 0; i < roughPos.count; i++) {
      const x = roughPos.getX(i), z = roughPos.getY(i);
      const onFairway = Math.abs(z) < 25;
      let h = 0;
      if (!onFairway) {
        h  = Math.sin(x * 0.02) * Math.cos(z * 0.025) * 4;
        h += Math.sin(x * 0.05 + 2) * 1.8;
        h += Math.cos(z * 0.03 + 1) * 2;
        if (Math.abs(z) > 70) h += Math.max(0, Math.sin(x * 0.012) * 10);
        const blend = Math.min(1, (Math.abs(z) - 25) / 35);
        h *= blend;
      }
      roughPos.setZ(i, h);
    }
    roughGeo.computeVertexNormals();
    const roughMesh = new THREE.Mesh(roughGeo,
      new THREE.MeshStandardMaterial({ color: 0x3d6b33, roughness: 0.95 }));
    roughMesh.rotation.x    = -Math.PI / 2;
    roughMesh.position.set(HOLE_X / 2, 0, 0);
    roughMesh.receiveShadow = true;
    this.scene.add(roughMesh);

    // --- الممر (Fairway) ---
    const fairway = this._flatPlane(HOLE_X + 60, 32, 0x4a8a52, 0.85, HOLE_X / 2, 0.005, 0);
    this.scene.add(fairway);

    // --- خطوط Fairway ---
    for (let i = 0; i < 5; i++) {
      const line = this._flatPlane(HOLE_X + 60, 0.15, 0x5a9a62, 0.7, HOLE_X / 2, 0.008, -12 + i * 6);
      this.scene.add(line);
    }

    // --- الغرين ---
    const greenGeo = new THREE.CircleGeometry(18, 64);
    const greenMesh = new THREE.Mesh(greenGeo,
      new THREE.MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.55 }));
    greenMesh.rotation.x = -Math.PI / 2;
    greenMesh.position.set(HOLE_X, 0.01, 0);
    greenMesh.receiveShadow = true;
    this.scene.add(greenMesh);

    // --- تضاريس الغرين (slopes خفيفة) ---
    const greenBump = new THREE.Mesh(
      new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.6, transparent: true, opacity: 0.3 })
    );
    greenBump.position.set(HOLE_X, -0.5, 0);
    greenBump.scale.y = 0.1;
    this.scene.add(greenBump);

    // --- الجورة ---
    const holeCyl = new THREE.CylinderGeometry(0.54, 0.54, 0.4, 32);
    const holeMesh = new THREE.Mesh(holeCyl,
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }));
    holeMesh.position.set(HOLE_X, -0.15, 0);
    this.scene.add(holeMesh);

    // حافة الجورة
    const ringGeo  = new THREE.TorusGeometry(0.54, 0.08, 16, 32);
    const ringMesh = new THREE.Mesh(ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(HOLE_X, 0.01, 0);
    this.scene.add(ringMesh);

    // --- العلم ---
    this._buildFlag(HOLE_X, 0, 0);

    // --- علامات المسافة ---
    [50, 100, 150].forEach(d => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
      );
      post.position.set(d, 0.75, 14);
      post.castShadow = true;
      this.scene.add(post);

      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      sign.position.set(d, 1.4, 14);
      this.scene.add(sign);

      const line = this._flatPlane(0.2, 28, 0xffffff, 0.5, d, 0.006, 0);
      line.material.transparent = true; 
      line.material.opacity = 0.15;
      this.scene.add(line);
    });

    // --- أشجار قريبة ---
    const getTerrainHeight = (x, z) => {
      const distFromFairway = Math.abs(z);
      if (distFromFairway < 25) return 0;
      let h = Math.sin(x * 0.02) * Math.cos(z * 0.025) * 4;
      h += Math.sin(x * 0.05 + 2) * 1.8;
      if (distFromFairway > 70) h += Math.max(0, Math.sin(x * 0.012) * 10);
      const blend = Math.min(1, (distFromFairway - 25) / 35);
      return h * blend;
    };

    for (let i = 0; i < 65; i++) {
      const tree = this._makeTree();
      const side = Math.random() > 0.5 ? 1 : -1;
      const x    = 5 + Math.random() * 220;
      const z    = side * (32 + Math.random() * 70);
      const y    = getTerrainHeight(x, z);
      tree.position.set(x, y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(tree);
    }

    // --- بنكر رمل ---
    [[180, 0, -35], [270, 0, 32], [120, 0, -45]].forEach(([x, y, z]) => {
      const bunkerGeo = new THREE.CylinderGeometry(12, 14, 0.3, 24);
      const bunkerMat = new THREE.MeshStandardMaterial({ 
        color: 0xe8d5a3, 
        roughness: 0.95 
      });
      const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
      bunker.position.set(x, y - 0.1, z);
      bunker.receiveShadow = true;
      this.scene.add(bunker);

      const edge = new THREE.Mesh(
        new THREE.TorusGeometry(13, 0.5, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xc9b896, roughness: 0.9 })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, y + 0.05, z);
      this.scene.add(edge);
    });

    // --- ممر مشاة ---
    const path = this._flatPlane(3, 200, 0xc4a86b, 0.9, 100, 0.01, 25);
    this.scene.add(path);

    // --- مقاعد محسّنة - شكل احترافي ---
    for (let i = 0; i < 4; i++) {
      const bench = this._makeBench();
      bench.position.set(25 + i * 45, 0, 38);
      bench.rotation.y = -0.2 + Math.random() * 0.1;
      this.scene.add(bench);
    }

    // --- عربة غولف ---
    const cart = this._makeGolfCart();
    cart.position.set(15, 0, -25);
    cart.rotation.y = 0.5;
    this.scene.add(cart);
  }

  // ── مقعد محسّن - شكل احترافي ───────────────────────────────
  _makeBench() {
    const g = new THREE.Group();
    
    // مقعد خشبي - شكل منحني
    const seatCurve = new THREE.Shape();
    seatCurve.moveTo(-1.2, 0);
    seatCurve.quadraticCurveTo(0, 0.15, 1.2, 0);
    seatCurve.lineTo(1.2, 0.08);
    seatCurve.quadraticCurveTo(0, 0.23, -1.2, 0.08);
    seatCurve.lineTo(-1.2, 0);

    const seatGeo = new THREE.ExtrudeGeometry(seatCurve, {
      depth: 0.6,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2
    });
    const seatMat = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, 
      roughness: 0.7,
      metalness: 0.1
    });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.rotation.x = -Math.PI / 2;
    seat.position.y = 0.5;
    seat.castShadow = true;
    g.add(seat);

    // ظهر المقعد - منحني
    const backCurve = new THREE.Shape();
    backCurve.moveTo(-1.2, 0);
    backCurve.quadraticCurveTo(0, 0.3, 1.2, 0);
    backCurve.lineTo(1.2, 0.5);
    backCurve.quadraticCurveTo(0, 0.8, -1.2, 0.5);
    backCurve.lineTo(-1.2, 0);

    const backGeo = new THREE.ExtrudeGeometry(backCurve, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2
    });
    const back = new THREE.Mesh(backGeo, seatMat);
    back.position.set(0, 0.5, -0.55);
    back.castShadow = true;
    g.add(back);

    // أرجل حديدية - أنيقة
    const legMat = new THREE.MeshStandardMaterial({ 
      color: 0x333333, 
      metalness: 0.9,
      roughness: 0.2
    });

    const legPositions = [
      [-1.1, 0, 0.2], [1.1, 0, 0.2],
      [-1.1, 0, -0.2], [1.1, 0, -0.2]
    ];

    legPositions.forEach(([lx, ly, lz]) => {
      // عمود رئيسي
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.03, 0.5, 8),
        legMat
      );
      leg.position.set(lx, ly + 0.25, lz);
      g.add(leg);

      // قاعدة القدم
      const foot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        legMat
      );
      foot.position.set(lx, ly + 0.03, lz);
      foot.scale.set(1, 0.3, 1);
      g.add(foot);
    });

    // مسند ذراعين
    const armrestGeo = new THREE.BoxGeometry(0.08, 0.04, 0.7);
    [-1.15, 1.15].forEach(ax => {
      const armrest = new THREE.Mesh(armrestGeo, legMat);
      armrest.position.set(ax, 0.65, -0.1);
      g.add(armrest);
    });

    return g;
  }
    _makeLamp() {
    const g = new THREE.Group();
    
    // العمود
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 })
    );
    pole.position.y = 3;
    pole.castShadow = true;
    g.add(pole);

    // المصباح
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 16, 16),
      new THREE.MeshStandardMaterial({ 
        color: 0xffffee, 
        emissive: 0xffffee,
        emissiveIntensity: 0.5
      })
    );
    lamp.position.y = 6;
    g.add(lamp);

    // الضوء
    const light = new THREE.PointLight(0xffffee, 0.5, 20);
    light.position.y = 6;
    g.add(light);

    return g;
  }

  // ── عربة غولف ──────────────────────────────────────────────
  _makeGolfCart() {
    const g = new THREE.Group();
    
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 });

    // هيكل
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 1.2),
      bodyMat
    );
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);

    // مقعد
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.15, 0.5),
      seatMat
    );
    seat.position.set(0, 0.85, 0.1);
    g.add(seat);

    // ظهر المقعد
    const seatBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 0.1),
      seatMat
    );
    seatBack.position.set(0, 1.1, -0.35);
    g.add(seatBack);

    // مظلة
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.05, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.9 })
    );
    roof.position.y = 1.6;
    g.add(roof);

    // أعمدة المظلة
    [[-0.8, 0.9, -0.5], [0.8, 0.9, -0.5], [-0.8, 0.9, 0.5], [0.8, 0.9, 0.5]].forEach(([px, py, pz]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8),
        metalMat
      );
      pole.position.set(px, py, pz);
      g.add(pole);
    });

    // عجلات
    const wheelPositions = [
      [-0.9, 0.25, 0.5], [0.9, 0.25, 0.5],
      [-0.9, 0.25, -0.5], [0.9, 0.25, -0.5]
    ];

    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16),
        tireMat
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      g.add(wheel);

      // جنط
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.16, 16),
        metalMat
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      g.add(rim);
    });

    // مقود
    const steering = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.02, 8, 16),
      metalMat
    );
    steering.position.set(0, 1.0, 0.45);
    steering.rotation.x = -0.3;
    g.add(steering);

    // عمود المقود
    const steeringCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8),
      metalMat
    );
    steeringCol.position.set(0, 0.85, 0.4);
    steeringCol.rotation.x = -0.3;
    g.add(steeringCol);

    // حقيبة غولف
    const bag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e4d8c, roughness: 0.6 })
    );
    bag.position.set(0.3, 0.85, -0.4);
    bag.rotation.z = 0.1;
    g.add(bag);

    return g;
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

  _makeTree(scale = 1) {
    const g = new THREE.Group();
    
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 3.5 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    trunk.position.y = 1.75 * scale;
    trunk.castShadow = true;
    g.add(trunk);

    const leafColors = [0x1a4a1a, 0x2d5a2d, 0x3a6b3a];
    leafColors.forEach((color, i) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((3.0 - i * 0.5) * scale, 3.5 * scale, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      cone.position.y = (4 + i * 2.5) * scale;
      cone.castShadow = true;
      g.add(cone);
    });

    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 * scale, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.85 })
    );
    bush.position.y = 3 * scale;
    bush.scale.set(1, 0.6, 1);
    g.add(bush);

    const s = 0.7 + Math.random() * 0.6;
    g.scale.set(s, s, s);
    return g;
  }

  // ── حاملة الكرة (Tee) + المضرب فقط ─────────────────────────
  _buildTee() {
    const g = new THREE.Group();

    // قاعدة خشبية
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.0, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
    );
    base.position.y = 0.04;
    base.receiveShadow = true;
    g.add(base);

    // خطوط بيضاء
    const line1 = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.55, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    line1.rotation.x = -Math.PI / 2;
    line1.position.y = 0.085;
    g.add(line1);

    const line2 = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.75, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
    );
    line2.rotation.x = -Math.PI / 2;
    line2.position.y = 0.085;
    g.add(line2);

    // علامة حمراء
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8),
      new THREE.MeshStandardMaterial({ 
        color: 0xff0000, 
        emissive: 0xff0000, 
        emissiveIntensity: 0.3 
      })
    );
    marker.position.y = 0.15;
    g.add(marker);

    // حاملة الكرة (Tee)
    const teeStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.04, 8),
      new THREE.MeshStandardMaterial({ color: 0xffff00, roughness: 0.4 })
    );
    teeStand.position.set(0, 0.1, 0);
    g.add(teeStand);

    // الكرة قبل الإطلاق
    this.teeBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.02135 * 5, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    this.teeBall.position.set(0, 0.14, 0);
    g.add(this.teeBall);

    // ══ المضرب فقط (بدون جسم اللاعب) ══
    const clubGroup = new THREE.Group();
    
    // عمود المضرب
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.012, 1.3, 8),
      new THREE.MeshStandardMaterial({ 
        color: 0x888888, 
        metalness: 0.9, 
        roughness: 0.2 
      })
    );
    shaft.position.set(0, 0.65, 0);
    shaft.rotation.x = 0.2;
    clubGroup.add(shaft);

    // قبضة المضرب
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.02, 0.3, 8),
      new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.8 
      })
    );
    grip.position.set(0, 1.25, 0.06);
    grip.rotation.x = 0.2;
    clubGroup.add(grip);

    // رأس المضرب
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.1),
      new THREE.MeshStandardMaterial({ 
        color: 0x444444, 
        metalness: 0.8, 
        roughness: 0.3 
      })
    );
    head.position.set(0, 0.02, 0.05);
    clubGroup.add(head);

    // وجه المضرب
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        metalness: 0.95, 
        roughness: 0.05 
      })
    );
    face.position.set(0, 0.02, 0.11);
    clubGroup.add(face);

    // وضع المضرب بجانب الـ Tee
    clubGroup.position.set(0.6, 0, 0.3);
    clubGroup.rotation.y = -0.5;
    clubGroup.rotation.z = 0.1;
    g.add(clubGroup);

    g.position.set(0, 0, 0);
    this.scene.add(g);
    this.teeGroup = g;
  }

  _buildFlag(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 3.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7, roughness: 0.2 })
    );
    pole.position.y = 1.75;
    pole.castShadow = true;
    g.add(pole);

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
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0, 2.8, 0);
    flag.rotation.y = -Math.PI / 2;
    flag.castShadow = true;
    g.add(flag);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.7, 0.15, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    base.position.y = 0.075;
    g.add(base);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.54, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    cup.position.y = -0.1;
    g.add(cup);

    this.scene.add(g);
    this.flagGroup = g;
  }

  // ── الكرة ───────────────────────────────────────────────────
  _buildBall() {
    const R = 0.02135 * 5;

    const canvas = document.createElement('canvas');
    canvas.width = 512; 
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, 512, 512);
    
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 3;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(140,140,140,0.5)');
      gr.addColorStop(0.7, 'rgba(200,200,200,0.2)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath(); 
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = gr; 
      ctx.fill();
    }

    ctx.fillStyle = '#cc0000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PRO', 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    this.ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 48),
      new THREE.MeshStandardMaterial({ 
        map: tex, 
        roughness: 0.32, 
        metalness: 0.05,
        envMapIntensity: 0.5
      })
    );
    this.ballMesh.castShadow = true;
    this.ballGroup.add(this.ballMesh);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.7, 32),
      new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.25, 
        depthWrite: false 
      })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.005;
    this.scene.add(this.ballShadow);

    this.scene.add(this.ballGroup);
  }

  // ── خط المسار ───────────────────────────────────────────────
  _buildTrajectoryLine() {
    this.trajMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 });
    this.trajGeo = new THREE.BufferGeometry();
    this.trajLine = new THREE.Line(this.trajGeo, this.trajMat);
    this.scene.add(this.trajLine);
  }

  _buildLandingMarker() {
    const geo = new THREE.RingGeometry(2, 2.5, 32);
    const mat = new THREE.MeshBasicMaterial({ 
      color: 0xffaa00, 
      transparent: true, 
      opacity: 0.6,
      side: THREE.DoubleSide 
    });
    this.landingMarker = new THREE.Mesh(geo, mat);
    this.landingMarker.rotation.x = -Math.PI / 2;
    this.landingMarker.position.y = 0.02;
    this.landingMarker.visible = false;
    this.scene.add(this.landingMarker);
  }

  // ── جسيمات الارتداد ────────────────────────────────────────
  createBounceParticles(pos, intensity = 1) {
    const count = Math.floor(intensity * 20);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    
    for (let i = 0; i < count; i++) {
      positions[i*3] = pos.x;
      positions[i*3+1] = pos.z;
      positions[i*3+2] = -pos.y;
      velocities.push({
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 5 * intensity,
        z: (Math.random() - 0.5) * 4,
        life: 1.0
      });
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ 
      color: 0x8B4513, 
      size: 0.1,
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
      p.life -= dt * 2;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.bounceParticles.splice(i, 1);
        continue;
      }
      
      const positions = p.mesh.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length; j++) {
        const v = p.velocities[j];
        v.y -= 9.81 * dt;
        positions[j*3]   += v.x * dt;
        positions[j*3+1] += v.y * dt;
        positions[j*3+2] += v.z * dt;
        if (positions[j*3+1] < 0) positions[j*3+1] = 0;
      }
      p.mesh.geometry.attributes.position.needsUpdate = true;
      p.mesh.material.opacity = p.life * 0.8;
    }
  }

  // ── تحديث المواقع ───────────────────────────────────────────
  updateBallPosition(pos, omega) {
    const R = 0.02135 * 5;
    this.ballGroup.position.set(pos.x, pos.z + R, -pos.y);
    this.ballShadow.position.set(pos.x, 0.005, -pos.y);
    this.ballShadow.material.opacity = Math.max(0.04, 0.28 - pos.z * 0.015);
    
    if (omega) {
      this.ballMesh.rotation.x += omega.x * 0.016;
      this.ballMesh.rotation.y += omega.y * 0.016;
      this.ballMesh.rotation.z += omega.z * 0.016;
    }

    if (this.teeBall && pos.x > 0.5) {
      this.teeBall.visible = false;
    }
  }

  updateLandingMarker(pos) {
    if (pos && !this.landingMarker.visible) {
      this.landingMarker.visible = true;
    }
    if (pos) {
      this.landingMarker.position.set(pos.x, 0.02, -pos.y);
    }
  }

  hideLandingMarker() {
    this.landingMarker.visible = false;
  }

  updateTrajectory(points) {
    if (points.length < 2) return;
    const positions = [];
    const colors = [];
    let maxZ = 0;
    points.forEach(p => { if (p.z > maxZ) maxZ = p.z; });

    points.forEach(p => {
      positions.push(p.x, p.z, -p.y);
      const t = maxZ > 0 ? p.z / maxZ : 0;
      const c = new THREE.Color().setHSL(0.60 - t * 0.55, 1, 0.52);
      colors.push(c.r, c.g, c.b);
    });

    this.trajGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.trajGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.trajGeo.computeBoundingSphere();
  }

  clearTrajectory() {
    this.trajGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.trajGeo.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    this.trajPts = [];
    this.hideLandingMarker();
    this.bounceParticles.forEach(p => this.scene.remove(p.mesh));
    this.bounceParticles = [];
    if (this.teeBall) this.teeBall.visible = true;
  }

  // ── تحريك البيئة ────────────────────────────────────────────
  updateEnvironment(dt) {
    this.time += dt;

    // تحريك الطيور
    this.birds.forEach(bird => {
      bird.angle += bird.speed * dt * 0.3;
      bird.mesh.position.x = bird.centerX + Math.cos(bird.angle) * bird.radius;
      bird.mesh.position.z = bird.centerZ + Math.sin(bird.angle) * bird.radius;
      bird.mesh.position.y = bird.height + Math.sin(this.time * 2 + bird.angle) * 3;
      bird.mesh.rotation.y = -bird.angle + Math.PI / 2;
      
      const wingSpeed = 8;
      const wingAngle = Math.sin(this.time * wingSpeed) * 0.5;
      bird.mesh.userData.leftWing.rotation.z = wingAngle;
      bird.mesh.userData.rightWing.rotation.z = -wingAngle;
    });

    // تحريك الرياح (الراية)
    if (this.windFlag) {
      const positions = this.windFlag.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const wave = Math.sin(x * 3 + this.time * 4) * 0.1 * (x / 1.5);
        positions.setZ(i, wave);
      }
      positions.needsUpdate = true;
    }
  }

  // ── أوضاع الكاميرا ──────────────────────────────────────────
  updateCamera(ballPhysicsPos) {
    const ballVec = new THREE.Vector3(ballPhysicsPos.x, ballPhysicsPos.z, -ballPhysicsPos.y);

    if (this.cameraMode === 'follow') {
      const desired = new THREE.Vector3(
        ballPhysicsPos.x - 25, 
        ballPhysicsPos.z + 12, 
        -ballPhysicsPos.y + 8
      );
      this.camera.position.lerp(desired, 0.06);
      this.controls.target.lerp(ballVec, 0.08);
      this.controls.enabled = true;

    } else if (this.cameraMode === 'landing') {
      this.camera.position.lerp(new THREE.Vector3(140, 30, 40), 0.03);
      this.controls.target.lerp(new THREE.Vector3(HOLE_X, 0, 0), 0.04);
      this.controls.enabled = true;

    } else if (this.cameraMode === 'top') {
      const desired = new THREE.Vector3(ballPhysicsPos.x, 80, -ballPhysicsPos.y);
      this.camera.position.lerp(desired, 0.05);
      this.controls.target.lerp(ballVec, 0.1);
      this.controls.enabled = true;

    } else if (this.cameraMode === 'player') {
      const desired = new THREE.Vector3(-3, 2, 0);
      this.camera.position.lerp(desired, 0.1);
      this.controls.target.lerp(new THREE.Vector3(50, 0, 0), 0.05);
      this.controls.enabled = true;

    } else {
      this.controls.enabled = true;
      
      const moveSpeed = this._keys['shift'] ? 1.5 : 0.5;
      
      const dir = new THREE.Vector3();
      const right = new THREE.Vector3();
      
      if (this._keys['w'] || this._keys['arrowup']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        this.camera.position.addScaledVector(dir, moveSpeed); 
        this.controls.target.addScaledVector(dir, moveSpeed); 
      }
      if (this._keys['s'] || this._keys['arrowdown']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        this.camera.position.addScaledVector(dir, -moveSpeed); 
        this.controls.target.addScaledVector(dir, -moveSpeed); 
      }
      if (this._keys['a'] || this._keys['arrowleft']) { 
        this.camera.getWorldDirection(dir); 
        dir.y = 0; 
        dir.normalize(); 
        right.crossVectors(dir, this.camera.up).normalize();
        this.camera.position.addScaledVector(right, -moveSpeed); 
        this.controls.target.addScaledVector(right, -moveSpeed); 
      }
      if (this._keys['d'] || this._keys['arrowright']) { 
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
    this.ballGroup.position.set(0, 0.02135 * 5, 0);
    this.ballShadow.position.set(0, 0.005, 0);
    this.ballMesh.rotation.set(0, 0, 0);
    this.clearTrajectory();
  }
}