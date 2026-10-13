require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "notifiable-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://notifiable.sh"
  s.license      = package["license"]
  s.authors      = "Notifiable"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/itsnotifiable/react-native.git", :tag => "v#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm}"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
