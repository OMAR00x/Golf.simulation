// ============================================================
// Lighting.js — Environment Lighting & Atmospheric Effects Class
// ============================================================
import * as THREE from 'three';

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.sunLight = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.skyDome = null;
    this.sunMesh = null;
    this.halos = [];
    this.clouds = [];
    this.rainbow = null;
    this.build();
  }

  build() {
    // 1. Lighting Setup
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.FogExp2(0xB0E0E6, 0.0012);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
    this.sunLight.position.set(120, 120, 80);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.left = -200;
    this.sunLight.shadow.camera.right = 600;
    this.sunLight.shadow.camera.top = 250;
    this.sunLight.shadow.camera.bottom = -250;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 1000;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 0.5);
    this.scene.add(this.hemiLight);

    // 2. Sky Dome
    const skyGeo = new THREE.SphereGeometry(1500, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87CEEB,
      side: THREE.BackSide,
      fog: false
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Sun Visual Sphere
    const sunGeo = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFF8DC, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(300, 250, -200);
    this.scene.add(this.sunMesh);

    // Sun Halos
    for (let i = 1; i <= 3; i++) {
      const haloGeo = new THREE.SphereGeometry(15 + i * 8, 32, 32);
      const haloMat = new THREE.MeshBasicMaterial({ 
        color: 0xFFE4B5, 
        transparent: true, 
        opacity: 0.08 / i,
        fog: false 
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(this.sunMesh.position);
      this.scene.add(halo);
      this.halos.push(halo);
    }

    // Clouds
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
      this.clouds.push(g);
    });

    // Rainbow
    const rainbowGeo = new THREE.TorusGeometry(800, 15, 2, 64, Math.PI);
    const rainbowMat = new THREE.MeshBasicMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      fog: false
    });
    this.rainbow = new THREE.Mesh(rainbowGeo, rainbowMat);
    this.rainbow.position.set(200, 100, -400);
    this.rainbow.rotation.x = Math.PI / 2;
    this.rainbow.rotation.z = -0.2;
    this.scene.add(this.rainbow);
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
      const c = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 12, 12), mat);
      c.position.set(x * scale, y * scale, z * scale);
      g.add(c);
    });
    return g;
  }

  dispose() {
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.sunLight);
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.skyDome);
    this.scene.remove(this.sunMesh);
    this.halos.forEach(h => this.scene.remove(h));
    this.clouds.forEach(c => {
      c.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.scene.remove(c);
    });
    this.scene.remove(this.rainbow);
  }
}
