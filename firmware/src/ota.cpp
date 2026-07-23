#include "ota.h"
#include <sodium/crypto_sign.h>
#include <string.h>

// Test public key (seed 0x00..0x1f, Ed25519 verify key).
// In production, replace with the real OTA signing public key in ota.key.
static const uint8_t TEST_PUBLIC_KEY[OTA_PUBLIC_KEY_SIZE] = {
    0x03, 0xa1, 0x07, 0xbf, 0xf3, 0xce, 0x10, 0xbe,
    0x1d, 0x70, 0xdd, 0x18, 0xe7, 0x4b, 0xc0, 0x99,
    0x67, 0xe4, 0xd6, 0x30, 0x9b, 0xa5, 0x0d, 0x5f,
    0x1d, 0xdc, 0x86, 0x64, 0x12, 0x55, 0x31, 0xb8,
};

bool verifyUpdateSignature(
    const uint8_t* firmware,
    size_t fwLen,
    const uint8_t* sig,
    size_t sigLen,
    const uint8_t* pubkey,
    size_t keyLen
) {
    if (firmware == nullptr || fwLen == 0) {
        return false;
    }

    if (sig == nullptr || sigLen != OTA_SIGNATURE_SIZE) {
        return false;
    }

    if (pubkey == nullptr || keyLen != OTA_PUBLIC_KEY_SIZE) {
        return false;
    }

    // Ed25519 verification via libsodium.
    // crypto_sign_verify_detached returns 0 on valid signature, -1 on invalid.
    return crypto_sign_verify_detached(sig, firmware, fwLen, pubkey) == 0;
}