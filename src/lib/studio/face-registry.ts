export interface FaceEntry {
  name: string;
  type: 'lora' | 'pulid';
  loraModel?: string;
  triggerWord?: string;
}

export const FACE_REGISTRY: Record<string, FaceEntry> = {
  ANNA: {
    name: 'ANNA',
    type: 'lora',
    loraModel: 'vadymmak/anna-face-lora:4198443f5a945bd22a2dfdfdb4ec2ec47a5107b9c1c7e163c1d81c78489e72c6',
    triggerWord: 'ANNA',
  },
};
// To add a new face: one line here. Zero changes elsewhere.
