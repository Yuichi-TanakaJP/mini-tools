"use client";

import styles from "../IndustryMap.module.css";
import { MAX_SCALE, MIN_SCALE, type PanZoom } from "../use-pan-zoom";

/** 図の拡大縮小の操作。放射マップと関係ネットワークで共有する。 */
export default function ZoomControls({ panZoom }: { panZoom: PanZoom }) {
  const { viewport } = panZoom;

  return (
    <div className={styles.zoomControls} role="group" aria-label="図の拡大縮小">
      <button
        type="button"
        className={styles.zoomButton}
        onClick={panZoom.zoomIn}
        disabled={viewport.scale >= MAX_SCALE}
        aria-label="拡大"
        title="拡大"
      >
        ＋
      </button>
      <span className={styles.zoomLevel} aria-live="polite">
        {Math.round(viewport.scale * 100)}%
      </span>
      <button
        type="button"
        className={styles.zoomButton}
        onClick={panZoom.zoomOut}
        disabled={viewport.scale <= MIN_SCALE}
        aria-label="縮小"
        title="縮小"
      >
        −
      </button>
      <button
        type="button"
        className={styles.zoomButton}
        onClick={panZoom.reset}
        disabled={!panZoom.canReset}
        aria-label="表示を元に戻す"
        title="表示を元に戻す"
      >
        ⟲
      </button>
    </div>
  );
}
