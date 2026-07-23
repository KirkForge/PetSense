// Host-compiled test for OTA signature verification (Ed25519 via libsodium).
// Compile and run:
//   g++ -std=c++17 -I src -lsodium test/test_ota.cpp src/ota.cpp -o /tmp/test_ota && /tmp/test_ota
//
// This is NOT a PlatformIO test — it runs on the host to verify the OTA contract.
// Requires libsodium-dev installed on the host system.

#include "ota.h"
#include <cstdio>
#include <cstring>

static int tests_run = 0;
static int tests_passed = 0;

#define ASSERT_TRUE(expr, msg) do { \
    tests_run++; \
    if (expr) { tests_passed++; } \
    else { printf("FAIL: %s\n", msg); } \
} while(0)

int main() {
    // Test keypair: seed 0x00..0x1f (matches TEST_PUBLIC_KEY in ota.cpp).
    // Private key (seed + derived): used only to generate the test signature.
    uint8_t testKey[32] = {
        0x03, 0xa1, 0x07, 0xbf, 0xf3, 0xce, 0x10, 0xbe,
        0x1d, 0x70, 0xdd, 0x18, 0xe7, 0x4b, 0xc0, 0x99,
        0x67, 0xe4, 0xd6, 0x30, 0x9b, 0xa5, 0x0d, 0x5f,
        0x1d, 0xdc, 0x86, 0x64, 0x12, 0x55, 0x31, 0xb8,
    };

    // Valid Ed25519 signature over firmware {0x01, 0x02, 0x03, 0x04, 0x05}
    // signed by the private key corresponding to testKey (seed 0x00..0x1f).
    uint8_t testSig[64] = {
        0x4d, 0x17, 0xa6, 0x05, 0x21, 0xef, 0x9f, 0x8c,
        0x3e, 0xb3, 0x68, 0xce, 0xb0, 0x21, 0x56, 0x76,
        0xa7, 0x9e, 0xd5, 0x4c, 0xd9, 0xec, 0x90, 0xd3,
        0x4f, 0xb1, 0xfb, 0x9f, 0x0a, 0x92, 0x53, 0x7c,
        0xfd, 0xdb, 0x2e, 0x7c, 0x87, 0x1c, 0xbc, 0xf2,
        0xb3, 0xc1, 0x96, 0x23, 0x62, 0xeb, 0x96, 0x3c,
        0x70, 0xcc, 0xdb, 0x47, 0xf0, 0x44, 0xc3, 0x8a,
        0xd7, 0x91, 0x4c, 0x62, 0xfe, 0xc1, 0xe3, 0x0d,
    };
    uint8_t firmware[] = {0x01, 0x02, 0x03, 0x04, 0x05};

    // Test 1: Correct signature passes
    ASSERT_TRUE(
        verifyUpdateSignature(firmware, sizeof(firmware), testSig, sizeof(testSig), testKey, sizeof(testKey)),
        "correct signature should pass"
    );

    // Test 2: Tampered signature fails
    uint8_t tamperedSig[64];
    memcpy(tamperedSig, testSig, 64);
    tamperedSig[0] ^= 0xFF;
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), tamperedSig, sizeof(tamperedSig), testKey, sizeof(testKey)),
        "tampered signature should fail"
    );

    // Test 3: Truncated signature fails
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), testSig, 32, testKey, sizeof(testKey)),
        "truncated signature should fail"
    );

    // Test 4: Null firmware fails
    ASSERT_TRUE(
        !verifyUpdateSignature(nullptr, 0, testSig, sizeof(testSig), testKey, sizeof(testKey)),
        "null firmware should fail"
    );

    // Test 5: Null signature fails
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), nullptr, 0, testKey, sizeof(testKey)),
        "null signature should fail"
    );

    // Test 6: Wrong public key fails
    uint8_t wrongKey[32];
    memset(wrongKey, 0xAA, 32);
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), testSig, sizeof(testSig), wrongKey, sizeof(wrongKey)),
        "wrong public key should fail"
    );

    // Test 7: Signature over different firmware fails
    uint8_t otherFirmware[] = {0x01, 0x02, 0x03, 0x04, 0x06};
    ASSERT_TRUE(
        !verifyUpdateSignature(otherFirmware, sizeof(otherFirmware), testSig, sizeof(testSig), testKey, sizeof(testKey)),
        "signature over different firmware should fail"
    );

    printf("\nOTA verify tests: %d/%d passed\n", tests_passed, tests_run);
    return (tests_passed == tests_run) ? 0 : 1;
}