import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';

// Treffertests (Klick, Hover) über einen Hüllkörperbaum statt über jedes Dreieck.
// Meshes ohne Baum verhalten sich unverändert.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export function enableFastRaycast(geometry: THREE.BufferGeometry): void {
  (geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(geometry);
}
