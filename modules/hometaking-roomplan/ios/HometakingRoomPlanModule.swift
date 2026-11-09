import ExpoModulesCore
import RoomPlan
import AVFoundation
import UIKit
import ARKit

public class HometakingRoomPlanModule: Module {
  private var scanner: UIViewController?
  public func definition() -> ModuleDefinition {
    Name("HometakingRoomPlan")
    AsyncFunction("support") { () -> [String: Any] in
      if #available(iOS 16.0, *) {
        return ["supported":RoomCaptureSession.isSupported,"permission":AVCaptureDevice.authorizationStatus(for:.video).rawValue]
      }
      return ["supported":false,"permission":0]
    }
    AsyncFunction("visualSupport") { () -> Bool in
      ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) && ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }
    AsyncFunction("captureVisual") { (promise: Promise) in
      guard ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh), ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) else {
        promise.reject("UNSUPPORTED", "Camera-textured capture requires a supported LiDAR device."); return
      }
      guard self.scanner == nil else { promise.reject("BUSY", "Another capture or viewer is open."); return }
      self.scanner = UIViewController()
      func present(_ allowed: Bool) {
        DispatchQueue.main.async {
          guard allowed else { self.scanner = nil; promise.reject("CAMERA_DENIED", "Enable camera access in Settings."); return }
          guard var host = self.appContext?.utilities?.currentViewController() else { self.scanner = nil; promise.reject("NO_VIEW", "Cannot open camera."); return }
          while let p = host.presentedViewController { host = p }
          let controller = VisualRoomCapture { result in
            self.scanner = nil
            switch result {
            case .success(let raw): promise.resolve(raw)
            case .failure(let error): promise.reject("VISUAL_CAPTURE", error.localizedDescription)
            }
          }
          self.scanner = controller; host.present(controller, animated: true)
        }
      }
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized: present(true)
      case .notDetermined: AVCaptureDevice.requestAccess(for: .video, completionHandler: present)
      default: present(false)
      }
    }.runOnQueue(.main)
    AsyncFunction("viewModel") { (raw: String, visual: Bool, promise: Promise) in
      guard self.scanner == nil else { promise.reject("BUSY", "Another capture or viewer is open."); return }
      guard var host = self.appContext?.utilities?.currentViewController() else { promise.reject("NO_VIEW", "Cannot open the model."); return }
      while let p = host.presentedViewController { host = p }
      do {
        let viewer = try RoomModelViewer(raw: raw, visual: visual) { self.scanner = nil; promise.resolve(true) }
        self.scanner = viewer; host.present(viewer, animated: true)
      } catch { promise.reject("MODEL", error.localizedDescription) }
    }.runOnQueue(.main)
    AsyncFunction("capture") { (promise: Promise) in
      guard #available(iOS 16.0, *), RoomCaptureSession.isSupported else {
        promise.reject("UNSUPPORTED", "Room scanning requires a supported LiDAR iPhone or iPad running iOS 16 or later."); return
      }
      guard self.scanner == nil else { promise.reject("BUSY", "A scan is already open."); return }
      // Reserve before requesting permission to avoid duplicate camera presentations.
      self.scanner = UIViewController()
      func present(_ granted: Bool) {
        DispatchQueue.main.async {
          guard granted else { self.scanner=nil; promise.reject("CAMERA_DENIED", "Camera access is off. Enable it in Settings or use photos and measurements."); return }
          guard var host = self.appContext?.utilities?.currentViewController() else {
            self.scanner=nil; promise.reject("NO_VIEW", "Cannot open the camera right now."); return
          }
          while let presented = host.presentedViewController { host = presented }
          let controller = RoomScannerController { result in
            self.scanner = nil
            switch result {
            case .success(let value): promise.resolve(value)
            case .failure(let error): promise.reject("SCAN_FAILED", error.localizedDescription)
            }
          }
          self.scanner = controller
          host.present(controller, animated:true)
        }
      }
      switch AVCaptureDevice.authorizationStatus(for:.video) {
      case .authorized: present(true)
      case .notDetermined: AVCaptureDevice.requestAccess(for:.video, completionHandler:present)
      default: present(false)
      }
    }.runOnQueue(.main)
  }
}
