import Foundation
import simd

// ARKit camera looks down -Z; capturedImage pixels have their origin at top left.
// Keep image coordinates independent of the phone's interface orientation.
struct VisualProjection {
  static func project(_ world: SIMD3<Float>, inverseCamera: simd_float4x4,
                      intrinsics: [Float], width: Int, height: Int) -> SIMD3<Float>? {
    let c = inverseCamera * SIMD4<Float>(world, 1)
    let depth = -c.z
    guard depth > 0.1, intrinsics.count == 4, width > 0, height > 0 else { return nil }
    let u = (intrinsics[0] * c.x / depth + intrinsics[2]) / Float(width)
    let v = (intrinsics[3] - intrinsics[1] * c.y / depth) / Float(height)
    guard u.isFinite, v.isFinite, u > 0.01, u < 0.99, v > 0.01, v < 0.99 else { return nil }
    return SIMD3(u, v, depth)
  }
  static func visible(_ p: SIMD3<Float>, depth: [Float], confidence: [UInt8], width: Int, height: Int) -> Bool {
    guard width > 0, height > 0, depth.count == width * height, confidence.count == depth.count else { return false }
    let x = min(width - 1, max(0, Int(p.x * Float(width))))
    let y = min(height - 1, max(0, Int(p.y * Float(height))))
    let i = y * width + x, measured = depth[i]
    // Do not paint foreground photographs onto a surface behind them.
    return confidence[i] >= 1 && measured.isFinite && measured > 0 && abs(measured - p.z) < max(0.12, p.z * 0.025)
  }
}
func visualMatrix(_ m: simd_float4x4) -> [Float] {
  [m.columns.0,m.columns.1,m.columns.2,m.columns.3].flatMap { [$0.x,$0.y,$0.z,$0.w] }
}
func visualMatrix(_ a: [Float]) -> simd_float4x4 {
  simd_float4x4(columns: (SIMD4(a[0],a[1],a[2],a[3]), SIMD4(a[4],a[5],a[6],a[7]), SIMD4(a[8],a[9],a[10],a[11]), SIMD4(a[12],a[13],a[14],a[15])))
}
