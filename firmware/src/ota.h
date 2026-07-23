#pragma once

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

// OTA signed-update verification for ESP32 firmware.
//
// Ed25519 verification using libsodium. The verify function checks that
// a firmware update has a valid signature from the trusted signing key.
// Public key is compiled in from ota.key (gitignored); ota.template
// has the format documentation.

#define OTA_SIGNATURE_SIZE 64
#define OTA_PUBLIC_KEY_SIZE 32

bool verifyUpdateSignature(
    const uint8_t* firmware,
    size_t fwLen,
    const uint8_t* sig,
    size_t sigLen,
    const uint8_t* pubkey,
    size_t keyLen
);