import UIKit
import SceneKit
import RoomPlan

final class RoomModelViewer: UIViewController {
  private let sceneView = SCNView()
  private let scene = SCNScene()
  private let camera = SCNNode()
  private var originalMaterials: [(SCNGeometry, [SCNMaterial])] = []
  private var photoMode = true
  private var outside = false
  private var record: VisualRoomRecord?
  private var firstCamera: simd_float4x4?
  private let caption = UILabel()
  private let photoView = UIImageView()
  private var photoIndex = 0
  private var contentBounds = (min: SCNVector3Zero, max: SCNVector3Zero)
  private let completion: () -> Void
  init(raw: String, visual: Bool, completion: @escaping () -> Void) throws {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .fullScreen
    guard raw.utf8.count <= 60_000_000, let data = raw.data(using: .utf8) else { throw scanError("The saved 3D model is too large or unreadable.") }
    if visual {
      let r = try JSONDecoder().decode(VisualRoomRecord.self, from: data)
      guard r.version == 1, r.units == "metres", r.photos.count > 0, r.photos.count <= 80, r.triangleCount > 0, r.triangleCount <= 500000, r.surfaces.count <= 81 else { throw scanError("Unsupported visual model.") }
      for p in r.photos {
        guard p.camera.count == 16, p.camera.allSatisfy({ $0.isFinite }), p.jpeg.count < 4_000_000 else { throw scanError("Invalid saved camera.") }
      }
      var actualFaces = 0
      for s in r.surfaces {
        guard s.vertices.count % 9 == 0, s.uv.count == s.vertices.count / 3 * 2, s.photo >= -1, s.photo < r.photos.count, s.vertices.allSatisfy({ $0.isFinite && abs($0) < 100 }), s.uv.allSatisfy({ $0.isFinite && $0 >= 0 && $0 <= 1 }) else { throw scanError("Invalid saved surface geometry.") }
        actualFaces += s.vertices.count / 9
      }
      guard actualFaces == r.triangleCount else { throw scanError("The saved model is incomplete.") }
      record = r; firstCamera = visualMatrix(r.photos[0].camera)
      let materials = try r.photos.map { p -> SCNMaterial in
        guard let bytes = Data(base64Encoded: p.jpeg), let image = UIImage(data: bytes) else { throw scanError("A saved camera image could not be opened.") }
        let m = SCNMaterial(); m.diffuse.contents = image; m.lightingModel = .constant; m.isDoubleSided = true
        return m
      }
      for surface in r.surfaces {
        var v = [SCNVector3](); var uv = [CGPoint]()
        for i in stride(from: 0, to: surface.vertices.count, by: 3) { v.append(SCNVector3(surface.vertices[i],surface.vertices[i+1],surface.vertices[i+2])) }
        for i in stride(from: 0, to: surface.uv.count, by: 2) { uv.append(CGPoint(x: CGFloat(surface.uv[i]), y: CGFloat(surface.uv[i+1]))) }
        var normals = [SCNVector3]()
        for i in stride(from: 0, to: v.count, by: 3) {
          let a = SIMD3<Float>(v[i].x,v[i].y,v[i].z), b = SIMD3<Float>(v[i+1].x,v[i+1].y,v[i+1].z), c = SIMD3<Float>(v[i+2].x,v[i+2].y,v[i+2].z)
          let cross = simd_cross(b-a,c-a)
          let n = simd_length(cross) > 0.000001 ? simd_normalize(cross) : SIMD3<Float>(0,1,0)
          normals.append(contentsOf: Array(repeating: SCNVector3(n.x,n.y,n.z), count: 3))
        }
        let indices = (0..<v.count).map { UInt32($0) }
        let element = SCNGeometryElement(indices: indices, primitiveType: .triangles)
        let g = SCNGeometry(sources: [SCNGeometrySource(vertices: v),SCNGeometrySource(normals: normals),SCNGeometrySource(textureCoordinates: uv)], elements: [element])
        g.materials = surface.photo >= 0 ? [materials[surface.photo]] : [Self.plain(.systemGray)]
        originalMaterials.append((g,g.materials)); scene.rootNode.addChildNode(SCNNode(geometry: g))
      }
      caption.text = "Camera-textured capture · appearance unverified\nGrey = no matched photo. Holes = missing surfaces."
    } else {
      let r = try JSONDecoder().decode(CapturedRoom.self, from: data)
      func surface(_ s: CapturedRoom.Surface, colour: UIColor) {
        let box = SCNBox(width: CGFloat(max(s.dimensions.x,0.015)), height: CGFloat(max(s.dimensions.y,0.015)), length: CGFloat(max(s.dimensions.z,0.015)), chamferRadius: 0)
        box.materials = [Self.plain(colour)]; let node = SCNNode(geometry: box); node.simdTransform = s.transform; scene.rootNode.addChildNode(node)
      }
      r.walls.forEach { surface($0, colour: UIColor(white:0.78,alpha:0.55)) }
      r.windows.forEach { surface($0, colour: UIColor.systemTeal.withAlphaComponent(0.75)) }
      r.doors.forEach { surface($0, colour: .systemBrown) }
      r.openings.forEach { surface($0, colour: UIColor.systemOrange.withAlphaComponent(0.5)) }
      for o in r.objects {
        let box = SCNBox(width: CGFloat(o.dimensions.x),height: CGFloat(o.dimensions.y),length: CGFloat(o.dimensions.z),chamferRadius: 0.01)
        box.materials = [Self.plain(.systemGray)]; let n = SCNNode(geometry: box); n.simdTransform = o.transform; scene.rootNode.addChildNode(n)
      }
      caption.text = "Original RoomPlan geometry · not photographs\nRecognition can omit slopes and window details."
    }
    contentBounds = scene.rootNode.boundingBox
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  private static func plain(_ colour: UIColor) -> SCNMaterial {
    let m = SCNMaterial(); m.diffuse.contents = colour; m.lightingModel = .lambert; m.isDoubleSided = true; return m
  }
  override func viewDidLoad() {
    super.viewDidLoad(); view.backgroundColor = .systemBackground
    let close = button("Close", #selector(closeViewer))
    let buttons: [UIView] = record == nil ? [close] : [close,button("Colour / shape", #selector(toggleColour)),button("Inside / orbit", #selector(toggleCamera)),button("Photos", #selector(showPhoto))]
    let controls = UIStackView(arrangedSubviews: buttons); controls.distribution = .fillEqually
    caption.numberOfLines = 0; caption.textAlignment = .center; caption.font = .systemFont(ofSize: 13)
    let header = UIStackView(arrangedSubviews: [controls,caption]); header.axis = .vertical; header.translatesAutoresizingMaskIntoConstraints = false
    sceneView.translatesAutoresizingMaskIntoConstraints = false; sceneView.scene = scene; sceneView.allowsCameraControl = true
    sceneView.autoenablesDefaultLighting = true; sceneView.backgroundColor = UIColor(white: 0.13, alpha: 1)
    camera.camera = SCNCamera(); camera.camera?.zNear = 0.02; camera.camera?.zFar = 100; camera.camera?.fieldOfView = 65
    scene.rootNode.addChildNode(camera); sceneView.pointOfView = camera
    view.addSubview(header); view.addSubview(sceneView)
    photoView.contentMode = .scaleAspectFit; photoView.backgroundColor = .black; photoView.isHidden = true; photoView.translatesAutoresizingMaskIntoConstraints = false
    photoView.isUserInteractionEnabled = true; photoView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(nextPhoto)))
    view.addSubview(photoView)
    NSLayoutConstraint.activate([
      header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), header.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8), header.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8), controls.heightAnchor.constraint(equalToConstant: 52), caption.heightAnchor.constraint(equalToConstant: 60),
      sceneView.topAnchor.constraint(equalTo: header.bottomAnchor),sceneView.leadingAnchor.constraint(equalTo: view.leadingAnchor),sceneView.trailingAnchor.constraint(equalTo: view.trailingAnchor),sceneView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      photoView.topAnchor.constraint(equalTo: sceneView.topAnchor),photoView.bottomAnchor.constraint(equalTo: sceneView.bottomAnchor),photoView.leadingAnchor.constraint(equalTo: sceneView.leadingAnchor),photoView.trailingAnchor.constraint(equalTo: sceneView.trailingAnchor)
    ])
    placeCamera()
  }
  private func button(_ title: String, _ action: Selector) -> UIButton {
    let b = UIButton(type: .system); b.setTitle(title, for: .normal); b.titleLabel?.font = .systemFont(ofSize: 13); b.addTarget(self, action: action, for: .touchUpInside); return b
  }
  private func placeCamera() {
    if let pose = firstCamera, !outside {
      camera.simdTransform = pose
      let target = pose * SIMD4<Float>(0,0,-2,1)
      sceneView.defaultCameraController.target = SCNVector3(target.x,target.y,target.z)
    } else {
      let b = contentBounds
      let centre = SCNVector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2)
      let span = max(2,max(b.max.x-b.min.x,max(b.max.y-b.min.y,b.max.z-b.min.z)))
      camera.position = SCNVector3(centre.x+span,centre.y+span*0.8,centre.z+span)
      camera.look(at: centre); sceneView.defaultCameraController.target = centre
    }
    sceneView.pointOfView = camera
  }
  @objc private func closeViewer() { dismiss(animated: true, completion: completion) }
  @objc private func toggleColour() {
    photoView.isHidden = true; photoMode.toggle()
    for (g,m) in originalMaterials { g.materials = photoMode ? m : [Self.plain(.lightGray)] }
    caption.text = photoMode ? "Camera colour. Grey areas have no matched photographs." : "Observed surface shape. Check both slopes and the window junction."
  }
  @objc private func toggleCamera() { photoView.isHidden = true; outside.toggle(); placeCamera() }
  @objc private func showPhoto() { photoView.isHidden.toggle(); if !photoView.isHidden { displayPhoto() } }
  @objc private func nextPhoto() { guard let r = record else { return }; photoIndex = (photoIndex+1) % r.photos.count; displayPhoto() }
  private func displayPhoto() {
    guard let r = record, let data = Data(base64Encoded: r.photos[photoIndex].jpeg) else { return }
    photoView.image = UIImage(data: data)
    caption.text = "Source photo \(photoIndex+1) of \(r.photos.count). Tap photo for next.\nUse these to check missing or distorted surfaces."
  }
}
