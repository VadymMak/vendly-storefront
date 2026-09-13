export interface BeatDetectionResult {
  bpm: number;
  beats: number[];    // beat positions in seconds
  duration: number;
}

export async function detectBeats(audioFile: File | string): Promise<BeatDetectionResult> {
  const audioContext = new AudioContext();
  let audioBuffer: AudioBuffer;

  if (typeof audioFile === 'string') {
    const response = await fetch(audioFile);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } else {
    const arrayBuffer = await audioFile.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  }

  const duration = audioBuffer.duration;

  let bpm = 120;
  try {
    const { guess } = await import('web-audio-beat-detector');
    const result = await guess(audioBuffer);
    bpm = Math.round(result.bpm);
  } catch {
    console.warn('[beat-detector] BPM detection failed, defaulting to 120');
  }

  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  let t = 0;
  while (t < duration) {
    beats.push(parseFloat(t.toFixed(3)));
    t += beatInterval;
  }

  await audioContext.close();
  return { bpm, beats, duration };
}

export function getStrongBeats(beats: number[]): { strongBeats: number[]; measures: number[] } {
  return {
    strongBeats: beats.filter((_, i) => i % 2 === 0),
    measures:    beats.filter((_, i) => i % 4 === 0),
  };
}
