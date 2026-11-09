Pod::Spec.new do |s|
  s.name = 'HometakingRoomPlan'
  s.version = '1.0.0'
  s.summary = 'Native RoomPlan capture for Hometaking'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Recurrent Ltd'
  s.homepage = 'https://github.com/richierides/Job-On'
  s.platforms = { :ios => '16.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'RoomPlan', 'ARKit', 'AVFoundation', 'SceneKit', 'CoreImage'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end
