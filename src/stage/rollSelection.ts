import { toStage } from "./toStage";

export function rollTimeAtPointer({
  clientX,
  clientY,
  viewportWidth,
  rotate,
  canvasTop,
  canvasHeight,
  aligned,
  position,
  zoom,
}: {
  clientX: number;
  clientY: number;
  viewportWidth: number;
  rotate: boolean;
  canvasTop: number;
  canvasHeight: number;
  aligned: boolean;
  position: number;
  zoom: number;
}) {
  const stagePoint = toStage(clientX, clientY, rotate, viewportWidth);
  const chartBottom = canvasHeight - (aligned ? 2 : 34);
  return Math.max(0, position + (chartBottom - (stagePoint.y - canvasTop)) / zoom);
}
