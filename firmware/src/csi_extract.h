#pragma once

#include <stdint.h>
#include <stddef.h>
#include "esp_wifi.h"

struct CSIPacket {
    char nodeId[32];
    uint32_t timestamp;
    int8_t rssi;
    int8_t noise;
    float amplitudes[64];
    float phases[64];
    uint8_t subcarrierCount;
};

void extractCSI(void* buff, uint16_t len, CSIPacket* out);

int serializeCSI(const CSIPacket* pkt, char* jsonBuf, size_t bufLen);

void csiCallback(void* ctx, wifi_csi_info_t* data);

bool csiPoll(CSIPacket* out);
