interface AudioContext {
  setSinkId(sinkId: string): Promise<void>;
  readonly sinkId: string;
}

export type AudioOutputDevice = {
  deviceId: string;
  label: string;
  isDefault: boolean;
};
