package com.spyapp.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Tek ekran: arayüz uygulama içindeki assets/www klasöründen yüklenir. Uygulamanın internet izni yoktur. */
public final class MainActivity extends Activity {
    private static final String HOME = "file:///android_asset/www/index.html";
    private static final int REQ_SAVE = 41;
    private static final int REQ_PICK = 42;
    private static final int REQ_NOTIFY = 43;
    private static final int BACKGROUND = 0xFF0B0F1A;

    private WebView web;
    private String pendingContent;
    private volatile String pendingAction = "";
    private PlayBilling billing;
    private OnBackInvokedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        billing = new PlayBilling(this);
        web = new WebView(this);
        web.setBackgroundColor(0xFF1C1950);  // açılış animasyonunun zemini; sayfa yüklenince kendi zemini örter
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);  // Spy'ın kısa sesleri (cevap gecikmeli geldiği için dokunuş dışında da çalar)
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.addJavascriptInterface(new Bridge(this), "SpyNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && url.startsWith("file:///android_asset/")) return false;
                openExternal(url);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d("Spy", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        setContentView(wrapWithInsets(web));
        registerBack();
        readAction(getIntent());
        web.loadUrl(HOME);
    }

    /**
     * Android 15+ uygulamayı sistem çubuklarının arkasına çizer (kenardan kenara). WebView'u çubukların, kamera çentiğinin
     * ve klavyenin altına girmeyecek biçimde içeri iter; boşluklar uygulamanın koyu zeminiyle dolar.
     */
    private View wrapWithInsets(View content) {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        root.addView(content, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int l, t, r, b;
                if (Build.VERSION.SDK_INT >= 30) {
                    android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                    l = bars.left; t = bars.top; r = bars.right; b = Math.max(bars.bottom, ime.bottom);
                } else {
                    l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                    r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
                }
                v.setPadding(l, t, r, b);
                return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
            }
        });
        return root;
    }

    /** Android 13+ (hedef 36'da onBackPressed çağrılmaz): geri hareketi önce arayüze sorulur. */
    private void registerBack() {
        if (Build.VERSION.SDK_INT < 33) return;
        backCallback = new OnBackInvokedCallback() {
            @Override
            public void onBackInvoked() {
                handleBack();
            }
        };
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
    }

    PlayBilling billing() {
        return billing;
    }

    /** Arayüz iş parçacığından satın alma ekranını açar; Play hazır değilse false ve yeniden bağlanmayı dener. */
    boolean buyPro() {
        final boolean ready = billing.isReadyToBuy();
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (ready) billing.buy(MainActivity.this);
                else billing.connect();
            }
        });
        return ready;
    }

    private void readAction(Intent intent) {
        String action = intent == null ? null : intent.getStringExtra("spy_action");
        if (action != null) {
            pendingAction = action;
            intent.removeExtra("spy_action");
        }
    }

    String takeAction() {
        String action = pendingAction;
        pendingAction = "";
        return action;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readAction(intent);
    }

    void js(final String script) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(script, null);
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        billing.connect();
        js("window.onSpyResume&&window.onSpyResume()");
    }

    @Override
    protected void onPause() {
        js("window.onSpyPause&&window.onSpyPause()");
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        billing.close();
        if (web != null) {
            web.removeJavascriptInterface("SpyNative");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (web == null) return;
        web.evaluateJavascript("(window.onSpyBack&&window.onSpyBack())?1:0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (!"1".equals(value)) moveTaskToBack(true);
            }
        });
    }

    void openExternal(String url) {
        if (url == null) return;
        if (!(url.startsWith("https://") || url.startsWith("http://") || url.startsWith("mailto:"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Throwable ignored) {
        }
    }

    void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIFY);
        }
    }

    void startSave(String name, String mime, String content) {
        pendingContent = content == null ? "" : content;
        try {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime == null || mime.length() == 0 ? "text/plain" : mime);
            i.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(i, REQ_SAVE);
        } catch (Throwable t) {
            pendingContent = null;
            js("window.onSpySaved&&window.onSpySaved(false)");
        }
    }

    void startPick() {
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            startActivityForResult(i, REQ_PICK);
        } catch (Throwable t) {
            js("window.onSpyFile&&window.onSpyFile(null)");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
        if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (uri != null && pendingContent != null) {
                try {
                    OutputStream out = getContentResolver().openOutputStream(uri);
                    if (out != null) {
                        out.write(pendingContent.getBytes("UTF-8"));
                        out.close();
                        ok = true;
                    }
                } catch (Throwable ignored) {
                }
            }
            pendingContent = null;
            js("window.onSpySaved&&window.onSpySaved(" + ok + ")");
        } else if (requestCode == REQ_PICK) {
            String text = null;
            if (uri != null) {
                try {
                    InputStream in = getContentResolver().openInputStream(uri);
                    if (in != null) {
                        ByteArrayOutputStream buf = new ByteArrayOutputStream();
                        byte[] chunk = new byte[8192];
                        int n;
                        while ((n = in.read(chunk)) > 0 && buf.size() < 4 * 1024 * 1024) buf.write(chunk, 0, n);
                        in.close();
                        text = new String(buf.toByteArray(), "UTF-8");
                    }
                } catch (Throwable ignored) {
                }
            }
            js("window.onSpyFile&&window.onSpyFile(" + (text == null ? "null" : JSONObject.quote(text)) + ")");
        }
    }
}
