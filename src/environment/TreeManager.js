import { Tree } from '../entities/Tree.js';
import { TreeSettings } from '../utils/Constants.js';

export class TreeManager {
  constructor(scene, raycastUtils) {
    this.scene = scene;
    this.raycastUtils = raycastUtils;
    this.trees = [];
    this.loadedModel = null;
    this.spawnCoordinates = [];

    this.generateSpawnPoints();
    this.build();
  }

  generateSpawnPoints() {
    for (let i = 0; i < TreeSettings.COUNT; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = -500 + Math.random() * 1700;
      const z = side * (55 + Math.random() * 650);
      const scale = TreeSettings.MIN_SCALE + Math.random() * (TreeSettings.MAX_SCALE - TreeSettings.MIN_SCALE);
      const rotY = Math.random() * Math.PI * 2;
      this.spawnCoordinates.push({ x, z, scale, rotY });
    }
  }

  build() {
    this.clear();
    this.spawnCoordinates.forEach((pt, i) => {
      const tree = new Tree(
        this.scene,
        this.loadedModel,
        pt.x,
        pt.z,
        pt.scale,
        pt.rotY,
        `Surrounding Tree ${i}`,
        this.raycastUtils
      );
      this.trees.push(tree);
    });
  }

  setModel(treeModel) {
    this.loadedModel = treeModel;
    this.build(); 
  }

  clear() {
    this.trees.forEach(t => t.dispose());
    this.trees = [];
  }

  dispose() {
    this.clear();
  }
}
