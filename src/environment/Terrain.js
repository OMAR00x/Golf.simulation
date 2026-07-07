import * as THREE from 'three';
import { TerrainSettings } from '../utils/Constants.js';

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.groundMeshes = [];
    this.birds = [];
    this.windFlag = null;
    this.windIndicator = null;

    this.build();
    this.buildDecorativeEnvironment();
  }

  getTerrainHeight(xWorld, zWorld) {
    return 0;
  }

  _createProceduralTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (type === 'rough') {

      ctx.fillStyle = '#3a662f';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 30000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const len = 3 + Math.random() * 5;
        const angle = (Math.random() - 0.5) * 0.3;
        const g = 80 + Math.floor(Math.random() * 50);
        ctx.strokeStyle = `rgb(${Math.floor(g*0.4)}, ${g}, ${Math.floor(g*0.5)})`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * Math.sin(angle), y - len * Math.cos(angle));
        ctx.stroke();
      }
    } else if (type === 'fairway') {

      ctx.fillStyle = '#4c8c3f';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#437c37';
      for (let i = 0; i < 512; i += 64) {
        ctx.fillRect(i, 0, 32, 512);
      }

      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (type === 'green') {

      ctx.fillStyle = '#2d6d35';
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#265c2c';
      for (let x = 0; x < 512; x += 32) {
        for (let y = 0; y < 512; y += 32) {
          if (((x+y)/32) % 2 === 0) {
            ctx.fillRect(x, y, 32, 32);
          }
        }
      }
    } else if (type === 'sand') {

      ctx.fillStyle = '#e8d4a7';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#dcc490' : '#f4e4c0';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    } else if (type === 'path') {

      ctx.fillStyle = '#8b7d6b';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 15000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillStyle = Math.random() > 0.5 ? '#706456' : '#a29380';
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  _flatPlane(w, h, color, roughness, x, y, z) {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({ color, roughness });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    return mesh;
  }

  build() {
    const HOLE_X = TerrainSettings.HOLE_X;

    const roughGeo = new THREE.PlaneGeometry(
      TerrainSettings.ROUGH_SIZE_X,
      TerrainSettings.ROUGH_SIZE_Z,
      TerrainSettings.ROUGH_SEG_X,
      TerrainSettings.ROUGH_SEG_Z
    );
    const roughPos = roughGeo.attributes.position;
    for (let i = 0; i < roughPos.count; i++) {
      const x = roughPos.getX(i), z = roughPos.getY(i);
      const h = this.getTerrainHeight(x + 300, z);
      roughPos.setZ(i, h);
    }
    roughGeo.computeVertexNormals();
    const roughTexture = this._createProceduralTexture('rough');
    roughTexture.repeat.set(800, 600);
    const roughMesh = new THREE.Mesh(roughGeo,
      new THREE.MeshStandardMaterial({ map: roughTexture, color: 0xffffff, roughness: 0.8 }));
    roughMesh.name = 'roughMesh';
    roughMesh.rotation.x    = -Math.PI / 2;
    roughMesh.position.set(300, 0, 0); 
    roughMesh.receiveShadow = true;
    this.scene.add(roughMesh);
    this.groundMeshes.push(roughMesh);

    const fairwayGeo = new THREE.PlaneGeometry(
      TerrainSettings.FAIRWAY_SIZE_X,
      TerrainSettings.FAIRWAY_SIZE_Z,
      TerrainSettings.FAIRWAY_SEG_X,
      TerrainSettings.FAIRWAY_SEG_Z
    );
    const fairwayPos = fairwayGeo.attributes.position;
    for (let i = 0; i < fairwayPos.count; i++) {
      const localX = fairwayPos.getX(i);
      const localY = fairwayPos.getY(i);
      const worldX = localX + 500;
      const worldZ = localY;
      const h = this.getTerrainHeight(worldX, worldZ);
      fairwayPos.setZ(i, h + 0.002); 
    }
    fairwayGeo.computeVertexNormals();
    const fairwayTexture = this._createProceduralTexture('fairway');
    const fairwayMat = new THREE.MeshStandardMaterial({ 
      map: fairwayTexture, 
      color: 0xffffff, 
      roughness: 0.55,
      metalness: 0.05
    });
    const fairway = new THREE.Mesh(fairwayGeo, fairwayMat);
    fairway.name = 'fairwayMesh';
    fairway.rotation.x = -Math.PI / 2;
    fairway.position.set(500, 0.005, 0);
    fairway.receiveShadow = true;
    this.scene.add(fairway);
    this.groundMeshes.push(fairway);

    const greenGeo = new THREE.CircleGeometry(18, 64);
    const greenTexture = this._createProceduralTexture('green');
    greenTexture.repeat.set(18, 18);
    const greenMesh = new THREE.Mesh(greenGeo,
      new THREE.MeshStandardMaterial({ map: greenTexture, color: 0xffffff, roughness: 0.35, metalness: 0.05 }));
    greenMesh.name = 'greenMesh';
    greenMesh.rotation.x = -Math.PI / 2;
    greenMesh.position.set(HOLE_X, 0.01, 0);
    greenMesh.receiveShadow = true;
    this.scene.add(greenMesh);
    this.groundMeshes.push(greenMesh);

    [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600].forEach(d => {
      const terrainH = this.getTerrainHeight(d, 42);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
      );
      post.position.set(d, terrainH + 0.75, 42);
      post.castShadow = true;
      this.scene.add(post);

      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      sign.position.set(d, terrainH + 1.4, 42);
      this.scene.add(sign);

      const line = this._flatPlane(0.2, 84, 0xffffff, 0.5, d, terrainH + 0.006, 0);
      line.material.transparent = true; 
      line.material.opacity = 0.15;
      this.scene.add(line);
    });

    [[180, 0, -42], [270, 0, 42], [120, 0, -48], [380, 0, -42]].forEach(([bx, by, bz]) => {
      const terrainH = this.getTerrainHeight(bx, bz);
      const bunkerGeo = new THREE.CylinderGeometry(12, 14, 0.3, 24);
      const sandTexture = this._createProceduralTexture('sand');
      sandTexture.repeat.set(6, 6);
      const bunkerMat = new THREE.MeshStandardMaterial({ 
        map: sandTexture,
        color: 0xffffff, 
        roughness: 0.95 
      });
      const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
      bunker.name = 'bunker';
      bunker.position.set(bx, terrainH - 0.1, bz);
      bunker.receiveShadow = true;
      this.scene.add(bunker);
      this.groundMeshes.push(bunker);

      const edge = new THREE.Mesh(
        new THREE.TorusGeometry(13, 0.5, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xc9b896, roughness: 0.9 })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(bx, terrainH + 0.05, bz);
      this.scene.add(edge);
    });

    const pathGeo = new THREE.PlaneGeometry(
      TerrainSettings.PATH_SIZE_X,
      TerrainSettings.PATH_SIZE_Z,
      TerrainSettings.PATH_SEG_X,
      TerrainSettings.PATH_SEG_Z
    );
    const pathPos = pathGeo.attributes.position;
    for (let i = 0; i < pathPos.count; i++) {
      const localX = pathPos.getX(i);
      const localY = pathPos.getY(i);
      const worldX = localX + 500;
      const worldZ = localY + 55;
      const h = this.getTerrainHeight(worldX, worldZ);
      pathPos.setZ(i, h + 0.003); 
    }
    pathGeo.computeVertexNormals();
    const pathTexture = this._createProceduralTexture('path');
    const pathMat = new THREE.MeshStandardMaterial({
      map: pathTexture,
      color: 0xffffff,
      roughness: 0.9
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.name = 'path';
    path.rotation.x = -Math.PI / 2;
    path.position.set(500, 0.01, 55);
    path.receiveShadow = true;
    this.scene.add(path);
    this.groundMeshes.push(path);

    this.groundMeshes.forEach(mesh => {
      if (mesh) mesh.updateMatrixWorld(true);
    });
  }

  buildDecorativeEnvironment() {

    const mountainMat = new THREE.MeshStandardMaterial({ 
      color: 0x5a6b5c, 
      roughness: 0.95,
      fog: false
    });

    for (let i = 0; i < 20; i++) {
      const h = 100 + Math.random() * 150;
      const w = 80 + Math.random() * 100;
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(w, h, 8), mountainMat);
      const angle = (i / 20) * Math.PI * 2;
      const dist = 600 + Math.random() * 300;
      mountain.position.set(
        Math.cos(angle) * dist,
        h / 2 - 30,
        Math.sin(angle) * dist
      );
      mountain.rotation.y = Math.random() * Math.PI;
      mountain.castShadow = true;
      mountain.receiveShadow = true;
      this.scene.add(mountain);

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
      snowCap.castShadow = true;
      snowCap.receiveShadow = true;
      this.scene.add(snowCap);
    }

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

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 20, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 })
    );
    island.position.set(-250, 1, 200);
    this.scene.add(island);
    this.groundMeshes.push(island);

    const islandTree = this._makeLowPolyTree(0.8);
    this.scene.add(islandTree);
    this._alignObjectToTerrain(islandTree, -250, 200);

    for (let i = 0; i < 50; i++) {
      const tree = this._makeLowPolyTree(0.6 + Math.random() * 0.4);
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 200;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      this.scene.add(tree);
      this._alignObjectToTerrain(tree, x, z);
    }

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

    for (let i = 0; i < 8; i++) {
      const lamp = this._makeLamp();
      const lx = i * 25;
      const lz = -35;
      const ly = this.getTerrainHeight(lx, lz);
      lamp.position.set(lx, ly, lz);
      this.scene.add(lamp);
    }

    for (let i = 0; i < 30; i++) {
      const fence = this._makeFence();
      const fx = i * 8 - 20;
      const fz = 45;
      const fy = this.getTerrainHeight(fx, fz);
      fence.position.set(fx, fy, fz);
      fence.rotation.y = 0.1;
      this.scene.add(fence);
    }

    this.windIndicator = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    pole.position.y = 2;
    this.windIndicator.add(pole);

    const flagGeo = new THREE.PlaneGeometry(1.5, 0.5, 8, 2);
    const flagMat = new THREE.MeshStandardMaterial({ 
      color: 0xff6600, 
      side: THREE.DoubleSide,
      emissive: 0xff3300,
      emissiveIntensity: 0.1
    });
    this.windFlag = new THREE.Mesh(flagGeo, flagMat);
    this.windFlag.position.set(0.75, 3.5, 0);
    this.windIndicator.add(this.windFlag);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    base.position.y = 0.1;
    this.windIndicator.add(base);

    const wx = -5;
    const wz = 8;
    const wy = this.getTerrainHeight(wx, wz);
    this.windIndicator.position.set(wx, wy, wz);
    this.scene.add(this.windIndicator);
  }

  _makeLowPolyTree(scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 3.5 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    trunk.position.y = 1.75 * scale;
    g.add(trunk);

    const leafColors = [0x1a4a1a, 0x2d5a2d, 0x3a6b3a];
    leafColors.forEach((color, i) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((3.0 - i * 0.5) * scale, 3.5 * scale, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
      );
      cone.position.y = (4 + i * 2.5) * scale;
      g.add(cone);
    });
    g.scale.set(scale, scale, scale);
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
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
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

  _makeLamp() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })
    );
    post.position.y = 2;
    g.add(post);

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.5, 4, 0);
    g.add(arm);

    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    head.position.set(1, 3.85, 0);
    g.add(head);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffee })
    );
    bulb.position.set(1, 3.7, 0);
    g.add(bulb);

    const light = new THREE.PointLight(0xffffee, 0.5, 20);
    light.position.set(1, 3.5, 0);
    g.add(light);

    return g;
  }

  _makeFence() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 1.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
    );
    post.position.y = 0.6;
    g.add(post);

    const rail1 = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.08, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9 })
    );
    rail1.position.set(4, 0.9, 0);
    g.add(rail1);

    const rail2 = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.08, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9 })
    );
    rail2.position.set(4, 0.45, 0);
    g.add(rail2);

    return g;
  }

  _alignObjectToTerrain(mesh, x, z) {
    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const bottomY = box.min.y;
    const groundY = this.getTerrainHeight(x, z);
    const yOffset = groundY - bottomY;
    mesh.position.set(x, yOffset, z);
    mesh.updateMatrixWorld(true);
  }

  update(time, dt) {

    this.birds.forEach(bird => {
      bird.angle += bird.speed * dt * 0.3;
      bird.mesh.position.x = bird.centerX + Math.cos(bird.angle) * bird.radius;
      bird.mesh.position.z = bird.centerZ + Math.sin(bird.angle) * bird.radius;
      bird.mesh.rotation.y = -bird.angle + Math.PI / 2;

      const wingSpeed = 8;
      const wingAngle = Math.sin(time * wingSpeed) * 0.5;
      bird.mesh.userData.leftWing.rotation.z = wingAngle;
      bird.mesh.userData.rightWing.rotation.z = -wingAngle;
    });

    if (this.windFlag) {
      const positions = this.windFlag.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const wave = Math.sin(x * 3 + time * 4) * 0.1 * (x / 1.5);
        positions.setZ(i, wave);
      }
      positions.needsUpdate = true;
    }
  }

  dispose() {

    this.groundMeshes.forEach(mesh => {
      if (mesh) {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
          }
        }
        this.scene.remove(mesh);
      }
    });
    this.groundMeshes = [];
    this.birds.forEach(b => this.scene.remove(b.mesh));
    this.birds = [];
    if (this.windIndicator) this.scene.remove(this.windIndicator);
  }
}
