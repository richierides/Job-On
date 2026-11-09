import Foundation
import simd
@main struct ProjectionChecks {
  static func main() {
    let k: [Float] = [500,500,500,400]
    let centre = VisualProjection.project(SIMD3(0,0,-2), inverseCamera: matrix_identity_float4x4, intrinsics: k, width: 1000, height: 800)!
    precondition(abs(centre.x-0.5)<0.0001 && abs(centre.y-0.5)<0.0001 && centre.z == 2)
    let above = VisualProjection.project(SIMD3(0,1,-2), inverseCamera: matrix_identity_float4x4, intrinsics: k, width: 1000, height: 800)!
    precondition(above.y < 0.5, "Camera up must map towards the top of the image")
    precondition(VisualProjection.project(SIMD3(0,0,2), inverseCamera: matrix_identity_float4x4, intrinsics:k,width:1000,height:800) == nil)
    precondition(VisualProjection.project(SIMD3(10,0,-2), inverseCamera: matrix_identity_float4x4, intrinsics:k,width:1000,height:800) == nil)
    var pose = simd_float4x4(simd_quatf(angle: .pi/2, axis: SIMD3(0,1,0)))
    pose.columns.3 = SIMD4(3,1,4,1)
    let world = pose * SIMD4<Float>(0,0,-2,1)
    let rotated = VisualProjection.project(SIMD3(world.x,world.y,world.z), inverseCamera: simd_inverse(pose), intrinsics:k,width:1000,height:800)!
    precondition(simd_distance(rotated,centre)<0.0001, "Camera transforms must preserve image projection")
    precondition(VisualProjection.visible(centre, depth:[2,2,2,2],confidence:[2,2,2,2],width:2,height:2))
    precondition(!VisualProjection.visible(centre, depth:[1,1,1,1],confidence:[2,2,2,2],width:2,height:2), "Foreground occlusion must reject photo mapping")
    precondition(!VisualProjection.visible(centre, depth:[3,3,3,3],confidence:[2,2,2,2],width:2,height:2), "Depth inconsistency must remain untextured")
    precondition(!VisualProjection.visible(centre, depth:[2,2,2,2],confidence:[0,0,0,0],width:2,height:2))
    print("9 camera projection / depth checks passed. No physical scan quality claim.")
  }
}
