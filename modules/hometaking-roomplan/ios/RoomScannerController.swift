import UIKit
import RoomPlan
import AVFoundation

@available(iOS 16.0, *)
final class RoomScannerController: UIViewController, RoomCaptureViewDelegate {
  private let capture = RoomCaptureView(frame: .zero)
  private var finished = false
  private var stopping = false
  private var timeout: Timer?
  private let completion: (Result<String, Error>) -> Void
  private let done = UIButton(type: .system)
  init(completion: @escaping (Result<String, Error>) -> Void) {
    self.completion = completion
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .fullScreen
    isModalInPresentation = true
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 0.96, green: 0.95, blue: 0.92, alpha: 1)
    capture.delegate = self
    capture.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(capture)
    let cancel = UIButton(type: .system)
    cancel.setTitle("Cancel scan", for: .normal)
    cancel.addTarget(self, action: #selector(cancelScan), for: .touchUpInside)
    done.setTitle("Finish scan", for: .normal)
    done.addTarget(self, action: #selector(finishScan), for: .touchUpInside)
    let controls = UIStackView(arrangedSubviews: [cancel, done])
    controls.distribution = .fillEqually
    controls.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(controls)
    NSLayoutConstraint.activate([
      controls.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      controls.leadingAnchor.constraint(equalTo: view.leadingAnchor), controls.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      controls.heightAnchor.constraint(equalToConstant: 56),
      capture.topAnchor.constraint(equalTo: controls.bottomAnchor), capture.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      capture.leadingAnchor.constraint(equalTo: view.leadingAnchor), capture.trailingAnchor.constraint(equalTo: view.trailingAnchor)
    ])
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: UIApplication.didEnterBackgroundNotification, object: nil)
  }
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    if !finished && !stopping {
      var configuration = RoomCaptureSession.Configuration()
      configuration.isCoachingEnabled = true
      capture.captureSession.run(configuration: configuration)
    }
  }
  @objc private func cancelScan() { end(.failure(scanError("Scan cancelled. Your saved room is unchanged."))) }
  @objc private func interrupted() { end(.failure(scanError("Scanning was interrupted. Please try again."))) }
  @objc private func finishScan() {
    guard !stopping && !finished else { return }
    stopping = true
    done.isEnabled = false
    done.setTitle("Processing…", for: .normal)
    timeout = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
      self?.end(.failure(scanError("Room processing timed out. Please scan again.")))
    }
    capture.captureSession.stop()
  }
  func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
    if let error { DispatchQueue.main.async { self.end(.failure(error)) }; return false }
    return !finished
  }
  func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
    DispatchQueue.main.async {
      if let error { self.end(.failure(error)); return }
      guard !self.finished else { return }
      do {
        let raw = String(decoding: try JSONEncoder().encode(processedResult), as: UTF8.self)
        func matrix(_ m: simd_float4x4) -> [Float] {
          [m.columns.0, m.columns.1, m.columns.2, m.columns.3].flatMap { [$0.x, $0.y, $0.z, $0.w] }
        }
        func surface(_ s: CapturedRoom.Surface) -> [String: Any] {
          ["id":s.identifier.uuidString,"category":String(describing:s.category),"dimensions":[s.dimensions.x,s.dimensions.y,s.dimensions.z],"transform":matrix(s.transform),"confidence":String(describing:s.confidence),"curved":s.curve != nil]
        }
        let record: [String: Any] = [
          "id":UUID().uuidString,"capturedAt":ISO8601DateFormatter().string(from:Date()),"provider":"apple-roomplan","raw":raw,
          "walls":processedResult.walls.map(surface),"doors":processedResult.doors.map(surface),
          "windows":processedResult.windows.map(surface),"openings":processedResult.openings.map(surface),
          "objects":processedResult.objects.map { o in
            ["id":o.identifier.uuidString,"category":String(describing:o.category),"dimensions":[o.dimensions.x,o.dimensions.y,o.dimensions.z],"transform":matrix(o.transform),"confidence":String(describing:o.confidence)] as [String: Any]
          }
        ]
        let data = try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
        // Keep the original even if JS conversion fails, the app closes, or the project is full.
        let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("RoomPlanScans", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: directory.appendingPathComponent("\(record["id"]!).json"), options: [.atomic, .completeFileProtection])
        self.end(.success(String(decoding:data,as:UTF8.self)))
      } catch { self.end(.failure(error)) }
    }
  }
  private func end(_ result: Result<String, Error>) {
    guard !finished else { return }
    finished = true
    timeout?.invalidate()
    NotificationCenter.default.removeObserver(self)
    capture.captureSession.stop()
    dismiss(animated:true) { self.completion(result) }
  }
}
func scanError(_ message: String) -> NSError { NSError(domain:"HometakingRoomPlan",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
