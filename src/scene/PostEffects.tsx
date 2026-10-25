import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Kino-Look für die Grafikstufe „Hoch“:
 * - Umgebungsverdeckung (N8AO): weiche Kontaktschatten zwischen Figuren und Brett
 * - Bloom nur auf den hellsten Glanzlichtern (Gold), damit Felder und Figuren gut lesbar bleiben
 * - ACES-Tone-Mapping (der Composer schaltet das des Renderers ab) und eine dezente Vignette
 */
export function PostEffects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.45} distanceFalloff={1} intensity={2.2} quality="medium" halfRes color="#000000" />
      <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.15} intensity={0.4} radius={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.32} darkness={0.5} />
    </EffectComposer>
  );
}
