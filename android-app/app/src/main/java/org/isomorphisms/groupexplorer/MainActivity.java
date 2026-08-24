package org.isomorphisms.groupexplorer;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String LOCAL_PREFIX = "/assets/";

    private WebView web_view;

    @Override
    protected void onCreate(Bundle saved_instance_state) {
        super.onCreate(saved_instance_state);

        web_view = new WebView(this);
        web_view.setBackgroundColor(Color.WHITE);
        setContentView(web_view);

        WebSettings settings = web_view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);

        web_view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localResource(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return localResource(Uri.parse(url));
            }
        });

        if (saved_instance_state == null) {
            web_view.loadUrl("https://" + LOCAL_HOST + LOCAL_PREFIX + "Mobile.html");
        } else {
            web_view.restoreState(saved_instance_state);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out_state) {
        web_view.saveState(out_state);
        super.onSaveInstanceState(out_state);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web_view != null && web_view.canGoBack()) {
            web_view.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web_view != null) {
            web_view.stopLoading();
            web_view.destroy();
            web_view = null;
        }
        super.onDestroy();
    }

    private WebResourceResponse localResource(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !LOCAL_HOST.equals(uri.getHost())) {
            return null;
        }

        String path = uri.getPath();
        if (path == null || !path.startsWith(LOCAL_PREFIX)) {
            return notFound("Bad local path");
        }

        String relative_path = path.substring(LOCAL_PREFIX.length());
        if (relative_path.isEmpty() || relative_path.endsWith("/")) {
            relative_path += "index.html";
        }
        if (relative_path.contains("..")) {
            return notFound("Refusing parent path");
        }

        try {
            InputStream input = getAssets().open("site/" + relative_path);
            String mime_type = mimeType(relative_path);
            String encoding = isText(mime_type) ? "UTF-8" : null;
            return new WebResourceResponse(mime_type, encoding, input);
        } catch (IOException missing) {
            return notFound(relative_path);
        }
    }

    private WebResourceResponse notFound(String path) {
        byte[] body = ("Not found: " + path).getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(body)
        );
    }

    private static boolean isText(String mime_type) {
        return mime_type.startsWith("text/")
                || "application/javascript".equals(mime_type)
                || "application/json".equals(mime_type)
                || "application/xml".equals(mime_type)
                || "image/svg+xml".equals(mime_type);
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".xml")) return "application/xml";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";

        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed == null ? "application/octet-stream" : guessed;
    }
}
