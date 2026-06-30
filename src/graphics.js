// ============================================================
// graphics.js — نظام الجرافيكس الكامل بـ Three.js
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HOLE_X = 170;

export class GraphicsSystem {
  constructor() {
    this.container  = document.getElementById('canvas-container');
    this.scene      = new THREE.Scene();
    this.ballMesh   = null;
    this.ballGroup  = new THREE.Group();
    this.trajPts    = [];
    this.trajLine   = null;
    this.cameraMode = 'player';
    this.landingMarker = null;
    this.bounceParticles = [];
    this.teeGroup = null;
    this.flagGroup = null;
    this.birds = [];
    this.time = 0;
    this.clubPivot = null;
    this.loadedBallModel = null;
    this.loadedTeeHeight = 0.14;
    this.proceduralTeeBase = null;
    this.proceduralTeeStand = null;
    this.proceduralClubGroup = null;

    // Swing animation state
    this.clubState = 'idle'; // 'idle' | 'swinging'
    this.swingTime = 0;
    this.onImpact = null;
    this.onSwingComplete = null;

    this._initRenderer();
    this._initLighting();
    this._buildSky();
    this._buildEnvironment();
    this._buildCourse();
    this._buildTee();
    this._buildBall();
    this._buildTrajectoryLine();
    this._buildAimLine();
    this._buildLandingMarker();
    this._buildWindIndicator();
    this._loadModels();

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
    this.controls.maxDistance    = 3000;

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
    sun.shadow.camera.left      = -200;
    sun.shadow.camera.right     = 600;
    sun.shadow.camera.top       = 250;
    sun.shadow.camera.bottom    = -250;
    sun.shadow.camera.near      = 1;
    sun.shadow.camera.far       = 1000;
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
    // --- Massive main rough terrain ---
    const roughGeo = new THREE.PlaneGeometry(4000, 3000, 160, 120);
    const roughPos = roughGeo.attributes.position;
    for (let i = 0; i < roughPos.count; i++) {
      const x = roughPos.getX(i), z = roughPos.getY(i);
      const onFairway = Math.abs(z) < 40;
      let h = 0;
      if (!onFairway) {
        // Natural mountain terrain heights scaled proportionally (divided frequency by 5)
        h  = Math.sin(x * 0.004) * Math.cos(z * 0.005) * 25;
        h += Math.sin(x * 0.01 + 2) * 8;
        h += Math.cos(z * 0.006 + 1) * 10;
        if (Math.abs(z) > 200) h += Math.max(0, Math.sin(x * 0.0024) * 45);
        const blend = Math.min(1, (Math.abs(z) - 40) / 75);
        h *= blend;
      }
      roughPos.setZ(i, h);
    }
    roughGeo.computeVertexNormals();
    const roughMesh = new THREE.Mesh(roughGeo,
      new THREE.MeshStandardMaterial({ color: 0x3d6b33, roughness: 0.95 }));
    roughMesh.rotation.x    = -Math.PI / 2;
    roughMesh.position.set(300, 0, 0); // centered at 300
    roughMesh.receiveShadow = true;
    this.scene.add(roughMesh);

    // --- Expanded Fairway ---
    const fairway = this._flatPlane(1200, 80, 0x4a8a52, 0.85, 300, 0.005, 0);
    this.scene.add(fairway);

    // --- Fairway Stripes ---
    for (let i = 0; i < 9; i++) {
      const line = this._flatPlane(1200, 0.25, 0x5a9a62, 0.7, 300, 0.008, -32 + i * 8);
      this.scene.add(line);
    }

    // --- Putting Green ---
    const greenGeo = new THREE.CircleGeometry(18, 64);
    const greenMesh = new THREE.Mesh(greenGeo,
      new THREE.MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.55 }));
    greenMesh.rotation.x = -Math.PI / 2;
    greenMesh.position.set(HOLE_X, 0.01, 0);
    greenMesh.receiveShadow = true;
    this.scene.add(greenMesh);

    // --- Green Slopes ---
    const greenBump = new THREE.Mesh(
      new THREE.SphereGeometry(15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2d6b3a, roughness: 0.6, transparent: true, opacity: 0.3 })
    );
    greenBump.position.set(HOLE_X, -0.5, 0);
    greenBump.scale.y = 0.1;
    this.scene.add(greenBump);

    // --- Hole Cup ---
    const holeCyl = new THREE.CylinderGeometry(0.54, 0.54, 0.4, 32);
    const holeMesh = new THREE.Mesh(holeCyl,
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }));
    holeMesh.position.set(HOLE_X, -0.15, 0);
    this.scene.add(holeMesh);

    // Hole Cup Rim
    const ringGeo  = new THREE.TorusGeometry(0.54, 0.08, 16, 32);
    const ringMesh = new THREE.Mesh(ringGeo,
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(HOLE_X, 0.01, 0);
    this.scene.add(ringMesh);

    // --- Flag ---
    this._buildFlag(HOLE_X, 0, 0);

    // --- Distance Markers ---
    [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600].forEach(d => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
      );
      post.position.set(d, 0.75, 42); // placed on the side of the wider fairway
      post.castShadow = true;
      this.scene.add(post);

      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      sign.position.set(d, 1.4, 42);
      this.scene.add(sign);

      const line = this._flatPlane(0.2, 84, 0xffffff, 0.5, d, 0.006, 0);
      line.material.transparent = true; 
      line.material.opacity = 0.15;
      this.scene.add(line);
    });

    // --- Majestic Surrounding Trees ---
    const getTerrainHeight = (x, z) => {
      const distFromFairway = Math.abs(z);
      if (distFromFairway < 40) return 0;
      let h = Math.sin(x * 0.004) * Math.cos(z * 0.005) * 25;
      h += Math.sin(x * 0.01 + 2) * 8;
      if (distFromFairway > 200) h += Math.max(0, Math.sin(x * 0.0024) * 45);
      const blend = Math.min(1, (distFromFairway - 40) / 75);
      return h * blend;
    };

    for (let i = 0; i < 300; i++) {
      const tree = this._makeTree();
      const side = Math.random() > 0.5 ? 1 : -1;
      const x    = -500 + Math.random() * 1700;
      const z    = side * (55 + Math.random() * 650);
      const y    = getTerrainHeight(x, z);
      tree.position.set(x, y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(tree);
    }

    // --- Sand Bunkers ---
    [[180, 0, -42], [270, 0, 42], [120, 0, -48], [380, 0, -42]].forEach(([x, y, z]) => {
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

    // --- Foot Path ---
    const path = this._flatPlane(4, 800, 0xc4a86b, 0.9, 300, 0.01, 45);
    this.scene.add(path);

    // --- Rest Benches ---
    for (let i = 0; i < 6; i++) {
      const bench = this._makeBench();
      bench.position.set(25 + i * 85, 0, 45);
      bench.rotation.y = -0.2 + Math.random() * 0.1;
      this.scene.add(bench);
    }

    // --- Golf Cart ---
    const cart = this._makeGolfCart();
    cart.position.set(15, 0, -45);
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

    // خطوط بيضاء للـ Tee Area (زينة فقط)
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

    // علامة حمراء (زينة)
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

    // الكرة قبل الإطلاق - تبدأ كمجموعة فارغة ويتم تعبئتها بالموديل الحقيقي فور تحميله
    this.teeBall = new THREE.Group();
    this.teeBall.position.set(0, 0.14, 0);
    g.add(this.teeBall);

    // المضرب - يبدأ كمجموعة فارغة ويتم وضع الموديل الحقيقي والـ Pivot بداخلها فور تحميله
    this.clubGroup = new THREE.Group();
    
    // وضع المضرب بجانب الـ Tee بشكل افتراضي
    this.clubGroup.position.set(-0.15, 0, 0.1);
    this.clubGroup.rotation.set(0, 0, 0.05);
    g.add(this.clubGroup);

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

    // Initialize ballMesh as a group instead of a procedural sphere geometry.
    // The loaded GLB model will be added as a child of this group.
    this.ballMesh = new THREE.Group();
    this.ballGroup.add(this.ballMesh);
    
    // Hide the flying ball by default to prevent overlapping/z-fighting with teeBall
    this.ballGroup.visible = false;

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

  _buildAimLine() {
    const mat = new THREE.LineDashedMaterial({
      color: 0x00ffcc,
      dashSize: 0.25,
      gapSize: 0.15,
      linewidth: 3
    });
    
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(15, 0, 0)
    ]);
    
    this.aimLine = new THREE.Line(geo, mat);
    this.aimLine.computeLineDistances();
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);
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
  updateBallPosition(pos, omega, dt) {
    const R = 0.02135 * 5;
    this.ballGroup.position.set(pos.x, pos.z + R, -pos.y);
    this.ballShadow.position.set(pos.x, 0.005, -pos.y);
    this.ballShadow.material.opacity = Math.max(0.04, 0.28 - pos.z * 0.015);
    
    // Ensure flying ball is visible and tee ball is hidden
    this.ballGroup.visible = true;
    if (this.teeBall) {
      this.teeBall.visible = false;
    }

    if (omega) {
      const stepDt = (dt !== undefined) ? dt : 0.016;
      this.ballMesh.rotation.x += omega.x * stepDt;
      this.ballMesh.rotation.y += omega.y * stepDt;
      this.ballMesh.rotation.z += omega.z * stepDt;
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

    // تحريك المضرب (Smooth, stable and FPS-independent swing rotation)
    const clubObj = this.clubPivot || this.proceduralClubGroup;
    if (clubObj) {
      if (this.clubState === 'idle') {
        // Keep the club completely stationary when not swinging to remove all jitter
        if (this.clubPivot) {
          this.clubPivot.rotation.z = 0;
        } else {
          this.proceduralClubGroup.rotation.z = 0.05;
        }
      } else {
        this.swingTime += dt;
        const t = this.swingTime;
        
        const T_back = 0.40;
        const T_down = 0.15;
        const T_follow = 0.25;
        const T_return = 0.50;

        let zRot = 0;

        if (t < T_back) {
          // 1. Backswing: Smooth sine-squared easing (negative Z rotation moves club backward)
          const pct = t / T_back;
          zRot = -1.2 * Math.sin(pct * Math.PI / 2) * Math.sin(pct * Math.PI / 2);
        } else if (t < T_back + T_down) {
          // 2. Downswing: Acceleration to impact (using cosine interpolation, moves forward to 0.0)
          const pct = (t - T_back) / T_down;
          zRot = -1.2 * Math.cos(pct * Math.PI / 2);
        } else if (t < T_back + T_down + T_follow) {
          // 3. Follow-through: Trigger impact exactly once (positive Z rotation moves past the ball)
          if (this.onImpact) {
            this.onImpact();
            this.onImpact = null;
          }
          const pct = (t - (T_back + T_down)) / T_follow;
          zRot = 0.8 * Math.sin(pct * Math.PI / 2);
        } else if (t < T_back + T_down + T_follow + T_return) {
          // 4. Return to address: Smooth squared return easing back to zero
          const pct = (t - (T_back + T_down + T_follow)) / T_return;
          zRot = 0.8 * (1 - pct) * (1 - pct);
        } else {
          // 5. Done: Return exactly to zero
          zRot = 0;
          this.clubState = 'idle';
          this.swingTime = 0;
          if (this.onSwingComplete) {
            this.onSwingComplete();
            this.onSwingComplete = null;
          }
        }

        // Apply rotation to the target pivot
        if (this.clubPivot) {
          this.clubPivot.rotation.z = zRot;
        } else {
          this.proceduralClubGroup.rotation.z = 0.05 + zRot;
        }
      }
    }

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

  startSwing(onImpact, onComplete) {
    this.clubState = 'swinging';
    this.swingTime = 0;
    this.onImpact = onImpact;
    this.onSwingComplete = onComplete;
  }

  // ── تحميل الموديلات وإدارتها ──────────────────────────────────────
  _loadModels() {
    const manager = new THREE.LoadingManager();
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingOverlay = document.getElementById('loading-overlay');

    manager.onStart = (url, itemsLoaded, itemsTotal) => {
      if (progressBar) progressBar.style.width = '0%';
      if (progressText) progressText.textContent = '0%';
    };

    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${progress}%`;
    };

    manager.onLoad = () => {
      setTimeout(() => {
        if (loadingOverlay) {
          loadingOverlay.style.opacity = '0';
          loadingOverlay.style.visibility = 'hidden';
        }
      }, 500);
    };

    manager.onError = (url) => {
      console.warn(`Failed loading asset: ${url}`);
    };

    const loader = new GLTFLoader(manager);

    loader.load('Golf%20ball.glb', (gltf) => {
      this._onBallModelLoaded(gltf);
    }, undefined, (err) => console.error('Error loading golf ball:', err));

    loader.load('Golf%20tee.glb', (gltf) => {
      this._onTeeModelLoaded(gltf);
    }, undefined, (err) => console.error('Error loading golf tee:', err));

    loader.load('Golf%20club.glb', (gltf) => {
      this._onClubModelLoaded(gltf);
    }, undefined, (err) => console.error('Error loading golf club:', err));
  }

  _isBoxInCameraView(box) {
    this.camera.updateMatrixWorld(true);
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(projScreenMatrix);
    return frustum.intersectsBox(box);
  }

  _adjustCameraToFit(box) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2.5;

    const direction = new THREE.Vector3(-1.2, 0.9, 0.8).normalize();
    const newCameraPosition = center.clone().addScaledVector(direction, cameraZ);

    this.camera.position.copy(newCameraPosition);
    this.controls.target.copy(center);
    this.controls.update();

    console.log(`[Camera Adjust] Positioned camera at:`, this.camera.position, `looking at center:`, center);
  }

  _onBallModelLoaded(gltf) {
    const ballModel = gltf.scene;
    
    ballModel.updateMatrixWorld(true);

    ballModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = 0.35;
          node.material.metalness = 0.05;
          if (node.material.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
        }
        if (!node.geometry.attributes.normal) {
          node.geometry.computeVertexNormals();
        }
      }
    });

    let box = new THREE.Box3().setFromObject(ballModel);
    let size = new THREE.Vector3();
    box.getSize(size);
    const R = 0.02135 * 5;
    const targetDiameter = R * 2;
    const maxExtent = Math.max(size.x, size.y, size.z);
    const scaleFactor = targetDiameter / maxExtent;
    ballModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

    ballModel.updateMatrixWorld(true);

    box.setFromObject(ballModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    ballModel.position.sub(center);

    ballModel.updateMatrixWorld(true);

    box.setFromObject(ballModel);
    box.getSize(size);
    box.getCenter(center);

    const ballWrapper = new THREE.Group();
    ballWrapper.add(ballModel);
    ballWrapper.updateMatrixWorld(true);

    this.loadedBallModel = ballWrapper;

    if (this.ballGroup && this.ballMesh) {
      this.ballGroup.remove(this.ballMesh);
      this.ballMesh = ballWrapper;
      this.ballGroup.add(this.ballMesh);
      this.ballGroup.visible = false; // Hide by default
    }

    if (this.teeGroup && this.teeBall) {
      this.teeGroup.remove(this.teeBall);
      this.teeBall = ballWrapper.clone();
      const teeHeight = this.loadedTeeHeight || 0.14; 
      this.teeBall.position.set(0, teeHeight - 0.01, 0);
      this.teeGroup.add(this.teeBall);
      this.teeBall.visible = true; // Tee ball should be visible initially!
    }

    console.log(`[Golf Ball GLB Loaded Successfully]`);
    console.log(`- Position:`, ballModel.position);
    console.log(`- Rotation:`, ballModel.rotation);
    console.log(`- Scale:`, ballModel.scale);
    console.log(`- Bounding Box Min:`, box.min, `Max:`, box.max);
    console.log(`- Size:`, size);
    console.log(`- Center:`, center);
    console.log(`- Distance from camera:`, this.camera.position.distanceTo(center));

    if (!this._isBoxInCameraView(box)) {
      console.log(`[Camera Adjust] Golf Ball is outside camera view! Adjusting...`);
      this._adjustCameraToFit(box);
    }
  }

  _onTeeModelLoaded(gltf) {
    const teeModel = gltf.scene;

    teeModel.updateMatrixWorld(true);

    teeModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (!node.geometry.attributes.normal) {
          node.geometry.computeVertexNormals();
        }
      }
    });

    let box = new THREE.Box3().setFromObject(teeModel);
    let size = new THREE.Vector3();
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

    if (this.proceduralTeeStand) {
      this.teeGroup.remove(this.proceduralTeeStand);
    }
    if (this.proceduralTeeBase) {
      this.teeGroup.remove(this.proceduralTeeBase);
    }

    this.teeGroup.add(teeModel);

    if (this.teeBall) {
      this.teeBall.position.y = this.loadedTeeHeight - 0.01;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log(`[Golf Tee GLB Loaded Successfully]`);
    console.log(`- Position:`, teeModel.position);
    console.log(`- Rotation:`, teeModel.rotation);
    console.log(`- Scale:`, teeModel.scale);
    console.log(`- Bounding Box Min:`, box.min, `Max:`, box.max);
    console.log(`- Size:`, size);
    console.log(`- Center:`, center);
    console.log(`- Distance from camera:`, this.camera.position.distanceTo(center));

    if (!this._isBoxInCameraView(box)) {
      console.log(`[Camera Adjust] Golf Tee is outside camera view! Adjusting...`);
      this._adjustCameraToFit(box);
    }
  }

  _onClubModelLoaded(gltf) {
    const clubModel = gltf.scene;

    clubModel.updateMatrixWorld(true);

    clubModel.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (!node.geometry.attributes.normal) {
          node.geometry.computeVertexNormals();
        }
      }
    });

    let box = new THREE.Box3().setFromObject(clubModel);
    let size = new THREE.Vector3();
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

    this.clubPivot = new THREE.Group();
    this.clubPivot.add(clubModel);
    this.clubPivot.position.set(0, targetHeight, 0);

    this.clubPivot.updateMatrixWorld(true);

    if (this.clubGroup) {
      while (this.clubGroup.children.length > 0) {
        this.clubGroup.remove(this.clubGroup.children[0]);
      }

      this.clubGroup.add(this.clubPivot);
      
      // Calculate perfect address position so the front face of the club head
      // touches the back of the ball.
      const R = 0.02135 * 5; // ball radius
      const ballMinX = -R;
      const tempBox = new THREE.Box3().setFromObject(clubModel);
      const clubMaxX = tempBox.max.x;
      const targetClubX = ballMinX - clubMaxX;

      this.clubGroup.position.set(targetClubX, 0, 0); 
      this.clubGroup.rotation.set(0, 0, 0.0);
      this.clubGroup.updateMatrixWorld(true);
    }

    box.setFromObject(clubModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log(`[Golf Club GLB Loaded Successfully]`);
    console.log(`- Position:`, clubModel.position);
    console.log(`- Rotation:`, clubModel.rotation);
    console.log(`- Scale:`, clubModel.scale);
    console.log(`- Bounding Box Min:`, box.min, `Max:`, box.max);
    console.log(`- Size:`, size);
    console.log(`- Center:`, center);
    console.log(`- Distance from camera:`, this.camera.position.distanceTo(center));

    if (!this._isBoxInCameraView(box)) {
      console.log(`[Camera Adjust] Golf Club is outside camera view! Adjusting...`);
      this._adjustCameraToFit(box);
    }
  }

  // ── أوضاع الكاميرا ──────────────────────────────────────────
  updateCamera(ballPhysicsPos, phiDeg) {
    const R = 0.02135 * 5;
    const ballVec = new THREE.Vector3(ballPhysicsPos.x, ballPhysicsPos.z + R, -ballPhysicsPos.y);

    if (this.cameraMode === 'follow') {
      // 🎥 PGA Tour Ball Follow Camera
      // Position camera behind the ball along the flight vector, elevated slightly
      let phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;
      
      const camDist = 12.0;
      const camHeight = 3.5;
      
      // Calculate target camera position behind the ball
      const desiredX = ballVec.x - camDist * Math.cos(phiRad);
      const desiredZ = ballVec.z + camDist * Math.sin(phiRad);
      const desiredY = ballVec.y + camHeight;
      
      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      
      // Interpolate smoothly
      this.camera.position.lerp(desiredCamPos, 0.05);
      
      // Collision avoidance with ground
      this.camera.position.y = Math.max(this.camera.position.y, 0.4);
      
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
      // 🎥 Aim Camera: smooth positioning behind the ball relative to aim angle
      const phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;
      const camDist = 3.0;
      const camHeight = 1.0;
      
      const desiredX = ballVec.x - camDist * Math.cos(phiRad);
      const desiredZ = ballVec.z + camDist * Math.sin(phiRad);
      const desiredY = ballVec.y + camHeight;
      
      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      
      this.camera.position.lerp(desiredCamPos, 0.08);
      
      // Collision avoidance with ground
      this.camera.position.y = Math.max(this.camera.position.y, 0.3);
      
      this.controls.target.lerp(ballVec, 0.08);
      this.controls.enabled = true;

    } else if (this.cameraMode === 'hole') {
      // 🎥 Hole Cinematic Camera: orbit slowly around the cup
      const orbitSpeed = 0.25;
      const angle = (this.time !== undefined ? this.time : performance.now() / 1000) * orbitSpeed;
      const radius = 3.5;
      const height = 1.8;
      
      const desiredX = HOLE_X + radius * Math.cos(angle);
      const desiredZ = 0 + radius * Math.sin(angle);
      const desiredY = height;
      
      const desiredCamPos = new THREE.Vector3(desiredX, desiredY, desiredZ);
      
      this.camera.position.lerp(desiredCamPos, 0.04);
      
      // Look slightly inside the cup (Y = -0.05)
      const holeTarget = new THREE.Vector3(HOLE_X, -0.05, 0);
      this.controls.target.lerp(holeTarget, 0.05);
      this.controls.enabled = false; // lock orbit controls to keep camera control automatic

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

  updateClubPositionAndAim(pos, phiDeg) {
    if (!this.clubGroup) return;

    // Show the club
    this.clubGroup.visible = true;

    const R = 0.02135 * 5; // ball radius
    let clubMaxX = 0.06; // fallback
    if (this.clubMaxX !== undefined) {
      clubMaxX = this.clubMaxX;
    }

    const targetDistance = R + clubMaxX;
    const phiRad = (phiDeg !== undefined ? phiDeg : 0) * Math.PI / 180;

    // Three.js world coordinates of the ball
    const ballX = pos.x;
    const ballY = pos.z; // height
    const ballZ = -pos.y;

    // Position clubGroup behind the ball along the aim angle
    const targetClubX = ballX - targetDistance * Math.cos(phiRad);
    const targetClubZ = ballZ + targetDistance * Math.sin(phiRad);

    this.clubGroup.position.set(targetClubX, ballY, targetClubZ);
    this.clubGroup.rotation.set(0, phiRad, 0);
    this.clubGroup.updateMatrixWorld(true);
  }

  getClubForwardVector(thetaDeg) {
    if (!this.clubPivot) return new THREE.Vector3(1, 0, 0);

    const thetaRad = (thetaDeg !== undefined ? thetaDeg : 15) * Math.PI / 180;
    
    // Local forward vector with loft angle: (cos(theta), sin(theta), 0)
    const localForward = new THREE.Vector3(Math.cos(thetaRad), Math.sin(thetaRad), 0);
    
    this.clubPivot.updateMatrixWorld(true);
    
    const worldForward = localForward.transformDirection(this.clubPivot.matrixWorld);
    return worldForward;
  }

  positionBallAt(pos) {
    const R = 0.02135 * 5;
    
    // Set ball group position in Three.js coordinates
    this.ballGroup.position.set(pos.x, pos.z + R, -pos.y);
    this.ballShadow.position.set(pos.x, 0.005, -pos.y);
    
    const isStart = Math.hypot(pos.x, pos.y) < 0.01;
    if (isStart) {
      this.ballGroup.visible = false;
      if (this.teeBall) this.teeBall.visible = true;
    } else {
      this.ballGroup.visible = true;
      if (this.teeBall) this.teeBall.visible = false;
    }
    this.ballGroup.updateMatrixWorld(true);
  }

  updateAimLine(pos, phiDeg, thetaDeg) {
    if (!this.aimLine) return;

    const R = 0.02135 * 5;
    const ballVec = new THREE.Vector3(pos.x, pos.z + R, -pos.y);
    this.aimLine.position.copy(ballVec);

    const clubDir = this.getClubForwardVector(thetaDeg);
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

  resetBall() {
    this.ballGroup.position.set(0, 0.02135 * 5, 0);
    this.ballShadow.position.set(0, 0.005, 0);
    this.ballMesh.rotation.set(0, 0, 0);
    
    // Hide the flying ball and show the tee ball again to prevent overlap
    this.ballGroup.visible = false;
    if (this.teeBall) {
      this.teeBall.visible = true;
    }
    
    if (this.aimLine) {
      this.aimLine.visible = false;
    }
    
    this.clearTrajectory();
  }
}