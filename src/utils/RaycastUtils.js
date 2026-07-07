import * as THREE from 'three';

export class RaycastUtils {
  constructor(groundMeshes, terrainHeightCallback) {
    this.groundMeshes = groundMeshes;
    this.terrainHeightCallback = terrainHeightCallback;
    this.raycaster = new THREE.Raycaster();
    this._rayOrigin = new THREE.Vector3();
    this._rayDirection = new THREE.Vector3(0, -1, 0);
  }

  getGroundHeight(x, z) {
    this._rayOrigin.set(x, 1000, z);
    this.raycaster.set(this._rayOrigin, this._rayDirection);

    let targets = [];
    if (x >= -750 && x <= 1750 && z >= -90 && z <= 90) {

      targets = this.groundMeshes ? this.groundMeshes.filter(m => m && m.name !== 'roughMesh') : [];
    } else {

      targets = this.groundMeshes ? this.groundMeshes.filter(m => m && m.name === 'roughMesh') : [];
    }

    if (targets.length === 0) {
      return this.terrainHeightCallback(x, z);
    }

    const intersects = this.raycaster.intersectObjects(targets, false);
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }

    return this.terrainHeightCallback(x, z);
  }

  getDetailedGroundInfo(x, z) {
    this._rayOrigin.set(x, 1000, z);
    this.raycaster.set(this._rayOrigin, this._rayDirection);

    let targets = [];
    if (x >= -750 && x <= 1750 && z >= -90 && z <= 90) {
      targets = this.groundMeshes ? this.groundMeshes.filter(m => m && m.name !== 'roughMesh') : [];
    } else {
      targets = this.groundMeshes ? this.groundMeshes.filter(m => m && m.name === 'roughMesh') : [];
    }

    if (targets.length > 0) {
      const intersects = this.raycaster.intersectObjects(targets, false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const normal = new THREE.Vector3(0, 1, 0);
        if (hit.face) {
          normal.copy(hit.face.normal);
          normal.transformDirection(hit.object.matrixWorld);
        }
        return {
          height: hit.point.y,
          normal: normal,
          meshName: hit.object.name || 'Unnamed Mesh'
        };
      }
    }

    return {
      height: this.terrainHeightCallback(x, z),
      normal: new THREE.Vector3(0, 1, 0),
      meshName: 'Terrain Height Function'
    };
  }
}
