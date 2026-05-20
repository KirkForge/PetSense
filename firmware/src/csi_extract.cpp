#include "csi_extract.h"
#include <ArduinoJson.h>
#include <string.h>
#include <math.h>

#define RAW_CSI_BUF_SIZE  512
#define MAX_SUBCARRIERS   64

static uint8_t           rawBuf[RAW_CSI_BUF_SIZE];
static wifi_pkt_rx_ctrl_t rawCtrl;
static uint16_t          rawLen = 0;
static volatile bool     newDataReady = false;
static portMUX_TYPE      csiLock = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR csiCallback(void* ctx, wifi_csi_info_t* data) {
    portENTER_CRITICAL_ISR(&csiLock);

    uint16_t copyLen = (data->len < RAW_CSI_BUF_SIZE) ? data->len : RAW_CSI_BUF_SIZE;
    memcpy(rawBuf, data->buf, copyLen);
    memcpy(&rawCtrl, &data->rx_ctrl, sizeof(wifi_pkt_rx_ctrl_t));
    rawLen = copyLen;
    newDataReady = true;

    portEXIT_CRITICAL_ISR(&csiLock);
}

bool csiPoll(CSIPacket* out) {
    bool hadData = false;

    portENTER_CRITICAL(&csiLock);
    if (newDataReady) {
        hadData = true;
        newDataReady = false;
    }
    portEXIT_CRITICAL(&csiLock);

    if (hadData) {
        extractCSI(rawBuf, rawLen, out);
        out->timestamp = rawCtrl.timestamp;
        out->rssi      = rawCtrl.rssi;
        out->noise     = rawCtrl.noise_floor;
    }
    return hadData;
}

void extractCSI(void* buff, uint16_t len, CSIPacket* out) {
    int8_t* csi     = ((int8_t*)buff) + 4;
    uint16_t dataLen = (len > 4) ? (len - 4) : 0;
    uint8_t  n       = dataLen / 2;

    if (n > MAX_SUBCARRIERS) n = MAX_SUBCARRIERS;
    out->subcarrierCount = n;

    for (uint8_t i = 0; i < n; i++) {
        float im = (float)csi[i * 2];
        float re = (float)csi[i * 2 + 1];
        out->amplitudes[i] = sqrtf(im * im + re * re);
        out->phases[i]     = atan2f(im, re);
    }
}

int serializeCSI(const CSIPacket* pkt, char* jsonBuf, size_t bufLen) {
    StaticJsonDocument<2048> doc;

    doc["node_id"]   = pkt->nodeId;
    doc["timestamp"] = pkt->timestamp;
    doc["rssi"]      = pkt->rssi;
    doc["noise"]     = pkt->noise;

    JsonArray amps = doc["csi"].createNestedArray("amplitudes");
    JsonArray phs  = doc["csi"].createNestedArray("phases");

    for (uint8_t i = 0; i < pkt->subcarrierCount; i++) {
        amps.add(pkt->amplitudes[i]);
        phs.add(pkt->phases[i]);
    }

    return serializeJson(doc, jsonBuf, bufLen);
}
