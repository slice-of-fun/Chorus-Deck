use biquad::{Biquad, DirectForm2Transposed, ToHertz, Type, Coefficients, Q_BUTTERWORTH_F32};

pub fn test_biquad() {
    let fs = 44.1.kHz();
    let f0 = 1000.0.hz();
    let q = Q_BUTTERWORTH_F32;
    let gain = 2.0;

    let coeffs = Coefficients::<f32>::from_params(Type::PeakingEQ(q, gain), fs, f0).unwrap();
    let mut biquad = DirectForm2Transposed::<f32>::new(coeffs);
    let sample = 0.5;
    let _out = biquad.run(sample);
}
