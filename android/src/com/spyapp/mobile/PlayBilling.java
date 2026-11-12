package com.spyapp.mobile;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesResponseListener;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Spy Pro: Google Play'de tanımlı tek seferlik uygulama içi ürün ("spy_pro").
 * Satın alma durumu Play'den okunur ve çevrimdışı çalışabilmek için cihazda önbelleğe alınır; Play "satın alma yok" derse
 * (iade, başka hesap) önbellek silinir. Play'e hiç ulaşılamazsa son bilinen durum korunur.
 */
final class PlayBilling implements PurchasesUpdatedListener {
    static final String PRODUCT_ID = "spy_pro";
    private static final String PREFS = "spy_billing";

    private final Context app;
    private final MainActivity activity;
    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile BillingClient client;
    private volatile ProductDetails details;
    private volatile boolean connecting;

    PlayBilling(MainActivity activity) {
        this.activity = activity;
        this.app = activity.getApplicationContext();
        this.prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Uygulama öne geldiğinde: bağlantıyı kurar (varsa yeniler) ve satın almaları yeniden sorgular. */
    void connect() {
        try {
            if (client == null) {
                client = BillingClient.newBuilder(app)
                        .setListener(this)
                        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                        .enableAutoServiceReconnection()
                        .build();
            }
            if (client.isReady()) {
                queryAll();
                return;
            }
            if (connecting) return;
            connecting = true;
            client.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult result) {
                    connecting = false;
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) queryAll();
                    else changed();
                }

                @Override
                public void onBillingServiceDisconnected() {
                    connecting = false;
                }
            });
        } catch (Throwable t) {
            connecting = false;
        }
    }

    void close() {
        try {
            if (client != null) client.endConnection();
        } catch (Throwable ignored) {
        }
        client = null;
        connecting = false;
    }

    private void queryAll() {
        queryPurchases();
        queryDetails();
    }

    private void queryPurchases() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                new PurchasesResponseListener() {
                    @Override
                    public void onQueryPurchasesResponse(BillingResult result, List<Purchase> purchases) {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;  // son bilinen durum kalır
                        apply(purchases, true);
                    }
                });
    }

    private void queryDetails() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<QueryProductDetailsParams.Product>();
        products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT_ID).setProductType(BillingClient.ProductType.INAPP).build());
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(),
                new ProductDetailsResponseListener() {
                    @Override
                    public void onProductDetailsResponse(BillingResult result, QueryProductDetailsResult list) {
                        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                        for (ProductDetails d : list.getProductDetailsList()) {
                            if (PRODUCT_ID.equals(d.getProductId()) && d.getOneTimePurchaseOfferDetails() != null) {
                                details = d;
                                prefs.edit().putString("price", d.getOneTimePurchaseOfferDetails().getFormattedPrice()).apply();
                            }
                        }
                        changed();
                    }
                });
    }

    /** definitive: Play'in tam listesi (satın alma yoksa durum temizlenir). */
    private void apply(List<Purchase> purchases, boolean definitive) {
        boolean owned = false, pending = false;
        if (purchases != null) {
            for (final Purchase p : purchases) {
                if (!p.getProducts().contains(PRODUCT_ID)) continue;
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    owned = true;
                    if (!p.isAcknowledged()) {   // 3 gün içinde onaylanmazsa Play parayı iade eder
                        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                                new AcknowledgePurchaseResponseListener() {
                                    @Override
                                    public void onAcknowledgePurchaseResponse(BillingResult r) {
                                    }
                                });
                    }
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    pending = true;
                }
            }
        }
        SharedPreferences.Editor e = prefs.edit();
        if (owned) e.putBoolean("owned", true);
        else if (definitive) e.putBoolean("owned", false);
        e.putBoolean("pending", pending && !owned);
        e.apply();
        changed();
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK) apply(purchases, false);
        else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) queryPurchases();
        else changed();
    }

    /** Satın alma ekranını açar; Play hazır değilse false. */
    boolean buy(Activity from) {
        try {
            if (client == null || !client.isReady() || details == null) {
                connect();
                return false;
            }
            List<BillingFlowParams.ProductDetailsParams> list = new ArrayList<BillingFlowParams.ProductDetailsParams>();
            list.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build());
            BillingResult r = client.launchBillingFlow(from, BillingFlowParams.newBuilder().setProductDetailsParamsList(list).build());
            return r.getResponseCode() == BillingClient.BillingResponseCode.OK;
        } catch (Throwable t) {
            return false;
        }
    }

    boolean isReadyToBuy() {
        BillingClient c = client;
        return c != null && c.isReady() && details != null;
    }

    String stateJson() {
        try {
            boolean ready = client != null && client.isReady();
            JSONObject o = new JSONObject();
            o.put("available", ready && details != null);
            o.put("ready", ready);
            o.put("owned", prefs.getBoolean("owned", false));
            o.put("pending", prefs.getBoolean("pending", false));
            o.put("price", prefs.getString("price", ""));
            return o.toString();
        } catch (Throwable t) {
            return "{}";
        }
    }

    private void changed() {
        main.post(new Runnable() {
            @Override
            public void run() {
                activity.js("window.onSpyBilling&&window.onSpyBilling()");
            }
        });
    }
}
