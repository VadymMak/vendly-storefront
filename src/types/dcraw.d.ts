declare module 'dcraw' {
  interface DcrawOptions {
    verbose?: boolean;
    identify?: boolean;
    extractThumbnail?: boolean;
    useCameraWhiteBalance?: boolean;
    useAverageWhiteBalance?: boolean;
    useEmbeddedColorMatrix?: boolean;
    useDocumentMode?: boolean;
    useRawMode?: boolean;
    useExportMode?: boolean;
    setNoStretchMode?: boolean;
    setNoAutoBrightnessMode?: boolean;
    setHalfSizeMode?: boolean;
    setFourColorMode?: boolean;
    use16BitMode?: boolean;
    use16BitLinearMode?: boolean;
    exportAsTiff?: boolean;
    toStandardOutput?: boolean;
    setHighlightMode?: number;
    setInterpolationQuality?: number;
    setColorSpace?: number;
    setBrightnessLevel?: number;
    setMedianFilter?: number;
    [key: string]: unknown;
  }

  function dcraw(buffer: Buffer | Uint8Array, options?: DcrawOptions): Buffer;
  export = dcraw;
}
