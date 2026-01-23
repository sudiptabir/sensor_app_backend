/**
 * Camera Streaming Utility
 * Manages camera stream URLs for devices
 */

export interface CameraDevice {
  id: string;
  label?: string;
  ipAddress?: string;
  ip_address?: string;  // Alternative field name (snake_case)
  cameraPort?: number;
  camera_port?: number;  // Alternative field name
  [key: string]: any;
}

// Default camera server port
const DEFAULT_CAMERA_PORT = 3000;

/**
 * Get IP address from device (supports both camelCase and snake_case)
 */
function getDeviceIP(device: CameraDevice): string | null {
  return device.ipAddress || device.ip_address || null;
}

/**
 * Get camera port from device (supports both camelCase and snake_case)
 */
function getDevicePort(device: CameraDevice): number {
  return device.cameraPort || device.camera_port || DEFAULT_CAMERA_PORT;
}

/**
 * Get camera stream URL for a device
 * Supports multiple streaming formats
 */
export function getCameraStreamUrl(device: CameraDevice, format: 'h264' | 'mjpeg' | 'hls' = 'h264'): string | null {
  const ipAddress = getDeviceIP(device);
  
  if (!ipAddress) {
    console.warn('[CameraStreaming] Device has no IP address:', device.id);
    return null;
  }

  const port = getDevicePort(device);
  const baseUrl = `http://${ipAddress}:${port}`;

  switch (format) {
    case 'h264':
      return `${baseUrl}/camera/stream`;
    case 'mjpeg':
      return `${baseUrl}/camera/mjpeg`;
    case 'hls':
      return `${baseUrl}/camera/hls/stream.m3u8`;
    default:
      return `${baseUrl}/camera/stream`;
  }
}

/**
 * Get camera status URL
 */
export function getCameraStatusUrl(device: CameraDevice): string | null {
  const ipAddress = getDeviceIP(device);
  if (!ipAddress) return null;
  const port = getDevicePort(device);
  return `http://${ipAddress}:${port}/camera/status`;
}

/**
 * Get camera frame/snapshot URL
 */
export function getCameraSnapshotUrl(device: CameraDevice): string | null {
  const ipAddress = getDeviceIP(device);
  if (!ipAddress) return null;
  const port = getDevicePort(device);
  return `http://${ipAddress}:${port}/camera/frame`;
}

/**
 * Get web UI URL for camera server
 */
export function getCameraWebUIUrl(device: CameraDevice): string | null {
  const ipAddress = getDeviceIP(device);
  if (!ipAddress) return null;
  const port = getDevicePort(device);
  return `http://${ipAddress}:${port}`;
}

/**
 * Check if device has streaming capability
 */
export function hasStreamingCapability(device: CameraDevice): boolean {
  return !!getDeviceIP(device);
}

/**
 * Get device streaming info
 */
export function getDeviceStreamingInfo(device: CameraDevice) {
  const ipAddress = getDeviceIP(device);
  const port = getDevicePort(device);
  
  return {
    hasStreaming: !!ipAddress,
    streamUrl: getCameraStreamUrl(device),
    statusUrl: getCameraStatusUrl(device),
    snapshotUrl: getCameraSnapshotUrl(device),
    webUIUrl: getCameraWebUIUrl(device),
    ipAddress,
    port,
  };
}
