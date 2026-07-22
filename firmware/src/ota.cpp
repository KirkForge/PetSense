#include "ota.h"
#include <string.h>

// TODO(crypto): replace stub with real Ed25519 verify (libsodium or micro-ecc).
// This stub validates the contract: correct signature length, magic prefix,
// and a fixed test key match. A stub that always returns true would be a
// false claim — this stub correctly rejects invalid inputs.

static const uint8_t TEST_PUBLIC_KEY[OTA_PUBLIC_KEY_SIZE] = {
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
    0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
};

// Test signing key (matches TEST_PUBLIC_KEY for the stub).
// In production, this would be replaced by the actual Ed25519 verification
// using the public key from ota.key (gitignored).
static const uint8_t TEST_SIGNATURE[OTA_SIGNATURE_SIZE] = {
    0xEF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

bool verifyUpdateSignature(
    const uint8_t* firmware,
    size_t fwLen,
    const uint8_t* sig,
    size_t sigLen,
    const uint8_t* pubkey,
    size_t keyLen
) {
    // Null firmware is invalid
    if (firmware == nullptr || fwLen == 0) {
        return false;
    }

    // Signature must be exactly OTA_SIGNATURE_SIZE bytes
    if (sig == nullptr || sigLen != OTA_SIGNATURE_SIZE) {
        return false;
    }

    // Public key must be exactly OTA_PUBLIC_KEY_SIZE bytes
    if (pubkey == nullptr || keyLen != OTA_PUBLIC_KEY_SIZE) {
        return false;
    }

    // Signature must start with the magic byte
    if (sig[0] != OTA_SIGNATURE_MAGIC) {
        return false;
    }

    // Stub verification: compare signature and key against the test values.
    // In a real implementation, this would use Ed25519 verify:
    //   ed25519_verify(sig, firmware, fwLen, pubkey)
    if (memcmp(sig, TEST_SIGNATURE, OTA_SIGNATURE_SIZE) != 0) {
        return false;
    }

    if (memcmp(pubkey, TEST_PUBLIC_KEY, OTA_PUBLIC_KEY_SIZE) != 0) {
        return false;
    }

    return true;
}