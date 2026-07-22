#pragma once

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

// OTA signed-update verification for ESP32 firmware.
//
// The verify function checks that a firmware update has a valid signature
// from the trusted signing key. The current implementation is a documented
// stub — it validates signature length and a magic prefix, then compares
// against a compiled-in test public key.
//
// TODO(crypto): replace stub with real Ed25519 verify (libsodium or micro-ecc).
// The function contract (bool return, same parameters) will not change.

#define OTA_SIGNATURE_SIZE 64
#define OTA_PUBLIC_KEY_SIZE 32
#define OTA_SIGNATURE_MAGIC 0xEF  // first byte of a valid signature

bool verifyUpdateSignature(
    const uint8_t* firmware,
    size_t fwLen,
    const uint8_t* sig,
    size_t sigLen,
    const uint8_t* pubkey,
    size_t keyLen
);