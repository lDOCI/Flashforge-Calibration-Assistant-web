export interface CalibrationData {
  freqBins: Float64Array
  psdSum: Float64Array
  psdX: Float64Array
  psdY: Float64Array
  psdZ: Float64Array
  dataSets: number
}

export interface CalibrationResult {
  name: string
  freq: number
  vals: Float64Array
  vibrs: number
  smoothing: number
  score: number
  maxAccel: number
}

export interface ShaperParams {
  A: number[]
  T: number[]
}

export interface InputShaperCfg {
  name: string
  initFunc: (freq: number, dampingRatio: number) => ShaperParams
  minFreq: number
}
