package sh.notifiable.reactnative

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.net.Inet4Address
import java.net.NetworkInterface

class NotifiableDeviceModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getInfo(promise: Promise) {
        val info = Arguments.createMap()
        put(info, "model", text(Build.MODEL))
        put(info, "manufacturer", text(Build.MANUFACTURER))
        put(info, "appVersion", appVersion())
        put(info, "applicationId", text(reactApplicationContext.packageName))
        put(info, "ip", deviceAddress())
        promise.resolve(info)
    }

    @ReactMethod
    fun copy(text: String) {
        if (text.isEmpty()) {
            return
        }

        val clipboard = reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("notifiable", text))
    }

    private fun appVersion(): String? {
        return try {
            val manager = reactApplicationContext.packageManager
            val packageName = reactApplicationContext.packageName
            val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                manager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                manager.getPackageInfo(packageName, 0)
            }
            text(info.versionName)
        } catch (_: Exception) {
            null
        }
    }

    private fun deviceAddress(): String? {
        return try {
            val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
            while (interfaces.hasMoreElements()) {
                val network = interfaces.nextElement()
                if (!network.isUp || network.isLoopback) {
                    continue
                }
                val addresses = network.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (address !is Inet4Address || address.isLoopbackAddress || address.isLinkLocalAddress) {
                        continue
                    }
                    val host = address.hostAddress
                    if (host != null && host != "0.0.0.0" && !host.startsWith("127.")) {
                        return host
                    }
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun text(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        return trimmed.ifEmpty { null }
    }

    private fun put(info: WritableMap, key: String, value: String?) {
        if (value == null) {
            info.putNull(key)
        } else {
            info.putString(key, value)
        }
    }

    companion object {
        const val NAME = "NotifiableDevice"
    }
}
