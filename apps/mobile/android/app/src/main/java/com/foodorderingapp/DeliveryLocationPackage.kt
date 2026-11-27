package com.foodorderingapp

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.common.LifecycleState
import com.facebook.react.uimanager.ViewManager

class DeliveryLocationPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(DeliveryLocationModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

private class DeliveryLocationModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val main = Handler(Looper.getMainLooper())
  private val locations = context.getSystemService(LocationManager::class.java)
  private var pending: Promise? = null
  private var listener: LocationListener? = null
  private val timeout = Runnable { finish("NO_FIX") }

  init { context.addLifecycleEventListener(this) }

  override fun getName() = "DeliveryLocation"

  @ReactMethod
  @SuppressLint("MissingPermission")
  fun getFix(promise: Promise) {
    main.post {
      finish("PAUSED")
      if (context.lifecycleState != LifecycleState.RESUMED) {
        promise.reject("PAUSED", "Delivery location requires a foreground activity.")
        return@post
      }
      if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        promise.reject("PERMISSION", "Precise foreground location is required.")
        return@post
      }
      if (locations?.isProviderEnabled(LocationManager.GPS_PROVIDER) != true) {
        promise.reject("GPS_OFF", "GPS is disabled or unavailable.")
        return@post
      }
      val next = object : LocationListener {
        override fun onLocationChanged(location: Location) {
          val age = SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos
          if (listener !== this || age !in 0L..15_000_000_000L || !location.hasAccuracy()
            || location.accuracy !in 0f..5000f) return
          if (context.lifecycleState == LifecycleState.RESUMED) finish(location = location)
          else finish("PAUSED")
        }

        override fun onProviderDisabled(provider: String) {
          if (listener === this) finish("GPS_OFF")
        }
      }
      pending = promise
      listener = next
      try {
        locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1_000L, 0f, next, Looper.getMainLooper())
        main.postDelayed(timeout, 12_000L)
      } catch (_: SecurityException) {
        finish("PERMISSION")
      } catch (_: IllegalArgumentException) {
        finish("GPS_OFF")
      }
    }
  }

  @ReactMethod
  fun cancel() { main.post { finish("PAUSED") } }

  private fun finish(error: String? = null, location: Location? = null) {
    main.removeCallbacks(timeout)
    val subscription = listener
    val promise = pending
    listener = null
    pending = null
    if (subscription != null) locations?.removeUpdates(subscription)
    if (location != null) {
      promise?.resolve(Arguments.createMap().apply {
        putDouble("latitude", location.latitude)
        putDouble("longitude", location.longitude)
        putDouble("accuracyMeters", location.accuracy.toDouble())
        putDouble("recordedAtMs", location.time.toDouble())
      })
    } else if (error != null) {
      promise?.reject(error, "Location request ended: $error")
    }
  }

  override fun onHostResume() = Unit
  override fun onHostPause() = cancel()
  override fun onHostDestroy() = cancel()
  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    cancel()
    super.invalidate()
  }
}
