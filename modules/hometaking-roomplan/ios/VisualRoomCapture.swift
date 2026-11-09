import UIKit
import ARKit
import SceneKit
import CoreImage

struct VisualPhoto: Codable {
  let jpeg: String
  let camera: [Float]
  let intrinsics: [Float]
  let width: Int
  let height: Int
  let depthWidth: Int
  let depthHeight: Int
  let depth: [Float]
  let confidence: [UInt8]
}
struct VisualSurface: Codable {
  let vertices: [Float]
  let uv: [Float]
  let photo: Int // -1 means no trustworthy camera coverage.
}
struct VisualRoomRecord: Codable {
  let version: Int
  let id: String
  let capturedAt: String
  let units: String
  let photos: [VisualPhoto]
  let surfaces: [VisualSurface]
  let triangleCount: Int
  let texturedTriangleCount: Int
}

final class VisualRoomCapture: UIViewController, ARSCNViewDelegate {
  private let cameraView = ARSCNView(frame: .zero)
  private let status = UILabel()
  private let finish = UIButton(type: .system)
  private var timer: Timer?
  private var photos: [VisualPhoto] = []
  private var anchors: [UUID: ARMeshAnchor] = [:]
  private var lastPose: simd_float4x4?
  private var done = false
  private var processing = false
  private let context = CIContext(options: [.cacheIntermediates: false])
  private let completion: (Result<String, Error>) -> Void
  init(completion: @escaping (Result<String, Error>) -> Void) {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .fullScreen
    isModalInPresentation = true
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    cameraView.delegate = self
    cameraView.translatesAutoresizingMaskIntoConstraints = false
    let cancel = UIButton(type: .system)
    cancel.setTitle("Cancel", for: .normal)
    cancel.addTarget(self, action: #selector(cancelCapture), for: .touchUpInside)
    finish.setTitle("Build 3D view", for: .normal)
    finish.addTarget(self, action: #selector(finishCapture), for: .touchUpInside)
    let buttons = UIStackView(arrangedSubviews: [cancel, finish]); buttons.distribution = .fillEqually
    status.numberOfLines = 0; status.font = .systemFont(ofSize: 15); status.textAlignment = .center
    status.text = "Move slowly. Look up at both ceiling slopes, then along the window junction from both sides."
    let header = UIStackView(arrangedSubviews: [buttons, status]); header.axis = .vertical; header.spacing = 8
    header.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(header); view.addSubview(cameraView)
    NSLayoutConstraint.activate([
      header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), header.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16), header.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      buttons.heightAnchor.constraint(equalToConstant: 48), status.heightAnchor.constraint(equalToConstant: 76),
      cameraView.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 8), cameraView.leadingAnchor.constraint(equalTo: view.leadingAnchor), cameraView.trailingAnchor.constraint(equalTo: view.trailingAnchor), cameraView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
    ])
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: UIApplication.didEnterBackgroundNotification, object: nil)
  }
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !done && !processing else { return }
    let c = ARWorldTrackingConfiguration()
    c.sceneReconstruction = .mesh
    // Avoid plane flattening: preserve the observed shape of ceiling junctions.
    c.planeDetection = []
    if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) { c.frameSemantics.insert(.sceneDepth) }
    cameraView.session.run(c)
    timer = Timer.scheduledTimer(withTimeInterval: 0.9, repeats: true) { [weak self] _ in self?.sample() }
  }
  private func sample() {
    guard !done && !processing, let frame = cameraView.session.currentFrame else { return }
    anchors = Dictionary(uniqueKeysWithValues: frame.anchors.compactMap { $0 as? ARMeshAnchor }.map { ($0.identifier, $0) })
    guard case .normal = frame.camera.trackingState else { status.text = "Tracking needs more detail. Move slowly towards a well-lit surface."; return }
    guard photos.count < 64 else { status.text = "64 views captured. Finish to inspect coverage and save. Grey areas will show missing detail."; return }
    let pose = frame.camera.transform
    if let last = lastPose {
      let distance = simd_distance(SIMD3(pose.columns.3.x,pose.columns.3.y,pose.columns.3.z), SIMD3(last.columns.3.x,last.columns.3.y,last.columns.3.z))
      let angle = simd_dot(SIMD3(pose.columns.2.x,pose.columns.2.y,pose.columns.2.z), SIMD3(last.columns.2.x,last.columns.2.y,last.columns.2.z))
      if distance < 0.12 && angle > 0.975 { return }
    }
    guard let depth = frame.sceneDepth else { status.text = "Waiting for depth. Keep the camera steady."; return }
    let image = CIImage(cvPixelBuffer: frame.capturedImage)
    let scale = min(1, 1440 / image.extent.width)
    let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    guard let cg = context.createCGImage(scaled, from: scaled.extent), let jpeg = UIImage(cgImage: cg).jpegData(compressionQuality: 0.8) else { return }
    let buffer = depth.depthMap
    guard let confidenceMap = depth.confidenceMap else { return }
    CVPixelBufferLockBaseAddress(buffer, .readOnly); CVPixelBufferLockBaseAddress(confidenceMap, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly); CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly) }
    let dw = CVPixelBufferGetWidth(buffer), dh = CVPixelBufferGetHeight(buffer)
    guard let base = CVPixelBufferGetBaseAddress(buffer), let cb = CVPixelBufferGetBaseAddress(confidenceMap) else { return }
    var depths = [Float](); var confidences = [UInt8](); depths.reserveCapacity(dw*dh); confidences.reserveCapacity(dw*dh)
    for y in 0..<dh {
      let row = base.advanced(by: y * CVPixelBufferGetBytesPerRow(buffer)).assumingMemoryBound(to: Float.self)
      let cr = cb.advanced(by: y * CVPixelBufferGetBytesPerRow(confidenceMap)).assumingMemoryBound(to: UInt8.self)
      for x in 0..<dw { depths.append(row[x].isFinite ? row[x] : 0); confidences.append(cr[x]) }
    }
    let k = frame.camera.intrinsics
    photos.append(VisualPhoto(jpeg: jpeg.base64EncodedString(), camera: visualMatrix(pose), intrinsics: [k.columns.0.x,k.columns.1.y,k.columns.2.x,k.columns.2.y], width: CVPixelBufferGetWidth(frame.capturedImage), height: CVPixelBufferGetHeight(frame.capturedImage), depthWidth: dw, depthHeight: dh, depth: depths, confidence: confidences))
    lastPose = pose
    status.text = "\(photos.count) camera views · \(anchors.count) surface patches\nInclude the ceiling, floor and window edges from several angles."
  }
  // Mesh overlay shows where depth has been observed; it is not a completeness score.
  func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) { overlay(node, anchor) }
  func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) { overlay(node, anchor) }
  private func overlay(_ node: SCNNode, _ anchor: ARAnchor) {
    guard let a = anchor as? ARMeshAnchor else { return }
    let g = a.geometry
    let source = SCNGeometrySource(buffer: g.vertices.buffer, vertexFormat: g.vertices.format, semantic: .vertex, vertexCount: g.vertices.count, dataOffset: g.vertices.offset, dataStride: g.vertices.stride)
    let data = Data(bytes: g.faces.buffer.contents(), count: g.faces.count * g.faces.indexCountPerPrimitive * g.faces.bytesPerIndex)
    let element = SCNGeometryElement(data: data, primitiveType: .triangles, primitiveCount: g.faces.count, bytesPerIndex: g.faces.bytesPerIndex)
    let geometry = SCNGeometry(sources: [source], elements: [element]); let material = SCNMaterial()
    material.diffuse.contents = UIColor.orange.withAlphaComponent(0.3); material.fillMode = .lines; material.lightingModel = .constant; material.isDoubleSided = true
    geometry.materials = [material]; node.geometry = geometry
  }
  @objc private func cancelCapture() { end(.failure(scanError("Visual capture cancelled. Saved rooms are unchanged."))) }
  @objc private func interrupted() { if !processing { end(.failure(scanError("Visual capture interrupted. Saved rooms are unchanged."))) } }
  @objc private func finishCapture() {
    guard !done && !processing else { return }
    sample()
    guard photos.count >= 3, !anchors.isEmpty else { status.text = "Capture at least three different views and some visible surfaces before finishing."; return }
    processing = true; timer?.invalidate(); cameraView.session.pause(); finish.isEnabled = false
    status.text = "Building the camera-textured room. Keep Hometaking open."
    let snapshots = Array(anchors.values), frames = photos
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let record = try Self.reconstruct(snapshots, frames)
        let data = try JSONEncoder().encode(record)
        let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("VisualRoomScans", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: directory.appendingPathComponent(record.id + ".json"), options: [.atomic, .completeFileProtection])
        guard data.count <= 60_000_000 else { throw scanError("This capture is too large for the current room backup. Its original is retained on this device. Try a shorter capture.") }
        DispatchQueue.main.async { self.end(.success(String(decoding: data, as: UTF8.self))) }
      } catch { DispatchQueue.main.async { self.end(.failure(error)) } }
    }
  }
  static func reconstruct(_ anchors: [ARMeshAnchor], _ photos: [VisualPhoto]) throws -> VisualRoomRecord {
    let faceCount = anchors.reduce(0) { $0 + $1.geometry.faces.count }
    guard faceCount > 0 && faceCount <= 500000 else { throw scanError("Too much geometry for this capture. Finish a smaller room scan.") }
    let inverses = photos.map { simd_inverse(visualMatrix($0.camera)) }
    var vertices = Array(repeating: [Float](), count: photos.count + 1)
    var coords = Array(repeating: [Float](), count: photos.count + 1)
    var textured = 0
    for anchor in anchors {
      let g = anchor.geometry
      func vertex(_ index: Int) -> SIMD3<Float> {
        let p = g.vertices.buffer.contents().advanced(by: g.vertices.offset + index * g.vertices.stride).assumingMemoryBound(to: Float.self)
        let w = anchor.transform * SIMD4(p[0],p[1],p[2],1)
        return SIMD3(w.x,w.y,w.z)
      }
      for face in 0..<g.faces.count {
        var triangle = [SIMD3<Float>]()
        for j in 0..<3 {
          let pointer = g.faces.buffer.contents().advanced(by: (face*3+j)*g.faces.bytesPerIndex)
          let index = g.faces.bytesPerIndex == 2 ? Int(pointer.load(as: UInt16.self)) : Int(pointer.load(as: UInt32.self))
          triangle.append(vertex(index))
        }
        let centre = (triangle[0]+triangle[1]+triangle[2])/3
        var best = -1; var score: Float = 0; var uv = [SIMD3<Float>]()
        for (i, photo) in photos.enumerated() {
          guard let p = VisualProjection.project(centre, inverseCamera: inverses[i], intrinsics: photo.intrinsics, width: photo.width, height: photo.height), VisualProjection.visible(p, depth: photo.depth, confidence: photo.confidence, width: photo.depthWidth, height: photo.depthHeight) else { continue }
          let projected = triangle.compactMap { VisualProjection.project($0, inverseCamera: inverses[i], intrinsics: photo.intrinsics, width: photo.width, height: photo.height) }
          guard projected.count == 3, projected.allSatisfy({ VisualProjection.visible($0, depth: photo.depth, confidence: photo.confidence, width: photo.depthWidth, height: photo.depthHeight) }) else { continue }
          let a = projected[1]-projected[0], b = projected[2]-projected[0]
          let area = abs(a.x*b.y-a.y*b.x)
          if area > score { best = i; score = area; uv = projected }
        }
        let bucket = best+1
        for j in 0..<3 {
          vertices[bucket].append(contentsOf: [triangle[j].x,triangle[j].y,triangle[j].z])
          coords[bucket].append(contentsOf: best >= 0 ? [uv[j].x,1-uv[j].y] : [0,0])
        }
        if best >= 0 { textured += 1 }
      }
    }
    let surfaces = vertices.indices.filter { !vertices[$0].isEmpty }.map { VisualSurface(vertices: vertices[$0], uv: coords[$0], photo: $0-1) }
    return VisualRoomRecord(version: 1, id: UUID().uuidString, capturedAt: ISO8601DateFormatter().string(from: Date()), units: "metres", photos: photos, surfaces: surfaces, triangleCount: faceCount, texturedTriangleCount: textured)
  }
  private func end(_ result: Result<String, Error>) {
    guard !done else { return }; done = true; timer?.invalidate(); cameraView.session.pause()
    NotificationCenter.default.removeObserver(self)
    dismiss(animated: true) { self.completion(result) }
  }
}
