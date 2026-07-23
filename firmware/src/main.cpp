#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_wifi.h"
#include "secrets.h"
#include "csi_extract.h"

#ifdef MQTT_TLS_ENABLED
#include <WiFiClientSecure.h>
#endif

#ifndef LED_PIN
#define LED_PIN LED_BUILTIN
#endif

#ifndef CSI_SAMPLE_RATE_MS
#define CSI_SAMPLE_RATE_MS 20
#endif

#ifdef MQTT_TLS_ENABLED
static WiFiClientSecure wifiClient;
#else
static WiFiClient   wifiClient;
#endif
static PubSubClient mqtt(wifiClient);

static unsigned long lastMqttAttempt  = 0;
static unsigned long lastLedBlink     = 0;
static int           mqttBackoffMs    = 1000;
static bool          mqttConnected    = false;

static bool connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return true;

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > 15000) return false;
        delay(250);
    }
    return true;
}

static void enableCSI() {
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_csi_rx_cb(csiCallback, NULL);
    esp_wifi_set_csi(true);
}

static bool connectMQTT() {
    if (mqtt.connected()) {
        mqttConnected = true;
        return true;
    }

    unsigned long now = millis();
    if (now - lastMqttAttempt < (unsigned long)mqttBackoffMs) return false;
    lastMqttAttempt = now;

    if (mqtt.connect(NODE_ID)) {
        mqttConnected = true;
        mqttBackoffMs = 1000;
        return true;
    }

    mqttConnected = false;
    mqttBackoffMs = (mqttBackoffMs * 2 < 60000) ? mqttBackoffMs * 2 : 60000;
    return false;
}

void setup() {
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    Serial.begin(115200);

    if (!connectWiFi()) {
        Serial.println("WiFi failed, rebooting in 5s...");
        delay(5000);
        ESP.restart();
    }

#ifdef MQTT_TLS_ENABLED
    wifiClient.setCACert(MQTT_TLS_CA_CERT);
#endif

    enableCSI();
    mqtt.setServer(MQTT_BROKER_IP, MQTT_PORT);
    connectMQTT();

    digitalWrite(LED_PIN, HIGH);
    Serial.println("PetSense CSI node online");
}

void loop() {
    mqtt.loop();

    if (WiFi.status() != WL_CONNECTED) {
        mqttConnected = false;
        WiFi.reconnect();
        return;
    }

    mqttConnected = connectMQTT();

    CSIPacket pkt;
    if (csiPoll(&pkt)) {
        strncpy(pkt.nodeId, NODE_ID, sizeof(pkt.nodeId) - 1);
        pkt.nodeId[sizeof(pkt.nodeId) - 1] = '\0';

        if (mqttConnected) {
            char json[2048];
            int  jsonLen = serializeCSI(&pkt, json, sizeof(json));
            if (jsonLen > 0) {
                char topic[128];
                snprintf(topic, sizeof(topic), "csi/%s/%lu", NODE_ID, pkt.timestamp);
                mqtt.publish(topic, json);
            }
        }
    }

    unsigned long now = millis();
    if (now - lastLedBlink >= CSI_SAMPLE_RATE_MS) {
        lastLedBlink = now;

        if (mqttConnected) {
            digitalWrite(LED_PIN, HIGH);
        } else {
            digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        }
    }
}

/*
 * ── Deep sleep stubs for battery-powered operation ────────────────────────
 *
 * void enterDeepSleep(uint64_t sec) {
 *     esp_sleep_enable_timer_wakeup(sec * 1000000ULL);
 *     mqtt.disconnect();
 *     WiFi.disconnect(true);
 *     esp_wifi_stop();
 *     esp_deep_sleep_start();
 * }
 *
 * ── Wakeup check in setup() ──────────────────────────────────────────────
 *
 *   esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
 *   switch (cause) {
 *       case ESP_SLEEP_WAKEUP_TIMER:  // scheduled wake from deep sleep
 *           break;
 *       case ESP_SLEEP_WAKEUP_EXT0:   // external RTC IO trigger
 *       case ESP_SLEEP_WAKEUP_EXT1:   // multiple RTC IO trigger
 *       default:                      // cold boot / reset
 *           break;
 *   }
 *
 * ── Battery life estimates ────────────────────────────────────────────────
 *
 *   CSI @ 50 Hz, WiFi STA, MQTT active:  ~80 mA  → ~37 h on 3000 mAh
 *   Burst mode (10s active / 60s sleep): ~13 mA  → ~230 h on 3000 mAh
 *   PIR-triggered wake only:            ~1.5 mA → ~2000 h on 3000 mAh
 */
