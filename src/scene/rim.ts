import * as THREE from 'three';

/**
 * Randkontur für Figuren: Zum Rand der Silhouette hin wird die Farbe in `color` überblendet.
 * Schwarze Figuren bekommen so einen hellen, weiße einen dunklen Saum – die Form bleibt auf jedem Feld
 * und aus jeder Richtung lesbar, auch wenn das Licht von hinten kommt oder die Figur vor einem gleichfarbigen Feld steht.
 */
export interface RimOptions {
  color: string;
  /** 0..1: Anteil der Randfarbe am äußersten Rand */
  strength: number;
  /** Je größer, desto schmaler der Saum */
  power: number;
}

export function addRim<T extends THREE.Material>(material: T, { color, strength, power }: RimOptions): T {
  const rimColor = new THREE.Color(color);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rimColor };
    shader.uniforms.rimStrength = { value: strength };
    shader.uniforms.rimPower = { value: power };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;')
      .replace(
        '#include <opaque_fragment>',
        `float rimFacing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight = mix(outgoingLight, rimColor, pow(1.0 - rimFacing, rimPower) * rimStrength);
        #include <opaque_fragment>`,
      );
  };
  // Gleicher Shader für alle Figuren-Materialien mit Saum (die Werte stecken in den Uniforms)
  material.customProgramCacheKey = () => 'rim';
  material.needsUpdate = true;
  return material;
}

/** Ein Klon (z. B. geschlagene Figur) behält den Saum */
export function copyRim(from: THREE.Material, to: THREE.Material) {
  to.onBeforeCompile = from.onBeforeCompile;
  to.customProgramCacheKey = from.customProgramCacheKey;
}

export const PIECE_RIM: Record<'w' | 'b', RimOptions> = {
  w: { color: '#1a1208', strength: 0.5, power: 2.2 },
  b: { color: '#c9ced8', strength: 0.55, power: 1.7 },
};
