package sh.notifiable.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NotifiableDevicePackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        if (name == NotifiableDeviceModule.NAME) {
            return NotifiableDeviceModule(reactContext)
        }
        return null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                NotifiableDeviceModule.NAME to ReactModuleInfo(
                    NotifiableDeviceModule.NAME,
                    NotifiableDeviceModule::class.java.name,
                    false,
                    false,
                    false,
                    false,
                ),
            )
        }
    }
}
