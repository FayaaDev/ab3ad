'use client';

const MODEL_VIEWER_SCRIPT_SRC = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js';

export function ModelViewerScript() {
  return <script crossOrigin="anonymous" src={MODEL_VIEWER_SCRIPT_SRC} type="module" />;
}
