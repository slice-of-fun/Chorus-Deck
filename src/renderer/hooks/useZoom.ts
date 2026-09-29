import { ref } from 'vue';

export function useZoom() {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 1.5;
  const ZOOM_STEP = 0.05;

  const zoomFactor = ref(1);

  const initZoomFactor = async () => {
    try {
      const currentZoom = await window.api.invoke<number>('get-content-zoom');
      zoomFactor.value = currentZoom;
    } catch (error) {
      console.error('Failed to get zoom ratio:', error);
    }
  };

  const increaseZoom = () => {
    let newZoom;

    if (zoomFactor.value < 1.0 && zoomFactor.value + ZOOM_STEP > 1.0) {
      newZoom = 1.0;
    } else {
      newZoom = Math.min(MAX_ZOOM, Math.round((zoomFactor.value + ZOOM_STEP) * 20) / 20);
    }

    setZoomFactor(newZoom);
  };

  const decreaseZoom = () => {
    let newZoom;

    if (zoomFactor.value > 1.0 && zoomFactor.value - ZOOM_STEP < 1.0) {
      newZoom = 1.0;
    } else {
      newZoom = Math.max(MIN_ZOOM, Math.round((zoomFactor.value - ZOOM_STEP) * 20) / 20);
    }

    setZoomFactor(newZoom);
  };

  const resetZoom = async () => {
    try {
      setZoomFactor(1);
    } catch (error) {
      console.error('Failed to reset zoom:', error);
    }
  };

  const setZoom100 = () => {
    setZoomFactor(1.0);
  };

  const setZoomFactor = (zoom: number) => {
    window.api.send('set-content-zoom', zoom);
    zoomFactor.value = zoom;
  };

  const isZoom100 = () => {
    return Math.abs(zoomFactor.value - 1.0) < 0.001;
  };

  return {
    zoomFactor,
    initZoomFactor,
    increaseZoom,
    decreaseZoom,
    resetZoom,
    setZoom100,
    setZoomFactor,
    isZoom100,
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_STEP
  };
}