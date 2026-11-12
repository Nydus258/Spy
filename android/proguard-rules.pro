# WebView arayüzü: @JavascriptInterface yöntemleri adlarıyla korunmalı.
-keepclassmembers class com.spyapp.mobile.Bridge { @android.webkit.JavascriptInterface <methods>; }
-keepattributes JavascriptInterface
