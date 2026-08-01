package com.helios.station;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 配置 WebView 允许外部请求
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowContentAccess(true);
        }

        // 键盘顶起适配：直接监听 ime insets（不依赖 adjustResize / opt-out，
        // 兼容 Android 15 强制 edge-to-edge 与 Android 16 移除 opt-out 的情况）。
        // 计算键盘实际遮挡高度并注入 CSS 变量 --kb-height，由 JS 撑开页面底部。
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (v, insets) -> {
            int ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
            int nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            // 非 edge-to-edge（系统已 resize）时 ime insets 为 0 → 注入 0，不重复撑开
            final int kb = Math.max(0, ime - nav);
            final WebView wv = this.bridge.getWebView();
            if (wv != null) {
                wv.post(() -> wv.evaluateJavascript(
                    "document.documentElement.style.setProperty('--kb-height', '" + kb + "px');" +
                    "document.documentElement.style.setProperty('--kb-ime', '" + ime + "px');" +
                    "document.documentElement.style.setProperty('--kb-nav', '" + nav + "px');" +
                    "if (window.__onKbChange) window.__onKbChange(" + ime + "," + nav + "," + kb + "); true",
                    null));
            }
            return insets;
        });
    }
}
