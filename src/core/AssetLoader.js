import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor() {
    this.cache = {};
  }

  /**
   * Preload all required GLB models and report progress.
   * @param {function} onProgress - Callback for progress reporting.
   * @param {function} onLoad - Callback when all assets are loaded.
   */
  preload(onProgress, onLoad) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = onProgress;
    manager.onLoad = onLoad;

    const loader = new GLTFLoader(manager);
    const assets = [
      { key: 'ball', url: 'Golf%20ball.glb' },
      { key: 'tee', url: 'Golf%20tee.glb' },
      { key: 'club', url: 'Golf%20club.glb' }
    ];

    assets.forEach(asset => {
      loader.load(asset.url, (gltf) => {
        this.cache[asset.key] = gltf.scene;
      }, undefined, (err) => {
        console.warn(`Error loading asset '${asset.key}' from '${asset.url}':`, err);
      });
    });
  }

  /**
   * Get a clone of the cached model for scene instantiation.
   * @param {string} key - The asset key ('ball', 'tee', 'club').
   * @returns {THREE.Group|null} A cloned THREE.Group instance or null if not loaded.
   */
  get(key) {
    const model = this.cache[key];
    if (!model) return null;
    return model.clone();
  }
}
