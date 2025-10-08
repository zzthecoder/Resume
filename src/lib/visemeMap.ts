export const VISEME_MAP: Record<string, string> = {
  AA: 'viseme_aa',
  IY: 'viseme_iy',
  UW: 'viseme_uw',
  OH: 'viseme_oh',
  FV: 'viseme_fv',
  TH: 'viseme_th',
  PP: 'viseme_pp',
  SS: 'viseme_ss',
  CH: 'viseme_ch',
  RR: 'viseme_rr',
  KK: 'viseme_kk',
  NN: 'viseme_nn',
  DD: 'viseme_dd',
  // Fallback
  mouthOpen: 'mouthOpen',
};

export interface VisemeFrame {
  name: string;
  t: number;
  duration: number;
}
